export enum JwtErrorCode {
  NOT_CONFIGURED = 'JWT_NOT_CONFIGURED',
  INVALID_SIGNATURE = 'JWT_INVALID_SIGNATURE',
  EXPIRED = 'JWT_EXPIRED',
  INVALID_ISSUER = 'JWT_INVALID_ISSUER',
  INVALID_AUDIENCE = 'JWT_INVALID_AUDIENCE',
  INVALID_AZP = 'JWT_INVALID_AZP',
  MISSING_CLAIMS = 'JWT_MISSING_CLAIMS',
  INVALID_TOKEN = 'JWT_INVALID_TOKEN',
}

export class JwtValidationError extends Error {
  constructor(
    public readonly code: JwtErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'JwtValidationError';
  }
}

export function isJwtValidationError(err: unknown): err is JwtValidationError {
  return err instanceof JwtValidationError;
}
