import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, UserRole } from '@saas-starter/shared/auth';
import { KeycloakAuthGuard } from './keycloak-auth.guard';
import { RolesGuard } from './roles.guard';
import { PermissionsGuard } from './permissions.guard';
import { KeycloakJwtService } from '../keycloak-jwt.service';
import { KeycloakUserSyncService } from '../keycloak-user-sync.service';
import { AppLogger } from '../../../common/logger/app-logger.service';
import { AuthAuditService } from '../../auth/auth-audit.service';
import { NotificationDispatcher } from '../../../common/events/notification-dispatcher';
import {
  JwtErrorCode,
  JwtValidationError,
} from '../errors/jwt-validation.error';
import { UserSyncError, UserSyncErrorCode } from '../errors/user-sync.error';

describe('KeycloakAuthGuard', () => {
  let guard: KeycloakAuthGuard;
  let jwtService: jest.Mocked<KeycloakJwtService>;
  let userSync: jest.Mocked<KeycloakUserSyncService>;
  let audit: { record: jest.Mock };
  let notifications: { dispatch: jest.Mock };
  let reflector: Reflector;

  const logger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as AppLogger;

  beforeEach(() => {
    jwtService = {
      isEnabled: jest.fn().mockReturnValue(true),
      verifyToken: jest.fn().mockResolvedValue({
        sub: 'kc-1',
        email: 'user@example.com',
        roles: ['USER'],
        permissions: [Permission.AUTH_ME],
      }),
    } as unknown as jest.Mocked<KeycloakJwtService>;

    userSync = {
      syncUser: jest.fn().mockResolvedValue({
        user: { id: 'u1' },
        created: false,
        linked: false,
        loginEvent: false,
        provider: 'KEYCLOAK',
        socialLogin: false,
      }),
    } as unknown as jest.Mocked<KeycloakUserSyncService>;

    audit = { record: jest.fn().mockResolvedValue({}) };
    notifications = { dispatch: jest.fn() };
    reflector = new Reflector();
    guard = new KeycloakAuthGuard(
      reflector,
      jwtService,
      userSync,
      audit as unknown as AuthAuditService,
      notifications as unknown as NotificationDispatcher,
      logger,
    );
  });

  const createContext = (authHeader?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: authHeader },
          url: '/api/users/me',
          ip: '127.0.0.1',
          socket: { remoteAddress: '127.0.0.1' },
          user: undefined,
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as ExecutionContext;

  it('allows public routes', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    await expect(guard.canActivate(createContext())).resolves.toBe(true);
  });

  it('rejects missing bearer token and audits LOGIN_FAILED', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'LOGIN_FAILED' }),
    );
  });

  it('authenticates valid bearer token', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    await expect(
      guard.canActivate(createContext('Bearer valid-token')),
    ).resolves.toBe(true);
    expect(userSync.syncUser).toHaveBeenCalled();
  });

  it('audits LOGIN_SUCCESS on loginEvent', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    userSync.syncUser.mockResolvedValue({
      user: { id: 'u1' },
      created: true,
      linked: false,
      loginEvent: true,
      provider: 'KEYCLOAK',
      socialLogin: false,
    } as never);

    await guard.canActivate(createContext('Bearer valid-token'));
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'LOGIN_SUCCESS', userId: 'u1' }),
    );
  });

  it('audits SOCIAL_LOGIN for social broker logins', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    jwtService.verifyToken.mockResolvedValue({
      sub: 'kc-g',
      email: 'g@example.com',
      roles: ['USER'],
      permissions: [Permission.AUTH_ME],
      identityProvider: 'google',
    });
    userSync.syncUser.mockResolvedValue({
      user: { id: 'u-social' },
      created: true,
      linked: false,
      loginEvent: true,
      provider: 'GOOGLE',
      socialLogin: true,
    } as never);

    await guard.canActivate(createContext('Bearer social-token'));
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'SOCIAL_LOGIN',
        userId: 'u-social',
        provider: 'GOOGLE',
      }),
    );
  });

  it('maps JWT validation errors to UnauthorizedException with code', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    jwtService.verifyToken.mockRejectedValue(
      new JwtValidationError(JwtErrorCode.EXPIRED, 'Token has expired'),
    );

    try {
      await guard.canActivate(createContext('Bearer expired'));
      fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect((err as UnauthorizedException).getResponse()).toMatchObject({
        code: JwtErrorCode.EXPIRED,
      });
    }
  });

  it('maps disabled user sync errors to ForbiddenException and audits', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    userSync.syncUser.mockRejectedValue(
      new UserSyncError(UserSyncErrorCode.DISABLED, 'User account is disabled'),
    );

    await expect(
      guard.canActivate(createContext('Bearer valid-token')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'ACCOUNT_DISABLED' }),
    );
  });
});

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector, {
      isEnabled: () => true,
    } as KeycloakJwtService);
  });

  const createContext = (user?: { roles: string[] }) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as ExecutionContext;

  it('allows when no roles required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(createContext({ roles: ['USER'] }))).toBe(true);
  });

  it('rejects when role missing', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.ADMIN]);
    expect(() => guard.canActivate(createContext({ roles: ['USER'] }))).toThrow(
      ForbiddenException,
    );
  });

  it('allows when required role present', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.ADMIN]);
    expect(guard.canActivate(createContext({ roles: ['ADMIN', 'USER'] }))).toBe(
      true,
    );
  });
});

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector, {
      isEnabled: () => true,
    } as KeycloakJwtService);
  });

  const createContext = (user?: { roles: string[]; permissions: string[] }) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as ExecutionContext;

  it('allows admin IAM permission', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Permission.IAM_MANAGE]);
    expect(
      guard.canActivate(
        createContext({
          roles: ['ADMIN'],
          permissions: [Permission.IAM_MANAGE],
        }),
      ),
    ).toBe(true);
  });

  it('allows notification:read for USER', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Permission.NOTIFICATION_READ]);
    expect(
      guard.canActivate(
        createContext({
          roles: ['USER'],
          permissions: [Permission.NOTIFICATION_READ],
        }),
      ),
    ).toBe(true);
  });

  it('rejects notification:manage without permission', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Permission.NOTIFICATION_MANAGE]);
    expect(() =>
      guard.canActivate(
        createContext({
          roles: ['USER'],
          permissions: [Permission.NOTIFICATION_READ],
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows upload:write for USER', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Permission.UPLOAD_WRITE]);
    expect(
      guard.canActivate(
        createContext({
          roles: ['USER'],
          permissions: [Permission.UPLOAD_WRITE],
        }),
      ),
    ).toBe(true);
  });

  it('rejects upload:manage without permission', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Permission.UPLOAD_MANAGE]);
    expect(() =>
      guard.canActivate(
        createContext({
          roles: ['USER'],
          permissions: [Permission.UPLOAD_WRITE],
        }),
      ),
    ).toThrow(ForbiddenException);
  });
});
