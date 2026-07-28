import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';
import { ObservabilityConfig } from '../../config/observability.config';
import { AppLogger } from '../../common/logger/app-logger.service';

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();
  private httpRequests!: Counter<string>;
  private httpDuration!: Histogram<string>;
  private aiRequests!: Counter<string>;
  private aiTokens!: Counter<string>;
  private aiDuration!: Histogram<string>;
  private enabled = true;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(MetricsService.name);
  }

  onModuleInit() {
    const obs = this.config.get<ObservabilityConfig>('observability');
    this.enabled = obs?.metrics.enabled !== false;
    if (!this.enabled) {
      this.logger.warn('Prometheus metrics disabled');
      return;
    }

    this.registry.setDefaultLabels(obs?.metrics.defaultLabels ?? {});
    collectDefaultMetrics({ register: this.registry });

    this.httpRequests = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'path', 'status'],
      registers: [this.registry],
    });

    this.httpDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.aiRequests = new Counter({
      name: 'ai_requests_total',
      help: 'Total AI provider calls (translate / rewrite)',
      labelNames: ['operation', 'provider', 'status'],
      registers: [this.registry],
    });

    this.aiTokens = new Counter({
      name: 'ai_tokens_total',
      help: 'Total AI tokens consumed',
      labelNames: ['operation', 'provider'],
      registers: [this.registry],
    });

    this.aiDuration = new Histogram({
      name: 'ai_request_duration_seconds',
      help: 'AI provider call duration in seconds',
      labelNames: ['operation', 'provider', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
      registers: [this.registry],
    });

    this.logger.log('Prometheus metrics registry ready');
  }

  isEnabled() {
    return this.enabled;
  }

  observeHttp(method: string, path: string, status: number, seconds: number) {
    if (!this.enabled || !this.httpRequests) return;
    const route = this.normalizePath(path);
    const labels = {
      method,
      path: route,
      status: String(status),
    };
    this.httpRequests.inc(labels);
    this.httpDuration.observe(labels, seconds);
  }

  observeAi(input: {
    operation: string;
    provider: string;
    status: 'success' | 'error';
    tokens?: number;
    seconds: number;
  }) {
    if (!this.enabled || !this.aiRequests) return;
    const labels = {
      operation: input.operation,
      provider: input.provider,
      status: input.status,
    };
    this.aiRequests.inc(labels);
    this.aiDuration.observe(labels, input.seconds);
    if (input.status === 'success' && (input.tokens ?? 0) > 0) {
      this.aiTokens.inc(
        { operation: input.operation, provider: input.provider },
        input.tokens,
      );
    }
  }

  async metricsText(): Promise<string> {
    if (!this.enabled) return '# metrics disabled\n';
    return this.registry.metrics();
  }

  private normalizePath(path: string) {
    const clean = path.split('?')[0] ?? path;
    return clean
      .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '/:id')
      .replace(/\/[a-z0-9]{20,}/gi, '/:id')
      .replace(/\/\d+/g, '/:id');
  }
}
