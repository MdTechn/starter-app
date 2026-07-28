import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createRemoteJWKSet,
  errors as JoseErrors,
  jwtVerify,
  JWTPayload,
} from 'jose';
import {
  getPermissionsForRoles,
  mapKeycloakRolesToAppRoles,
  UserRole,
} from '@saas-starter/shared/auth';
import { keycloakConfigFactory } from '../../config/keycloak.config';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import {
  JwtErrorCode,
  JwtValidationError,
} from './errors/jwt-validation.error';

type KeycloakConfig = ReturnType<typeof keycloakConfigFactory>;

@Injectable()
export class KeycloakJwtService {
  private jwks?: ReturnType<typeof createRemoteJWKSet>;
  private readonly config: KeycloakConfig;

  constructor(private readonly configService: ConfigService) {
    this.config =
      this.configService.get<KeycloakConfig>('keycloak') ??
      keycloakConfigFactory();
    if (this.config.jwksUri) {
      this.jwks = createRemoteJWKSet(new URL(this.config.jwksUri));
    }
  }

  isEnabled(): boolean {
    return this.config.enabled && Boolean(this.config.issuer && this.jwks);
  }

  async verifyToken(token: string): Promise<AuthenticatedUser> {
    if (!this.jwks || !this.config.issuer) {
      throw new JwtValidationError(
        JwtErrorCode.NOT_CONFIGURED,
        'Keycloak JWT validation is not configured',
      );
    }

    let payload: JWTPayload;
    try {
      const result = await jwtVerify(token, this.jwks, {
        issuer: this.config.issuer,
        // jose validates `exp` by default; small clock skew for distributed clocks
        clockTolerance: 30,
      });
      payload = result.payload;
    } catch (err) {
      throw this.mapJoseError(err);
    }

    this.validateAudience(payload);
    this.validateAzp(payload);
    this.validateExpiration(payload);

    return this.mapPayload(payload);
  }

  mapPayload(payload: JWTPayload): AuthenticatedUser {
    const email =
      (payload.email as string | undefined) ??
      (payload.preferred_username as string | undefined);

    if (!payload.sub || !email) {
      throw new JwtValidationError(
        JwtErrorCode.MISSING_CLAIMS,
        'Invalid token payload: missing sub or email',
      );
    }

    const tokenRoles = this.extractRoles(payload);
    const roles = mapKeycloakRolesToAppRoles(tokenRoles);
    const permissions = getPermissionsForRoles(roles);
    const identityProvider =
      (payload.identity_provider as string | undefined) ??
      (payload.idp as string | undefined);
    const firstName = payload.given_name as string | undefined;
    const lastName = payload.family_name as string | undefined;
    const composedName = [firstName, lastName].filter(Boolean).join(' ');

    return {
      sub: payload.sub,
      email,
      name: (payload.name as string | undefined) ?? (composedName || undefined),
      firstName,
      lastName,
      avatarUrl: (payload.picture as string | undefined) ?? undefined,
      username: (payload.preferred_username as string | undefined) ?? undefined,
      roles,
      permissions,
      identityProvider,
      // Always Keycloak as IdP; social broker alias is in identityProvider.
      provider: 'keycloak',
    };
  }

  /** Expose role mapping for tests / reuse */
  mapTokenRoles(tokenRoles: string[]): UserRole[] {
    return mapKeycloakRolesToAppRoles(tokenRoles);
  }

  private validateAudience(payload: JWTPayload): void {
    if (!this.config.audience) {
      return;
    }

    const aud = payload.aud;
    const audiences = Array.isArray(aud) ? aud : aud ? [aud] : [];
    const azp = payload.azp as string | undefined;

    const allowed =
      audiences.includes(this.config.audience) ||
      azp === this.config.audience ||
      azp === this.config.clientId;

    if (!allowed) {
      throw new JwtValidationError(
        JwtErrorCode.INVALID_AUDIENCE,
        `Invalid token audience (expected ${this.config.audience})`,
      );
    }
  }

  private validateAzp(payload: JWTPayload): void {
    const azp = payload.azp as string | undefined;
    if (!azp) {
      // Some token types may omit azp; audience check already ran.
      return;
    }

    const allowedClients = [
      this.config.audience,
      this.config.clientId,
      'saas-web',
    ].filter(Boolean);

    if (!allowedClients.includes(azp)) {
      throw new JwtValidationError(
        JwtErrorCode.INVALID_AZP,
        `Invalid authorized party (azp=${azp})`,
      );
    }
  }

  private validateExpiration(payload: JWTPayload): void {
    if (typeof payload.exp !== 'number') {
      throw new JwtValidationError(
        JwtErrorCode.MISSING_CLAIMS,
        'Token missing exp claim',
      );
    }
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp + 30 < now) {
      throw new JwtValidationError(JwtErrorCode.EXPIRED, 'Token has expired');
    }
  }

  private extractRoles(payload: JWTPayload): string[] {
    const roles = new Set<string>();
    const realmAccess = payload.realm_access as
      { roles?: string[] } | undefined;
    realmAccess?.roles?.forEach((role) => {
      if (
        role === 'USER' ||
        role === 'ADMIN' ||
        role === 'user' ||
        role === 'admin'
      ) {
        roles.add(role);
      }
    });

    const resourceAccess = payload.resource_access as
      Record<string, { roles?: string[] }> | undefined;

    if (resourceAccess) {
      const preferred =
        resourceAccess[this.config.clientId]?.roles ??
        resourceAccess['saas-web']?.roles;
      const clientRoles =
        preferred ??
        Object.values(resourceAccess).flatMap((entry) => entry.roles ?? []);
      clientRoles.forEach((role) => {
        if (
          role === 'USER' ||
          role === 'ADMIN' ||
          role === 'user' ||
          role === 'admin'
        ) {
          roles.add(role);
        }
      });
    }

    return Array.from(roles);
  }

  private mapJoseError(err: unknown): JwtValidationError {
    if (err instanceof JoseErrors.JWTExpired) {
      return new JwtValidationError(JwtErrorCode.EXPIRED, 'Token has expired');
    }
    if (err instanceof JoseErrors.JWTClaimValidationFailed) {
      if (err.claim === 'iss') {
        return new JwtValidationError(
          JwtErrorCode.INVALID_ISSUER,
          'Invalid token issuer',
        );
      }
      if (err.claim === 'exp') {
        return new JwtValidationError(
          JwtErrorCode.EXPIRED,
          'Token has expired',
        );
      }
      return new JwtValidationError(
        JwtErrorCode.INVALID_TOKEN,
        err.message || 'JWT claim validation failed',
      );
    }
    if (err instanceof JoseErrors.JWSSignatureVerificationFailed) {
      return new JwtValidationError(
        JwtErrorCode.INVALID_SIGNATURE,
        'Invalid token signature',
      );
    }
    if (err instanceof JwtValidationError) {
      return err;
    }
    const message = err instanceof Error ? err.message : 'Invalid token';
    return new JwtValidationError(JwtErrorCode.INVALID_TOKEN, message);
  }
}
