import type { MetadataRoute } from 'next';
import { resolveBrandConfig } from '@saas-starter/shared';

export default function manifest(): MetadataRoute.Manifest {
  const brand = resolveBrandConfig({
    APP_NAME: process.env.APP_NAME,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    META_DESCRIPTION:
      process.env.META_DESCRIPTION ?? process.env.NEXT_PUBLIC_META_DESCRIPTION,
    PRIMARY_COLOR:
      process.env.PRIMARY_COLOR ?? process.env.NEXT_PUBLIC_PRIMARY_COLOR,
    ICON_URL: process.env.ICON_URL ?? process.env.NEXT_PUBLIC_ICON_URL,
    BRAND_THEME: process.env.BRAND_THEME ?? process.env.NEXT_PUBLIC_BRAND_THEME,
  });

  return {
    name: brand.appName,
    short_name: brand.appName,
    description: brand.metaDescription,
    start_url: '/',
    display: 'standalone',
    background_color: brand.theme === 'light' ? '#f4f7fb' : '#0f1419',
    theme_color: brand.primaryColor,
    icons: [
      {
        src: brand.iconUrl,
        sizes: '192x192',
        type: 'image/svg+xml',
      },
      {
        src: '/branding/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
      },
    ],
  };
}
