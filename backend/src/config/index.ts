import databaseConfig from './database.config';
import jwtConfig from './jwt.config';
import keycloakConfig from './keycloak.config';
import stripeConfig from './stripe.config';
import mailConfig from './mail.config';
import storageConfig from './storage.config';
import redisConfig from './redis.config';
import cacheConfig from './cache.config';
import observabilityConfig from './observability.config';
import oauthConfig from './oauth.config';
import brandConfig from './brand.config';
import aiConfig from './ai.config';

export { validateEnv, type EnvConfig } from './env.validation';

export const configLoads = [
  databaseConfig,
  jwtConfig,
  keycloakConfig,
  stripeConfig,
  mailConfig,
  storageConfig,
  redisConfig,
  cacheConfig,
  observabilityConfig,
  oauthConfig,
  brandConfig,
  aiConfig,
];

export {
  databaseConfig,
  jwtConfig,
  keycloakConfig,
  stripeConfig,
  mailConfig,
  storageConfig,
  redisConfig,
  cacheConfig,
  observabilityConfig,
  oauthConfig,
  brandConfig,
  aiConfig,
};
