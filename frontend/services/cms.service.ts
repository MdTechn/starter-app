import { getApiBaseUrl } from '@/lib/api';
import { beginGlobalLoading, endGlobalLoading } from '@/lib/loading-bus';
import type { CmsArticleStatus } from '@saas-starter/shared';

export type CmsFolder = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  children?: CmsFolder[];
  _count?: { articles: number; children: number };
};

export type CmsTranslation = {
  id: string;
  locale: string;
  title: string;
  excerpt: string | null;
  content: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

export type CmsArticle = {
  id: string;
  folderId: string;
  slug: string;
  status: CmsArticleStatus | string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  translations: CmsTranslation[];
  folder?: { id: string; code: string; name: string };
  versions?: Array<{
    id: string;
    version: number;
    note: string | null;
    createdAt: string;
  }>;
  attachments?: Array<{
    id: string;
    originalName: string;
    mimeType: string;
    url: string;
    kind: string;
  }>;
  _count?: { versions: number };
};

export type PaginatedArticles = {
  items: CmsArticle[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

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
      throw new Error(body || `API error: ${res.status}`);
    }
    return res.json() as Promise<T>;
  } finally {
    endGlobalLoading();
  }
}

export function listFolders(token: string, tree = true) {
  return fetchJson<CmsFolder[]>(`/cms/folders${tree ? '?tree=1' : ''}`, token);
}

export function createFolder(
  token: string,
  body: {
    code: string;
    name: string;
    parentId?: string | null;
    description?: string;
    organizationId?: string;
  },
) {
  return fetchJson<CmsFolder>('/cms/folders', token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function deleteFolder(token: string, id: string) {
  return fetchJson<{ ok: boolean }>(`/cms/folders/${id}`, token, {
    method: 'DELETE',
  });
}

export function listArticles(
  token: string,
  params: {
    folderId?: string;
    status?: string;
    q?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const qs = new URLSearchParams();
  if (params.folderId) qs.set('folderId', params.folderId);
  if (params.status) qs.set('status', params.status);
  if (params.q) qs.set('q', params.q);
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const query = qs.toString();
  return fetchJson<PaginatedArticles>(
    `/cms/articles${query ? `?${query}` : ''}`,
    token,
  );
}

export function getArticle(token: string, id: string) {
  return fetchJson<CmsArticle>(`/cms/articles/${id}`, token);
}

export function createArticle(
  token: string,
  body: {
    folderId: string;
    slug: string;
    title: string;
    content: string;
    excerpt?: string;
    locale?: string;
    organizationId?: string;
  },
) {
  return fetchJson<CmsArticle>('/cms/articles', token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateArticle(
  token: string,
  id: string,
  body: {
    folderId?: string;
    slug?: string;
    status?: CmsArticleStatus | string;
  },
) {
  return fetchJson<CmsArticle>(`/cms/articles/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function publishArticle(token: string, id: string) {
  return fetchJson<CmsArticle>(`/cms/articles/${id}/publish`, token, {
    method: 'POST',
  });
}

export function archiveArticle(token: string, id: string) {
  return fetchJson<CmsArticle>(`/cms/articles/${id}/archive`, token, {
    method: 'POST',
  });
}

export function upsertTranslation(
  token: string,
  articleId: string,
  locale: string,
  body: {
    title: string;
    content: string;
    excerpt?: string | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
  },
) {
  return fetchJson<CmsArticle>(
    `/cms/articles/${articleId}/translations/${locale}`,
    token,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    },
  );
}

export function listVersions(token: string, articleId: string) {
  return fetchJson<
    Array<{
      id: string;
      version: number;
      note: string | null;
      createdAt: string;
    }>
  >(`/cms/articles/${articleId}/versions`, token);
}

export function rollbackVersion(
  token: string,
  articleId: string,
  version: number,
  note?: string,
) {
  return fetchJson<CmsArticle>(
    `/cms/articles/${articleId}/versions/${version}/rollback`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ note }),
    },
  );
}

export function attachFile(token: string, articleId: string, fileId: string) {
  return fetchJson(`/cms/articles/${articleId}/attachments`, token, {
    method: 'POST',
    body: JSON.stringify({ fileId }),
  });
}
