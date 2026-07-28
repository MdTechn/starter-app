import { registerAs } from '@nestjs/config';

export const databaseConfigFactory = () => ({
  url: process.env.DATABASE_URL ?? '',
  migrateUrl: process.env.DATABASE_MIGRATE_URL,
});

export default registerAs('database', databaseConfigFactory);
