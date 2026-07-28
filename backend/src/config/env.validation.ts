import { z } from 'zod';

const booleanFromEnv = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (typeof v === 'boolean') return v;
    return v === 'true' || v === '1';
  });

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  API_PREFIX: z.string().default('api'),
  API_URL: z.string().url().optional(),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_MIGRATE_URL: z.string().optional(),
  LOG_LEVEL: z
    .enum(['error', 'warn', 'log', 'debug', 'verbose'])
    .default('log'),
  SWAGGER_ENABLED: booleanFromEnv,
  SWAGGER_PATH: z.string().default('docs'),

  // JWT
  JWT_SECRET: z.string().optional(),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // Keycloak
  KEYCLOAK_ENABLED: booleanFromEnv,
  KEYCLOAK_URL: z.string().optional(),
  KEYCLOAK_REALM: z.string().optional(),
  KEYCLOAK_ISSUER: z.string().optional(),
  KEYCLOAK_CLIENT_ID: z.string().optional(),
  KEYCLOAK_CLIENT_SECRET: z.string().optional(),
  KEYCLOAK_AUDIENCE: z.string().optional(),
  KEYCLOAK_JWKS_URI: z.string().optional(),
  KEYCLOAK_ADMIN_URL: z.string().optional(),
  KEYCLOAK_ADMIN_USER: z.string().optional(),
  KEYCLOAK_ADMIN_PASSWORD: z.string().optional(),

  // Frontend auth (NextAuth / OIDC)
  AUTH_SECRET: z.string().optional(),
  AUTH_KEYCLOAK_ID: z.string().optional(),
  AUTH_KEYCLOAK_SECRET: z.string().optional(),
  AUTH_KEYCLOAK_ISSUER: z.string().optional(),

  // OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  FACEBOOK_CLIENT_ID: z.string().optional(),
  FACEBOOK_CLIENT_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PUBLIC_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_PRICE_STARTER_MONTHLY: z.string().optional(),
  STRIPE_PRICE_STARTER_YEARLY: z.string().optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PRO_YEARLY: z.string().optional(),
  STRIPE_CHECKOUT_SUCCESS_URL: z.string().optional(),
  STRIPE_CHECKOUT_CANCEL_URL: z.string().optional(),
  STRIPE_PORTAL_RETURN_URL: z.string().optional(),

  // Mail
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: booleanFromEnv,
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // Storage
  STORAGE_DRIVER: z.enum(['local', 's3', 'cloudinary']).default('local'),
  STORAGE_PATH: z.string().optional(),
  STORAGE_LOCAL_PATH: z.string().default('uploads'),
  STORAGE_PUBLIC_BASE_URL: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: booleanFromEnv,
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // Redis
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().optional(),
  REDIS_KEY_PREFIX: z.string().optional(),

  // Cache
  CACHE_ENABLED: booleanFromEnv,
  CACHE_TTL_SECONDS: z.coerce.number().optional(),
  CACHE_PREFIX: z.string().optional(),

  // Observability
  PROMETHEUS_ENABLED: booleanFromEnv,
  PROMETHEUS_METRICS_PATH: z.string().optional(),
  PROMETHEUS_APP_NAME: z.string().optional(),
  OTEL_ENABLED: booleanFromEnv,
  OTEL_SERVICE_NAME: z.string().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  HTTP_TIMEOUT_MS: z.coerce.number().optional(),
  HTTP_COMPRESSION: booleanFromEnv,
  API_VERSION: z.string().optional(),

  // White-label branding
  APP_NAME: z.string().optional(),
  NEXT_PUBLIC_APP_NAME: z.string().optional(),
  COMPANY_NAME: z.string().optional(),
  APP_URL: z.string().optional(),
  LOGO_URL: z.string().optional(),
  FAVICON_URL: z.string().optional(),
  PRIMARY_COLOR: z.string().optional(),
  SECONDARY_COLOR: z.string().optional(),
  BRAND_THEME: z.enum(['light', 'dark']).optional(),
  BRAND_FONT: z.string().optional(),
  FONT_FAMILY: z.string().optional(),
  ICON_URL: z.string().optional(),
  APPLE_TOUCH_ICON_URL: z.string().optional(),
  SUPPORT_EMAIL: z.string().optional(),
  SUPPORT_URL: z.string().optional(),
  META_DESCRIPTION: z.string().optional(),

  // AI providers (CMS translate / rewrite) — keys never hardcoded
  AI_PROVIDER_PRIORITY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GROQ_BASE_URL: z.string().optional(),
  GROQ_MODEL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  AI_TIMEOUT_MS: z.coerce.number().optional(),
  AI_MAX_INPUT_CHARS: z.coerce.number().optional(),
  AI_DAILY_TOKEN_QUOTA: z.coerce.number().optional(),
  AI_RATE_LIMIT: z.coerce.number().optional(),
  AI_RATE_LIMIT_TTL_MS: z.coerce.number().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Valide et normalise les variables d'environnement au démarrage.
 * Utilisé par ConfigModule.forRoot({ validate }).
 */
export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return parsed.data;
}
