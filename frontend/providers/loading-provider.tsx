'use client';

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { LoadingOverlay } from '@/components/loading-overlay';
import {
  beginGlobalLoading,
  endGlobalLoading,
  subscribeGlobalLoading,
  withGlobalLoading,
} from '@/lib/loading-bus';

type LoadingContextValue = {
  isLoading: boolean;
  begin: () => void;
  end: () => void;
  withLoading: <T>(task: () => Promise<T>) => Promise<T>;
};

const LoadingContext = createContext<LoadingContextValue>({
  isLoading: false,
  begin: beginGlobalLoading,
  end: endGlobalLoading,
  withLoading: withGlobalLoading,
});

const SHOW_DELAY_MS = 120;

function isInternalNavLink(anchor: HTMLAnchorElement): boolean {
  if (anchor.target === '_blank' || anchor.hasAttribute('download')) {
    return false;
  }
  const href = anchor.getAttribute('href');
  if (
    !href ||
    href.startsWith('#') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:')
  ) {
    return false;
  }
  if (href.startsWith('http://') || href.startsWith('https://')) {
    try {
      const url = new URL(href);
      if (url.origin !== window.location.origin) return false;
    } catch {
      return false;
    }
  }
  return true;
}

function NavigationLoadingTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams?.toString() ?? ''}`;
  const navPending = useRef(false);

  useEffect(() => {
    if (!navPending.current) return;
    navPending.current = false;
    endGlobalLoading();
  }, [routeKey]);

  useEffect(() => {
    const startNav = () => {
      if (navPending.current) return;
      navPending.current = true;
      beginGlobalLoading();
    };

    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target as Element | null;
      const anchor = target?.closest?.('a') as HTMLAnchorElement | null;
      if (!anchor || !isInternalNavLink(anchor)) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      try {
        const next = new URL(href, window.location.href);
        const current = new URL(window.location.href);
        if (
          next.pathname === current.pathname &&
          next.search === current.search
        ) {
          return;
        }
      } catch {
        return;
      }

      startNav();
    };

    const onPopState = () => {
      startNav();
    };

    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPopState);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  return null;
}

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => subscribeGlobalLoading(setCount), []);

  useEffect(() => {
    if (count <= 0) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [count]);

  const begin = useCallback(() => {
    beginGlobalLoading();
  }, []);

  const end = useCallback(() => {
    endGlobalLoading();
  }, []);

  const withLoading = useCallback(
    <T,>(task: () => Promise<T>) => withGlobalLoading(task),
    [],
  );

  const value = useMemo(
    () => ({
      isLoading: count > 0,
      begin,
      end,
      withLoading,
    }),
    [count, begin, end, withLoading],
  );

  return (
    <LoadingContext.Provider value={value}>
      <Suspense fallback={null}>
        <NavigationLoadingTracker />
      </Suspense>
      {children}
      <LoadingOverlay open={visible} />
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  return useContext(LoadingContext);
}
