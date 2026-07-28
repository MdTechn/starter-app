import { getApiBaseUrl } from '@/lib/api';
import { beginGlobalLoading, endGlobalLoading } from '@/lib/loading-bus';
import type { FileUploadKind } from '@saas-starter/shared';

export type FileAssetRow = {
  id: string;
  key: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  kind: string;
  driver: string;
  url: string;
  ownerType: string | null;
  ownerId: string | null;
  createdAt: string;
};

export type UploadProgress = {
  loaded: number;
  total: number;
  percent: number;
};

export function listFiles(token: string, limit = 50) {
  return fetchJson<FileAssetRow[]>(`/storage/files?limit=${limit}`, token);
}

export function deleteFile(token: string, id: string) {
  return fetchJson<{ ok: boolean; id: string }>(`/storage/${id}`, token, {
    method: 'DELETE',
  });
}

export function getStorageDriver(token: string) {
  return fetchJson<{ driver: string }>('/storage/driver', token);
}

/**
 * Multipart upload with XHR for progress events.
 */
export function uploadFile(
  token: string,
  file: File,
  kind: FileUploadKind | string,
  options?: {
    ownerType?: string;
    ownerId?: string;
    onProgress?: (progress: UploadProgress) => void;
  },
): Promise<FileAssetRow> {
  const form = new FormData();
  form.append('file', file);
  form.append('kind', kind);
  if (options?.ownerType) form.append('ownerType', options.ownerType);
  if (options?.ownerId) form.append('ownerId', options.ownerId);

  beginGlobalLoading();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${getApiBaseUrl()}/storage/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    const finish = () => endGlobalLoading();

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !options?.onProgress) return;
      options.onProgress({
        loaded: event.loaded,
        total: event.total,
        percent: Math.round((event.loaded / event.total) * 100),
      });
    };

    xhr.onload = () => {
      finish();
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as FileAssetRow);
        } catch {
          reject(new Error('Invalid upload response'));
        }
        return;
      }
      reject(new Error(xhr.responseText || `Upload failed: ${xhr.status}`));
    };

    xhr.onerror = () => {
      finish();
      reject(new Error('Network error during upload'));
    };
    xhr.send(form);
  });
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
        Authorization: `Bearer ${token}`,
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
