import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageDriver } from '@saas-starter/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../redis/redis.module';
import { JobsService } from '../jobs/jobs.service';
import { mailConfigFactory } from '../../config/mail.config';
import { storageConfigFactory } from '../../config/storage.config';
import { stripeConfigFactory } from '../../config/stripe.config';
import { keycloakConfigFactory } from '../../config/keycloak.config';

export type ProbeStatus = 'up' | 'down' | 'degraded' | 'skipped';

export type ServiceProbe = {
  name: string;
  status: ProbeStatus;
  detail?: string;
  latencyMs?: number;
};

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jobs: JobsService,
    private readonly config: ConfigService,
  ) {}

  live() {
    return {
      ok: true,
      status: 'alive',
      service: 'api',
      timestamp: new Date().toISOString(),
    };
  }

  async ready() {
    const checks = await this.runCoreChecks();
    const criticalDown = checks.some(
      (c) =>
        (c.name === 'database' || c.name === 'redis') && c.status === 'down',
    );
    // Redis down is degraded if optional; DB down = not ready
    const dbDown = checks.find((c) => c.name === 'database')?.status === 'down';
    const ok = !dbDown;
    return {
      ok,
      status: ok ? (criticalDown ? 'degraded' : 'ready') : 'not_ready',
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  async detailed() {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkStorage(),
      this.checkSmtp(),
      this.checkStripe(),
      this.checkKeycloak(),
      this.checkJobs(),
    ]);

    const down = checks.filter((c) => c.status === 'down').length;
    const degraded = checks.filter((c) => c.status === 'degraded').length;
    const ok = down === 0;

    return {
      ok,
      status: ok ? (degraded ? 'degraded' : 'healthy') : 'unhealthy',
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  private async runCoreChecks() {
    return Promise.all([this.checkDatabase(), this.checkRedis()]);
  }

  private async timed(
    name: string,
    fn: () => Promise<Omit<ServiceProbe, 'name' | 'latencyMs'>>,
  ): Promise<ServiceProbe> {
    const started = Date.now();
    try {
      const result = await fn();
      return { name, ...result, latencyMs: Date.now() - started };
    } catch (err) {
      return {
        name,
        status: 'down',
        detail: err instanceof Error ? err.message : String(err),
        latencyMs: Date.now() - started,
      };
    }
  }

  checkDatabase() {
    return this.timed('database', async () => {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up' as const };
    });
  }

  checkRedis() {
    return this.timed('redis', async () => {
      const redisCfg = this.config.get<{ enabled?: boolean }>('redis');
      if (!redisCfg?.enabled) {
        return { status: 'skipped' as const, detail: 'REDIS not configured' };
      }
      const ok = await this.redis.ping();
      return ok
        ? { status: 'up' as const }
        : { status: 'down' as const, detail: 'ping failed' };
    });
  }

  checkStorage() {
    return this.timed('storage', async () => {
      const storage = storageConfigFactory();
      if (storage.driver === StorageDriver.CLOUDINARY) {
        return {
          status: 'degraded' as const,
          detail: 'cloudinary stub',
        };
      }
      if (storage.driver === StorageDriver.S3) {
        const ready = Boolean(
          storage.s3.bucket &&
          storage.s3.accessKeyId &&
          storage.s3.secretAccessKey,
        );
        return ready
          ? { status: 'up' as const, detail: 's3 configured' }
          : { status: 'degraded' as const, detail: 's3 incomplete' };
      }
      return { status: 'up' as const, detail: `local:${storage.localPath}` };
    });
  }

  checkSmtp() {
    return this.timed('smtp', async () => {
      const mail = mailConfigFactory();
      if (!mail.host || !mail.from) {
        return { status: 'skipped' as const, detail: 'SMTP not configured' };
      }
      return { status: 'up' as const, detail: mail.host };
    });
  }

  checkStripe() {
    return this.timed('stripe', async () => {
      const stripe = stripeConfigFactory();
      if (!stripe.secretKey) {
        return { status: 'skipped' as const, detail: 'Stripe not configured' };
      }
      return {
        status: 'up' as const,
        detail: stripe.webhookSecret ? 'secret+webhook' : 'secret only',
      };
    });
  }

  checkKeycloak() {
    return this.timed('keycloak', async () => {
      const kc = keycloakConfigFactory();
      if (!kc.enabled) {
        return { status: 'skipped' as const, detail: 'Keycloak disabled' };
      }
      const discovery = kc.issuer
        ? `${kc.issuer.replace(/\/$/, '')}/.well-known/openid-configuration`
        : kc.url && kc.realm
          ? `${kc.url.replace(/\/$/, '')}/realms/${kc.realm}/.well-known/openid-configuration`
          : null;
      if (!discovery) {
        return { status: 'degraded' as const, detail: 'missing URL' };
      }
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(discovery, { signal: controller.signal });
        clearTimeout(timer);
        return res.ok
          ? { status: 'up' as const }
          : { status: 'degraded' as const, detail: `HTTP ${res.status}` };
      } catch (err) {
        return {
          status: 'down' as const,
          detail: err instanceof Error ? err.message : String(err),
        };
      }
    });
  }

  checkJobs() {
    return this.timed('jobs', async () => {
      return {
        status: this.jobs.isEnabled() ? ('up' as const) : ('skipped' as const),
        detail: this.jobs.isEnabled() ? 'bullmq' : 'sync fallback',
      };
    });
  }
}
