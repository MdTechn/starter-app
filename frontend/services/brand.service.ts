import { apiFetch } from '@/lib/api';
import type { BrandConfig } from '@saas-starter/shared';

export type BrandPreview = {
  brand: BrandConfig;
  defaults: BrandConfig;
  assetsRoot: string;
  assetsAvailable: boolean;
  cssVariables: Record<string, string>;
};

export type UpdateBrandPayload = Partial<{
  appName: string;
  companyName: string;
  appUrl: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  theme: 'light' | 'dark';
  fontFamily: string;
  supportEmail: string;
  supportUrl: string;
  metaDescription: string;
}>;

export function getBrandConfig() {
  return apiFetch<BrandConfig>('/brand', { showLoading: false });
}

export function getBrandPreview(token: string) {
  return apiFetch<BrandPreview>('/brand/preview', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function updateBrandConfig(token: string, body: UpdateBrandPayload) {
  return apiFetch<BrandConfig>('/brand', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

export async function uploadBrandLogo(token: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
  const res = await fetch(`${apiBase}/brand/logo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Upload logo failed (${res.status})`);
  }
  return (await res.json()) as BrandConfig;
}
