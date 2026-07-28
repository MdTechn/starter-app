import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { AppLogger } from '../logger/app-logger.service';
import { MetricsService } from '../../modules/observability/metrics.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: AppLogger,
    private readonly metrics: MetricsService,
  ) {
    this.logger.setContext('HTTP');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { requestId?: string }>();
    const response = http.getResponse<Response>();
    const started = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - started;
          this.logger.log(
            `${request.method} ${request.url} ${response.statusCode} ${ms}ms`,
          );
          this.metrics.observeHttp(
            request.method,
            request.route?.path
              ? `${request.baseUrl}${request.route.path}`
              : request.url,
            response.statusCode,
            ms / 1000,
          );
        },
        error: (err: unknown) => {
          const ms = Date.now() - started;
          const status =
            typeof err === 'object' &&
            err &&
            'status' in err &&
            typeof (err as { status: unknown }).status === 'number'
              ? (err as { status: number }).status
              : 500;
          this.logger.warn(
            `${request.method} ${request.url} failed after ${ms}ms`,
          );
          this.metrics.observeHttp(
            request.method,
            request.url,
            status,
            ms / 1000,
          );
        },
      }),
    );
  }
}
