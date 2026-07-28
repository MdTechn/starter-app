import { INestApplication } from '@nestjs/common';
import { AppLogger } from '../logger/app-logger.service';

/**
 * Graceful shutdown: stop accepting traffic, flush, exit.
 */
export function setupGracefulShutdown(
  app: INestApplication,
  logger: AppLogger,
) {
  const shutdown = async (signal: string) => {
    logger.log(`Graceful shutdown initiated (${signal})`);
    try {
      await app.close();
      logger.log('Nest application closed');
      process.exit(0);
    } catch (err) {
      logger.error(
        'Shutdown error',
        err instanceof Error ? err.stack : undefined,
      );
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}
