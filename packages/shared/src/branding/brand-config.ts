export type BrandTheme = 'light' | 'dark';

/**
 * White-label branding — resolved from env + branding/ assets.
 * Changing brand never requires code edits.
 */
export type BrandConfig = {
  appName: string;
  companyName: string;
  appUrl: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  theme: BrandTheme;
  fontFamily: string;
  iconUrl: string;
  appleTouchIconUrl: string;
  supportEmail: string;
  supportUrl: string;
  metaDescription: string;
};

export type BrandEnvInput = Record<string, string | undefined>;

const DEFAULTS: BrandConfig = {
  appName: 'SaaS Starter',
  companyName: 'SaaS Starter Inc.',
  appUrl: 'http://localhost:3000',
  logoUrl: '/branding/logo.svg',
  faviconUrl: '/branding/favicon.svg',
  primaryColor: '#3d9cf0',
  secondaryColor: '#1e3a5f',
  theme: 'light',
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  iconUrl: '/branding/icon-192.svg',
  appleTouchIconUrl: '/branding/apple-touch-icon.svg',
  supportEmail: 'support@example.com',
  supportUrl: 'http://localhost:3000',
  metaDescription: 'Next.js + NestJS + Prisma SaaS starter',
};

function pick(env: BrandEnvInput, keys: string[], fallback: string): string {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return fallback;
}

function normalizeTheme(raw: string): BrandTheme {
  return raw.toLowerCase() === 'light' ? 'light' : 'dark';
}

/** Build BrandConfig from process env (Node) or public env (browser). */
export function resolveBrandConfig(env: BrandEnvInput = {}): BrandConfig {
  const appUrl = pick(
    env,
    ['APP_URL', 'NEXT_PUBLIC_APP_URL', 'FRONTEND_URL'],
    DEFAULTS.appUrl,
  ).replace(/\/$/, '');

  const appName = pick(
    env,
    ['APP_NAME', 'NEXT_PUBLIC_APP_NAME'],
    DEFAULTS.appName,
  );

  return {
    appName,
    companyName: pick(
      env,
      ['COMPANY_NAME', 'NEXT_PUBLIC_COMPANY_NAME'],
      DEFAULTS.companyName,
    ),
    appUrl,
    logoUrl: pick(env, ['LOGO_URL', 'NEXT_PUBLIC_LOGO_URL'], DEFAULTS.logoUrl),
    faviconUrl: pick(
      env,
      ['FAVICON_URL', 'NEXT_PUBLIC_FAVICON_URL'],
      DEFAULTS.faviconUrl,
    ),
    primaryColor: pick(
      env,
      ['PRIMARY_COLOR', 'NEXT_PUBLIC_PRIMARY_COLOR'],
      DEFAULTS.primaryColor,
    ),
    secondaryColor: pick(
      env,
      ['SECONDARY_COLOR', 'NEXT_PUBLIC_SECONDARY_COLOR'],
      DEFAULTS.secondaryColor,
    ),
    theme: normalizeTheme(
      pick(env, ['BRAND_THEME', 'NEXT_PUBLIC_BRAND_THEME'], DEFAULTS.theme),
    ),
    fontFamily: pick(
      env,
      ['BRAND_FONT', 'NEXT_PUBLIC_BRAND_FONT', 'FONT_FAMILY'],
      DEFAULTS.fontFamily,
    ),
    iconUrl: pick(env, ['ICON_URL', 'NEXT_PUBLIC_ICON_URL'], DEFAULTS.iconUrl),
    appleTouchIconUrl: pick(
      env,
      ['APPLE_TOUCH_ICON_URL', 'NEXT_PUBLIC_APPLE_TOUCH_ICON_URL'],
      DEFAULTS.appleTouchIconUrl,
    ),
    supportEmail: pick(
      env,
      ['SUPPORT_EMAIL', 'NEXT_PUBLIC_SUPPORT_EMAIL'],
      DEFAULTS.supportEmail,
    ),
    supportUrl: pick(
      env,
      ['SUPPORT_URL', 'NEXT_PUBLIC_SUPPORT_URL'],
      appUrl || DEFAULTS.supportUrl,
    ),
    metaDescription: pick(
      env,
      ['META_DESCRIPTION', 'NEXT_PUBLIC_META_DESCRIPTION'],
      `${appName} — ${DEFAULTS.metaDescription}`,
    ),
  };
}

export const DEFAULT_BRAND_CONFIG = DEFAULTS;
