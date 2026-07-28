import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const baseConfig = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  };

  it('accepts minimal valid configuration', () => {
    const result = validateEnv(baseConfig);
    expect(result.DATABASE_URL).toBe(baseConfig.DATABASE_URL);
    expect(result.NODE_ENV).toBe('development');
    expect(result.PORT).toBe(3001);
    expect(result.API_PREFIX).toBe('api');
  });

  it('applies defaults for optional values', () => {
    const result = validateEnv(baseConfig);
    expect(result.LOG_LEVEL).toBe('log');
    expect(result.SWAGGER_PATH).toBe('docs');
    expect(result.STORAGE_DRIVER).toBe('local');
    expect(result.JWT_EXPIRES_IN).toBe('7d');
  });

  it('parses boolean env values', () => {
    const result = validateEnv({
      ...baseConfig,
      SWAGGER_ENABLED: 'true',
      SMTP_SECURE: '1',
    });
    expect(result.SWAGGER_ENABLED).toBe(true);
    expect(result.SMTP_SECURE).toBe(true);
  });

  it('throws on invalid configuration', () => {
    expect(() => validateEnv({})).toThrow(/Invalid environment configuration/);
    expect(() =>
      validateEnv({ DATABASE_URL: 'postgresql://x', PORT: -1 }),
    ).toThrow(/Invalid environment configuration/);
  });
});
