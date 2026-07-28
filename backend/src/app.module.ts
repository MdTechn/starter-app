import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { validateEnv, configLoads } from './config';
import { AppLoggerModule } from './common/logger/app-logger.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { EventsModule } from './common/events/events.module';
import { RedisModule } from './modules/redis/redis.module';
import { CacheModule } from './modules/cache/cache.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { ObservabilityModule } from './modules/observability/observability.module';
import {
  AuthModule,
  AdminModule,
  HealthModule,
  KeycloakModule,
  NotificationsModule,
  OrganizationsModule,
  PaymentsModule,
  StorageModule,
  UsersModule,
  BrandModule,
  CmsModule,
  AiModule,
} from './modules';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env', '../.env.local', '../.env'],
      validate: validateEnv,
      load: configLoads,
    }),
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      maxListeners: 20,
    }),
    AppLoggerModule,
    PrismaModule,
    RedisModule,
    CacheModule,
    JobsModule,
    ObservabilityModule,
    EventsModule,
    HealthModule,
    BrandModule,
    AuthModule,
    UsersModule,
    KeycloakModule,
    AdminModule,
    OrganizationsModule,
    PaymentsModule,
    NotificationsModule,
    StorageModule,
    CmsModule,
    AiModule,
  ],
})
export class AppModule {}
