import { emitSessionExpired } from '@/lib/session-logout';
import { beginGlobalLoading, endGlobalLoading } from '@/lib/loading-bus';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export function getApiBaseUrl(): string {
  return apiBase;
}

export class ApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(body || `API error: ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export type ApiFetchOptions = RequestInit & {
  /** When false, skip the global loading overlay (polling, silent checks). Default true. */
  showLoading?: boolean;
};

export async function apiFetch<T>(
  path: string,
  init?: ApiFetchOptions,
): Promise<T> {
  const { showLoading = true, ...requestInit } = init ?? {};
  if (showLoading) beginGlobalLoading();

  try {
    const res = await fetch(`${apiBase}${path}`, {
      ...requestInit,
      headers: {
        'Content-Type': 'application/json',
        ...requestInit.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 401) {
        emitSessionExpired();
      }
      throw new ApiError(res.status, body || `API error: ${res.status}`);
    }

    return res.json() as Promise<T>;
  } finally {
    if (showLoading) endGlobalLoading();
  }
}
