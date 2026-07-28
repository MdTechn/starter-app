import {
  CallHandler,
  ExecutionContext,
  GatewayTimeoutException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { ObservabilityConfig } from '../../config/observability.config';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly config: ConfigService) {}

  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const ms =
      this.config.get<ObservabilityConfig>('observability')?.http.timeoutMs ??
      30_000;

    return next.handle().pipe(
      timeout(ms),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(
            () =>
              new GatewayTimeoutException({
                code: 'REQUEST_TIMEOUT',
                message: `Request exceeded ${ms}ms`,
              }),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}
