import type { Metadata } from 'next';
import { resolveBrandConfig } from '@saas-starter/shared';
import {
  AuthProvider,
  BrandProvider,
  LoadingProvider,
  OrganizationProvider,
  ToastProvider,
} from '@/providers';
import { AppShell } from '@/components/app-shell';
import { getRootCssVars } from '@/lib/theme';
import './globals.css';

const brand = resolveBrandConfig({
  APP_NAME: process.env.APP_NAME,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  COMPANY_NAME: process.env.COMPANY_NAME,
  NEXT_PUBLIC_COMPANY_NAME: process.env.NEXT_PUBLIC_COMPANY_NAME,
  APP_URL: process.env.APP_URL ?? process.env.FRONTEND_URL,
  LOGO_URL: process.env.LOGO_URL ?? process.env.NEXT_PUBLIC_LOGO_URL,
  FAVICON_URL: process.env.FAVICON_URL ?? process.env.NEXT_PUBLIC_FAVICON_URL,
  PRIMARY_COLOR:
    process.env.PRIMARY_COLOR ?? process.env.NEXT_PUBLIC_PRIMARY_COLOR,
  SECONDARY_COLOR:
    process.env.SECONDARY_COLOR ?? process.env.NEXT_PUBLIC_SECONDARY_COLOR,
  BRAND_THEME: process.env.BRAND_THEME ?? process.env.NEXT_PUBLIC_BRAND_THEME,
  META_DESCRIPTION:
    process.env.META_DESCRIPTION ?? process.env.NEXT_PUBLIC_META_DESCRIPTION,
  ICON_URL: process.env.ICON_URL ?? process.env.NEXT_PUBLIC_ICON_URL,
  APPLE_TOUCH_ICON_URL:
    process.env.APPLE_TOUCH_ICON_URL ??
    process.env.NEXT_PUBLIC_APPLE_TOUCH_ICON_URL,
});

export const metadata: Metadata = {
  title: {
    default: brand.appName,
    template: `%s · ${brand.appName}`,
  },
  description: brand.metaDescription,
  applicationName: brand.appName,
  metadataBase: new URL(brand.appUrl),
  icons: {
    icon: [{ url: brand.faviconUrl }],
    apple: [{ url: brand.appleTouchIconUrl }],
  },
  openGraph: {
    title: brand.appName,
    description: brand.metaDescription,
    siteName: brand.companyName,
    url: brand.appUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" data-theme={brand.theme}>
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `:root{${getRootCssVars(brand.theme)}}`,
          }}
        />
      </head>
      <body>
        <LoadingProvider>
          <BrandProvider>
            <AuthProvider>
              <OrganizationProvider>
                <ToastProvider>
                  <AppShell>{children}</AppShell>
                </ToastProvider>
              </OrganizationProvider>
            </AuthProvider>
          </BrandProvider>
        </LoadingProvider>
      </body>
    </html>
  );
}
