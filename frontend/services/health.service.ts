import { apiFetch } from '@/lib/api';

export type HealthStatus = {
  ok: boolean;
  status?: string;
  service?: string;
  timestamp?: string;
};

export type ServiceProbe = {
  name: string;
  status: 'up' | 'down' | 'degraded' | 'skipped';
  detail?: string;
  latencyMs?: number;
};

export type SystemStatus = {
  ok: boolean;
  status: string;
  checks: ServiceProbe[];
  timestamp: string;
};

export async function getHealthStatus(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>('/health', { showLoading: false });
}

export async function getReadyStatus(): Promise<
  HealthStatus & { checks?: ServiceProbe[] }
> {
  return apiFetch('/health/ready', { showLoading: false });
}

export async function getSystemStatus(token: string): Promise<SystemStatus> {
  return apiFetch<SystemStatus>('/health/status', {
    headers: { Authorization: `Bearer ${token}` },
    showLoading: false,
  });
}
