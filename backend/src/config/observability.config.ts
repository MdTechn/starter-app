import { registerAs } from '@nestjs/config';

export const observabilityConfigFactory = () => ({
  metrics: {
    enabled: process.env.PROMETHEUS_ENABLED !== 'false',
    path: process.env.PROMETHEUS_METRICS_PATH ?? 'metrics',
    defaultLabels: {
      app: process.env.PROMETHEUS_APP_NAME ?? 'saas-starter-api',
    },
  },
  otel: {
    enabled: process.env.OTEL_ENABLED === 'true',
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'saas-starter-api',
    exporterEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? '',
  },
  http: {
    timeoutMs: Number(process.env.HTTP_TIMEOUT_MS ?? 30_000),
    compression: process.env.HTTP_COMPRESSION !== 'false',
  },
  api: {
    version: process.env.API_VERSION ?? '1',
  },
});

export type ObservabilityConfig = ReturnType<typeof observabilityConfigFactory>;

export default registerAs('observability', observabilityConfigFactory);
