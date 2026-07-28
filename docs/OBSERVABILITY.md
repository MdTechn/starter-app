# Observabilité & Industrialisation (Epic 8)

Starter prêt production : Redis, BullMQ, health, métriques, OTEL minimal,
cache, compression, versioning API, idempotence webhooks, graceful shutdown.

## Architecture

```
Request
  → RequestIdMiddleware (x-request-id)
  → compression
  → /api/v1/* rewrite → /api/*
  → TimeoutInterceptor
  → LoggingInterceptor (JSON + Prometheus)
  → Controllers

RedisModule → CacheModule (fallback mémoire)
           → JobsModule (BullMQ ou sync)
ObservabilityModule → /metrics + OtelService
HealthModule → live / ready / status
```

## Redis

```env
REDIS_URL=redis://localhost:6379
# ou REDIS_HOST / REDIS_PORT / REDIS_PASSWORD / REDIS_DB
REDIS_KEY_PREFIX=saas:
```

Docker Compose inclut un service `redis:7-alpine` (dev + prod).

Sans Redis : cache mémoire + jobs synchrones (pas de breaking change).

## Cache

```env
CACHE_ENABLED=true
CACHE_TTL_SECONDS=60
CACHE_PREFIX=cache:
```

API : `CacheService.get/set/del/invalidatePrefix`.

## BullMQ

Queues : `notifications`, `default`.

```env
BULLMQ_CONCURRENCY=5
```

Retries : 3 tentatives, backoff exponentiel (2s).  
Les notifications utilisent BullMQ si Redis est configuré, sinon `SyncNotificationQueue`.

## Health

| Route | Auth | Rôle |
|-------|------|------|
| `GET /api/health` / `.../live` | public | liveness |
| `GET /api/health/ready` | public | readiness (DB) |
| `GET /api/health/db` | public | legacy DB |
| `GET /api/health/status` | `system:read` | détail admin |

Probes : database, redis, storage, smtp, stripe, keycloak, jobs.

## Métriques Prometheus

```env
PROMETHEUS_ENABLED=true
PROMETHEUS_METRICS_PATH=metrics
PROMETHEUS_APP_NAME=saas-starter-api
```

Endpoint scrape : `GET /metrics` (hors préfixe `/api`).

Séries : `http_requests_total`, `http_request_duration_seconds` + defaults Node.

## OpenTelemetry

```env
OTEL_ENABLED=true
OTEL_SERVICE_NAME=saas-starter-api
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
```

Structure minimale (`BasicTracerProvider` + console exporter). Brancher un
exporteur OTLP en déploiement.

## Performance

- Compression HTTP (`HTTP_COMPRESSION=true`)
- Timeout global (`HTTP_TIMEOUT_MS=30000`)
- Alias versionné non breaking : `/api/v1/*` → `/api/*` (`API_VERSION=1`)
- Pagination standard : `normalizePagination` + `toPaginated` (`@saas-starter/shared`)

## Résilience

- Idempotence webhooks Stripe → table `processed_webhook_events`
- Retry jobs BullMQ
- `CircuitBreaker` (structure) dans `common/resilience/`
- Graceful shutdown SIGTERM/SIGINT

## Frontend

`/admin/system` — statut des services (ADMIN / `system:read`).

## Déploiement production

1. `docker compose -f docker-compose.prod.yml up -d` (postgres + redis + api + web)
2. `REDIS_URL=redis://redis:6379`
3. Sonde K8s / LB :
   - liveness : `/api/health/live`
   - readiness : `/api/health/ready`
4. Scrape Prometheus : `/metrics`
5. Logs JSON avec `requestId` (corrélation)

Voir aussi `.env.example` (`REDIS_*`, `CACHE_*`, `OTEL_*`, `PROMETHEUS_*`).
