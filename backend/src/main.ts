import { config as loadEnv } from 'dotenv';
import { join } from 'path';

// Charge le .env à la racine du monorepo avant tout import Nest.
loadEnv({ path: join(__dirname, '../../.env') });
loadEnv({ path: join(__dirname, '../../.env.local'), override: true });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import * as compression from 'compression';
import { AppModule } from './app.module';
import { AppLogger } from './common/logger/app-logger.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { setupGracefulShutdown } from './common/resilience/graceful-shutdown';
import { MetricsService } from './modules/observability/metrics.service';
import { ObservabilityConfig } from './config/observability.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  const config = app.get(ConfigService);
  const logger = app.get(AppLogger);
  const metrics = app.get(MetricsService);
  app.useLogger(logger);

  const obs = config.get<ObservabilityConfig>('observability');
  if (obs?.http.compression !== false) {
    app.use(compression());
  }

  const requestIdMiddleware = new RequestIdMiddleware();
  app.use((req: Request, res: Response, next: NextFunction) =>
    requestIdMiddleware.use(req, res, next),
  );

  // API versioning alias (non-breaking): /api/v1/* → /api/*
  const apiVersion = obs?.api.version ?? '1';
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const prefix = `/api/v${apiVersion}`;
    if (req.url === prefix || req.url.startsWith(`${prefix}/`)) {
      req.url = req.url.replace(prefix, '/api');
    }
    next();
  });

  const apiPrefix = config.get<string>('API_PREFIX', 'api');
  const metricsPath = obs?.metrics.path ?? 'metrics';
  app.setGlobalPrefix(apiPrefix, {
    exclude: [{ path: metricsPath, method: RequestMethod.GET }],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter(logger));
  app.useGlobalInterceptors(
    new LoggingInterceptor(logger, metrics),
    new TimeoutInterceptor(config),
  );

  const frontendUrl = config.get<string>(
    'FRONTEND_URL',
    'http://localhost:3000',
  );
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  const swaggerEnabled =
    config.get<boolean>('SWAGGER_ENABLED') ??
    config.get<string>('NODE_ENV') !== 'production';

  if (swaggerEnabled) {
    const swaggerPath = config.get<string>('SWAGGER_PATH', 'docs');
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('SaaS Starter API')
        .setDescription('API documentation — SaaS Starter')
        .setVersion(apiVersion)
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup(swaggerPath, app, document);
    logger.log(
      `Swagger: http://localhost:${config.get('PORT', 3001)}/${swaggerPath}`,
    );
  }

  setupGracefulShutdown(app, logger);

  const port = config.get<number>('PORT', 3001);
  await app.listen(port);
  logger.log(`API NestJS: http://localhost:${port}/${apiPrefix}`);
  logger.log(
    `Health: /${apiPrefix}/health/live | /${apiPrefix}/health/ready | Metrics: /${metricsPath}`,
  );
}

bootstrap();
