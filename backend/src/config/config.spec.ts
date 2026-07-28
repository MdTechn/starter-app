import { databaseConfigFactory } from './database.config';
import { jwtConfigFactory } from './jwt.config';
import { keycloakConfigFactory } from './keycloak.config';
import { stripeConfigFactory } from './stripe.config';
import { mailConfigFactory } from './mail.config';
import { storageConfigFactory } from './storage.config';
import { redisConfigFactory } from './redis.config';
import { oauthConfigFactory } from './oauth.config';
import { brandConfigFactory } from './brand.config';

describe('config modules', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('database config reads DATABASE_URL', () => {
    process.env.DATABASE_URL = 'postgresql://test';
    expect(databaseConfigFactory().url).toBe('postgresql://test');
  });

  it('jwt config applies defaults', () => {
    const config = jwtConfigFactory();
    expect(config.expiresIn).toBe('7d');
    expect(config.refreshExpiresIn).toBe('30d');
  });

  it('keycloak config maps env vars', () => {
    process.env.KEYCLOAK_REALM = 'saas-realm';
    process.env.KEYCLOAK_URL = 'http://localhost:8080';
    process.env.KEYCLOAK_ENABLED = 'true';
    const config = keycloakConfigFactory();
    expect(config.realm).toBe('saas-realm');
    expect(config.issuer).toBe('http://localhost:8080/realms/saas-realm');
    expect(config.enabled).toBe(true);
  });

  it('stripe config maps env vars', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test';
    process.env.STRIPE_PUBLIC_KEY = 'pk_test';
    const config = stripeConfigFactory();
    expect(config.secretKey).toBe('sk_test');
    expect(config.publishableKey).toBe('pk_test');
  });

  it('stripe config accepts STRIPE_PUBLISHABLE_KEY alias', () => {
    delete process.env.STRIPE_PUBLIC_KEY;
    process.env.STRIPE_PUBLISHABLE_KEY = 'pk_alias';
    expect(stripeConfigFactory().publishableKey).toBe('pk_alias');
  });

  it('mail config maps SMTP settings', () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '465';
    const config = mailConfigFactory();
    expect(config.host).toBe('smtp.example.com');
    expect(config.port).toBe(465);
  });

  it('storage config defaults to local driver', () => {
    const config = storageConfigFactory();
    expect(config.driver).toBe('local');
    expect(config.localPath).toBe('uploads');
  });

  it('storage config prefers STORAGE_PATH and S3_* keys', () => {
    process.env.STORAGE_DRIVER = 's3';
    process.env.STORAGE_PATH = 'data/files';
    process.env.S3_BUCKET = 'my-bucket';
    process.env.S3_ACCESS_KEY = 'ak';
    process.env.S3_SECRET_KEY = 'sk';
    process.env.S3_REGION = 'eu-central-1';
    const config = storageConfigFactory();
    expect(config.driver).toBe('s3');
    expect(config.localPath).toBe('data/files');
    expect(config.s3.bucket).toBe('my-bucket');
    expect(config.s3.accessKeyId).toBe('ak');
    expect(config.s3.region).toBe('eu-central-1');
  });

  it('redis config reads REDIS_URL', () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    expect(redisConfigFactory().url).toBe('redis://localhost:6379');
    expect(redisConfigFactory().enabled).toBe(true);
  });

  it('oauth config maps Google and Facebook credentials', () => {
    process.env.GOOGLE_CLIENT_ID = 'google-id';
    process.env.FACEBOOK_CLIENT_ID = 'facebook-id';
    const config = oauthConfigFactory();
    expect(config.google.clientId).toBe('google-id');
    expect(config.facebook.clientId).toBe('facebook-id');
  });

  it('brand config resolves APP_NAME and colors', () => {
    process.env.APP_NAME = 'Acme';
    process.env.PRIMARY_COLOR = '#abc123';
    const config = brandConfigFactory();
    expect(config.appName).toBe('Acme');
    expect(config.primaryColor).toBe('#abc123');
  });
});
