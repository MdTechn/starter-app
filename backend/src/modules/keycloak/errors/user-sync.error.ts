import { ForbiddenException } from '@nestjs/common';

export enum UserSyncErrorCode {
  DISABLED = 'USER_DISABLED',
  DELETED = 'USER_DELETED',
  SYNC_FAILED = 'USER_SYNC_FAILED',
}

export class UserSyncError extends Error {
  constructor(
    public readonly code: UserSyncErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'UserSyncError';
  }

  toHttpException(): ForbiddenException {
    return new ForbiddenException({
      code: this.code,
      message: this.message,
    });
  }
}

export function isUserSyncError(err: unknown): err is UserSyncError {
  return err instanceof UserSyncError;
}
