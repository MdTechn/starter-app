import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { context, trace, SpanStatusCode, Tracer } from '@opentelemetry/api';
import {
  BasicTracerProvider,
  SimpleSpanProcessor,
  ConsoleSpanExporter,
} from '@opentelemetry/sdk-trace-base';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { ObservabilityConfig } from '../../config/observability.config';
import { AppLogger } from '../../common/logger/app-logger.service';

/**
 * Minimal OpenTelemetry bootstrap.
 * When OTEL_ENABLED=true, registers a BasicTracerProvider.
 * OTLP exporter can be wired later via OTEL_EXPORTER_OTLP_ENDPOINT.
 */
@Injectable()
export class OtelService implements OnModuleInit {
  private tracer: Tracer = trace.getTracer('saas-starter');
  private enabled = false;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(OtelService.name);
  }

  onModuleInit() {
    const otel = this.config.get<ObservabilityConfig>('observability')?.otel;
    this.enabled = otel?.enabled === true;
    if (!this.enabled) {
      this.logger.debug('OpenTelemetry disabled');
      return;
    }

    const provider = new BasicTracerProvider({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: otel?.serviceName ?? 'saas-starter-api',
      }),
      spanProcessors: [new SimpleSpanProcessor(new ConsoleSpanExporter())],
    });

    if (otel?.exporterEndpoint) {
      this.logger.log(
        `OTEL OTLP endpoint configured (${otel.exporterEndpoint}) — wire exporter package in deployment`,
      );
    }

    trace.setGlobalTracerProvider(provider);
    this.tracer = trace.getTracer(otel?.serviceName ?? 'saas-starter-api');
    this.logger.log('OpenTelemetry tracer registered');
  }

  isEnabled() {
    return this.enabled;
  }

  async withSpan<T>(
    name: string,
    fn: () => Promise<T>,
    attributes?: Record<string, string>,
  ): Promise<T> {
    if (!this.enabled) return fn();
    return this.tracer.startActiveSpan(name, async (span) => {
      try {
        if (attributes) {
          for (const [k, v] of Object.entries(attributes)) {
            span.setAttribute(k, v);
          }
        }
        const result = await fn();
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (err) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : String(err),
        });
        throw err;
      } finally {
        span.end();
      }
    });
  }

  currentTraceId(): string | undefined {
    const span = trace.getSpan(context.active());
    return span?.spanContext().traceId;
  }
}
