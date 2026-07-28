'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  resolveBrandConfig,
  type BrandConfig,
  type BrandTheme,
} from '@saas-starter/shared';
import { applyThemeCssVars } from '@/lib/theme';
import { beginGlobalLoading, endGlobalLoading } from '@/lib/loading-bus';

const THEME_STORAGE_KEY = 'saas-starter-theme';

type BrandContextValue = {
  brand: BrandConfig;
  isLoading: boolean;
  setTheme: (theme: BrandTheme) => void;
  toggleTheme: () => void;
  /** Recharge la config depuis l’API (après save admin). */
  refreshBrand: () => Promise<void>;
  /** Applique un patch branding (aperçu formulaire) sans persister. */
  applyBrand: (patch: Partial<BrandConfig>) => void;
};

function readStoredTheme(): BrandTheme | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark') return raw;
  } catch {
    /* ignore */
  }
  return null;
}

function writeStoredTheme(theme: BrandTheme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

const BrandContext = createContext<BrandContextValue>({
  brand: resolveBrandConfig({
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_COMPANY_NAME: process.env.NEXT_PUBLIC_COMPANY_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_LOGO_URL: process.env.NEXT_PUBLIC_LOGO_URL,
    NEXT_PUBLIC_FAVICON_URL: process.env.NEXT_PUBLIC_FAVICON_URL,
    NEXT_PUBLIC_PRIMARY_COLOR: process.env.NEXT_PUBLIC_PRIMARY_COLOR,
    NEXT_PUBLIC_SECONDARY_COLOR: process.env.NEXT_PUBLIC_SECONDARY_COLOR,
    NEXT_PUBLIC_BRAND_THEME: process.env.NEXT_PUBLIC_BRAND_THEME,
    NEXT_PUBLIC_BRAND_FONT: process.env.NEXT_PUBLIC_BRAND_FONT,
    NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
    NEXT_PUBLIC_SUPPORT_URL: process.env.NEXT_PUBLIC_SUPPORT_URL,
  }),
  isLoading: true,
  setTheme: () => undefined,
  toggleTheme: () => undefined,
  refreshBrand: async () => undefined,
  applyBrand: () => undefined,
});

function applyBrandCss(brand: BrandConfig) {
  applyThemeCssVars(brand);
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(
    () =>
      resolveBrandConfig({
        NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
        NEXT_PUBLIC_COMPANY_NAME: process.env.NEXT_PUBLIC_COMPANY_NAME,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
        NEXT_PUBLIC_LOGO_URL: process.env.NEXT_PUBLIC_LOGO_URL,
        NEXT_PUBLIC_FAVICON_URL: process.env.NEXT_PUBLIC_FAVICON_URL,
        NEXT_PUBLIC_PRIMARY_COLOR: process.env.NEXT_PUBLIC_PRIMARY_COLOR,
        NEXT_PUBLIC_SECONDARY_COLOR: process.env.NEXT_PUBLIC_SECONDARY_COLOR,
        NEXT_PUBLIC_BRAND_THEME: process.env.NEXT_PUBLIC_BRAND_THEME,
        NEXT_PUBLIC_BRAND_FONT: process.env.NEXT_PUBLIC_BRAND_FONT,
        NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
        NEXT_PUBLIC_SUPPORT_URL: process.env.NEXT_PUBLIC_SUPPORT_URL,
      }),
    [],
  );
  const [brand, setBrand] = useState(initial);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = readStoredTheme();
    if (stored) {
      setBrand((prev) => ({ ...prev, theme: stored }));
    }
  }, []);

  useEffect(() => {
    applyBrandCss(brand);
  }, [brand]);

  useEffect(() => {
    let cancelled = false;
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

    beginGlobalLoading();
    fetch(`${apiBase}/brand`)
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as BrandConfig;
      })
      .then((remote) => {
        if (!cancelled && remote?.appName) {
          const stored = readStoredTheme();
          setBrand({
            ...remote,
            theme: stored ?? remote.theme ?? 'light',
          });
        }
      })
      .catch(() => undefined)
      .finally(() => {
        endGlobalLoading();
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = useCallback((theme: BrandTheme) => {
    writeStoredTheme(theme);
    setBrand((prev) => ({ ...prev, theme }));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(brand.theme === 'dark' ? 'light' : 'dark');
  }, [brand.theme, setTheme]);

  const refreshBrand = useCallback(async () => {
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
    try {
      const res = await fetch(`${apiBase}/brand`);
      if (!res.ok) return;
      const remote = (await res.json()) as BrandConfig;
      if (!remote?.appName) return;
      const stored = readStoredTheme();
      setBrand({
        ...remote,
        theme: stored ?? remote.theme ?? 'light',
      });
    } catch {
      /* ignore */
    }
  }, []);

  const applyBrand = useCallback((patch: Partial<BrandConfig>) => {
    setBrand((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo(
    () => ({
      brand,
      isLoading,
      setTheme,
      toggleTheme,
      refreshBrand,
      applyBrand,
    }),
    [brand, isLoading, setTheme, toggleTheme, refreshBrand, applyBrand],
  );

  return (
    <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
  );
}

export function useBrand() {
  return useContext(BrandContext);
}
