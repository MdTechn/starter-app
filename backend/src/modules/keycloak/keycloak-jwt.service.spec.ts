import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JWTPayload } from 'jose';
import { Permission, UserRole } from '@saas-starter/shared/auth';
import { KeycloakJwtService } from './keycloak-jwt.service';
import {
  JwtErrorCode,
  JwtValidationError,
} from './errors/jwt-validation.error';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => 'jwks'),
  jwtVerify: jest.fn(),
  errors: {
    JWTExpired: class JWTExpired extends Error {
      constructor(message?: string) {
        super(message);
        this.name = 'JWTExpired';
      }
    },
    JWTClaimValidationFailed: class JWTClaimValidationFailed extends Error {
      claim?: string;
      constructor(message?: string) {
        super(message);
        this.name = 'JWTClaimValidationFailed';
      }
    },
    JWSSignatureVerificationFailed: class JWSSignatureVerificationFailed extends Error {
      constructor(message?: string) {
        super(message);
        this.name = 'JWSSignatureVerificationFailed';
      }
    },
  },
}));

import { jwtVerify, errors as JoseErrors } from 'jose';

describe('KeycloakJwtService', () => {
  let service: KeycloakJwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeycloakJwtService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'keycloak'
                ? {
                    enabled: true,
                    issuer: 'http://localhost:8080/realms/saas-realm',
                    clientId: 'saas-web',
                    audience: 'saas-web',
                    jwksUri:
                      'http://localhost:8080/realms/saas-realm/protocol/openid-connect/certs',
                  }
                : undefined,
          },
        },
      ],
    }).compile();

    service = module.get(KeycloakJwtService);
    jest.clearAllMocks();
  });

  it('mapPayload extracts roles and permissions', () => {
    const payload: JWTPayload = {
      sub: 'kc-123',
      email: 'user@example.com',
      name: 'Demo User',
      realm_access: { roles: ['USER', 'ADMIN'] },
    };

    const user = service.mapPayload(payload);
    expect(user.roles).toEqual(
      expect.arrayContaining([UserRole.USER, UserRole.ADMIN]),
    );
    expect(user.permissions).toEqual(
      expect.arrayContaining([
        Permission.AUTH_ME,
        Permission.USERS_LIST,
        Permission.ADMIN_ACCESS,
      ]),
    );
    expect(user.provider).toBe('keycloak');
  });

  it('mapPayload extracts social broker claims', () => {
    const payload: JWTPayload = {
      sub: 'kc-social',
      email: 'social@example.com',
      given_name: 'Ada',
      family_name: 'Lovelace',
      picture: 'https://example.com/a.png',
      preferred_username: 'ada',
      identity_provider: 'google',
      realm_access: { roles: ['USER'] },
    };

    const user = service.mapPayload(payload);
    expect(user.identityProvider).toBe('google');
    expect(user.firstName).toBe('Ada');
    expect(user.lastName).toBe('Lovelace');
    expect(user.avatarUrl).toBe('https://example.com/a.png');
    expect(user.name).toBe('Ada Lovelace');
    expect(user.roles).toContain(UserRole.USER);
  });

  it('verifyToken validates issuer, audience, azp and exp', async () => {
    (jwtVerify as jest.Mock).mockResolvedValue({
      payload: {
        sub: 'kc-123',
        email: 'user@example.com',
        aud: 'account',
        azp: 'saas-web',
        exp: Math.floor(Date.now() / 1000) + 3600,
        realm_access: { roles: ['USER'] },
      },
    });

    const user = await service.verifyToken('token');
    expect(user.sub).toBe('kc-123');
    expect(user.roles).toContain(UserRole.USER);
    expect(jwtVerify).toHaveBeenCalledWith(
      'token',
      'jwks',
      expect.objectContaining({
        issuer: 'http://localhost:8080/realms/saas-realm',
        clockTolerance: 30,
      }),
    );
  });

  it('rejects invalid audience', async () => {
    (jwtVerify as jest.Mock).mockResolvedValue({
      payload: {
        sub: 'kc-123',
        email: 'user@example.com',
        aud: 'other',
        azp: 'unknown-client',
        exp: Math.floor(Date.now() / 1000) + 3600,
        realm_access: { roles: ['USER'] },
      },
    });

    await expect(service.verifyToken('token')).rejects.toMatchObject({
      code: JwtErrorCode.INVALID_AUDIENCE,
    });
  });

  it('rejects expired tokens from jose', async () => {
    (jwtVerify as jest.Mock).mockRejectedValue(
      new JoseErrors.JWTExpired('expired', {}, 'exp'),
    );

    await expect(service.verifyToken('token')).rejects.toBeInstanceOf(
      JwtValidationError,
    );
    await expect(service.verifyToken('token')).rejects.toMatchObject({
      code: JwtErrorCode.EXPIRED,
    });
  });

  it('rejects missing exp claim after verify', async () => {
    (jwtVerify as jest.Mock).mockResolvedValue({
      payload: {
        sub: 'kc-123',
        email: 'user@example.com',
        azp: 'saas-web',
        realm_access: { roles: ['USER'] },
      },
    });

    await expect(service.verifyToken('token')).rejects.toMatchObject({
      code: JwtErrorCode.MISSING_CLAIMS,
    });
  });

  it('isEnabled returns false when disabled', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeycloakJwtService,
        {
          provide: ConfigService,
          useValue: {
            get: () => ({ enabled: false }),
          },
        },
      ],
    }).compile();

    expect(module.get(KeycloakJwtService).isEnabled()).toBe(false);
  });
});
