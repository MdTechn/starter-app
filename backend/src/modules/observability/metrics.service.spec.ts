import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from './metrics.service';
import { AppLogger } from '../../common/logger/app-logger.service';

describe('MetricsService', () => {
  let metrics: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        {
          provide: ConfigService,
          useValue: {
            get: () => ({
              metrics: {
                enabled: true,
                path: 'metrics',
                defaultLabels: { app: 'test' },
              },
              otel: { enabled: false },
              http: { timeoutMs: 1000, compression: true },
              api: { version: '1' },
            }),
          },
        },
        {
          provide: AppLogger,
          useValue: {
            setContext: jest.fn(),
            log: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    metrics = module.get(MetricsService);
    metrics.onModuleInit();
  });

  it('exposes prometheus text with http metrics', async () => {
    metrics.observeHttp('GET', '/api/health', 200, 0.01);
    metrics.observeAi({
      operation: 'translate',
      provider: 'groq',
      status: 'success',
      tokens: 12,
      seconds: 0.4,
    });
    const text = await metrics.metricsText();
    expect(text).toContain('http_requests_total');
    expect(text).toContain('ai_requests_total');
    expect(text).toContain('ai_tokens_total');
    expect(metrics.isEnabled()).toBe(true);
  });
});
