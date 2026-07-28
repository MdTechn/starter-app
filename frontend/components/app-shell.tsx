'use client';

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';
import { InviteAcceptHandler } from '@/components/invite-accept-handler';
import { Button } from '@/components/ui';

const PUBLIC_PREFIXES = ['/login'];

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const publicPage = isPublicPath(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  if (publicPage) {
    return <>{children}</>;
  }

  return (
    <div className={`app-shell${mobileOpen ? ' sidebar-open' : ''}`}>
      <Suspense fallback={null}>
        <InviteAcceptHandler />
      </Suspense>

      <div className="app-shell-topbar">
        <Button
          type="button"
          variant="ghost"
          size="small"
          aria-expanded={mobileOpen}
          aria-controls="app-sidebar"
          onClick={() => setMobileOpen((v) => !v)}
        >
          Menu
        </Button>
      </div>

      {mobileOpen ? (
        <button
          type="button"
          className="app-sidebar-backdrop"
          aria-label="Fermer le menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div id="app-sidebar">
        <AppSidebar open={mobileOpen} onNavigate={() => setMobileOpen(false)} />
      </div>

      <div className="app-shell-content">{children}</div>
    </div>
  );
}
