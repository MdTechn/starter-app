import { getApiBaseUrl } from '@/lib/api';
import { beginGlobalLoading, endGlobalLoading } from '@/lib/loading-bus';

export type AiRewriteMode =
  'ameliorer' | 'professionnel' | 'court' | 'long' | 'seo' | 'corriger';

export type AiStatus = {
  priority: string[];
  available: string[];
  active: string | null;
};

export type AiTranslatePreview = {
  ok: boolean;
  preview: true;
  provider: string;
  sourceLocale: string;
  targetLocale: string;
  tokensUsed: number;
  translation: {
    title: string;
    excerpt: string | null;
    content: string;
  };
};

export type AiRewriteResult = {
  ok: boolean;
  provider: string;
  mode: AiRewriteMode;
  tokensUsed: number;
  text: string;
  truncated?: boolean;
};

export type AiUsageReport = {
  startDate: string | null;
  endDate: string | null;
  userId: string | null;
  totalRequests: number;
  totalTokens: number;
  byProvider: Array<{ provider: string; requests: number; tokens: number }>;
  byOperation: Array<{ operation: string; requests: number; tokens: number }>;
};

/** Parse NestJS / throttler JSON error bodies into a readable message. */
export function parseApiErrorMessage(body: string, status: number): string {
  const trimmed = body?.trim();
  if (!trimmed) {
    if (status === 429)
      return 'Trop de requêtes IA. Réessayez dans une minute.';
    return `Erreur API (${status})`;
  }

  try {
    const json = JSON.parse(trimmed) as {
      message?: string | string[];
      code?: string;
      error?: string;
      statusCode?: number;
      used?: number;
      quota?: number;
    };

    if (json.code === 'AI_DAILY_QUOTA_EXCEEDED') {
      const used = json.used ?? '?';
      const quota = json.quota ?? '?';
      return `Quota IA journalier atteint (${used}/${quota} tokens).`;
    }

    if (status === 429) {
      const msg = Array.isArray(json.message)
        ? json.message.join(', ')
        : json.message;
      if (msg?.toLowerCase().includes('throttl') || msg?.includes('Too Many')) {
        return 'Limite de débit IA (10 req/min). Patientez puis réessayez.';
      }
      return msg || 'Trop de requêtes IA (429).';
    }

    if (Array.isArray(json.message)) return json.message.join(', ');
    if (typeof json.message === 'string' && json.message.trim()) {
      return json.message;
    }
    if (typeof json.error === 'string' && json.error.trim()) {
      return json.error;
    }
  } catch {
    // plain text body
  }

  if (trimmed.length > 280) return `${trimmed.slice(0, 280)}…`;
  return trimmed;
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function fetchJson<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  beginGlobalLoading();
  try {
    const res = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers: {
        ...authHeaders(token),
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(parseApiErrorMessage(body, res.status));
    }
    return res.json() as Promise<T>;
  } finally {
    endGlobalLoading();
  }
}

export function getAiStatus(token: string) {
  return fetchJson<AiStatus>('/ai/status', token);
}

export function getAiUsage(
  token: string,
  params: { startDate?: string; endDate?: string; userId?: string } = {},
) {
  const qs = new URLSearchParams();
  if (params.startDate) qs.set('startDate', params.startDate);
  if (params.endDate) qs.set('endDate', params.endDate);
  if (params.userId) qs.set('userId', params.userId);
  const query = qs.toString();
  return fetchJson<AiUsageReport>(
    `/ai/usage${query ? `?${query}` : ''}`,
    token,
  );
}

export function translateArticle(
  token: string,
  body: { articleId: string; sourceLocale: string; targetLocale: string },
) {
  return fetchJson<AiTranslatePreview>('/ai/translate', token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function rewriteText(
  token: string,
  body: { text: string; mode: AiRewriteMode },
) {
  return fetchJson<AiRewriteResult>('/ai/rewrite', token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
