'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { OrganizationSwitcher } from '@/components/organization-switcher';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Button } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useBrand } from '@/providers';

const NotificationBadge = dynamic(
  () =>
    import('@/components/notification-badge').then((m) => m.NotificationBadge),
  { ssr: false, loading: () => null },
);

type NavItem = {
  href: string;
  label: string;
  match?: 'exact' | 'prefix';
  trailing?: ReactNode;
};

function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === '/admin') {
    return pathname === '/admin' || pathname.startsWith('/admin/users');
  }
  if (item.match === 'exact') {
    return pathname === item.href;
  }
  if (pathname === item.href) return true;
  return pathname.startsWith(`${item.href}/`);
}

type Props = {
  open: boolean;
  onNavigate?: () => void;
};

export function AppSidebar({ open, onNavigate }: Props) {
  const pathname = usePathname();
  const { brand } = useBrand();
  const { signOut, session } = useAuth();
  const {
    isAdmin,
    canUploadRead,
    canCmsRead,
    canBillingRead,
    canNotificationRead,
    canListUsers,
    canBrandRead,
    canBillingManage,
  } = usePermissions();

  const mainItems: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', match: 'exact' },
  ];
  if (canUploadRead) mainItems.push({ href: '/storage', label: 'Fichiers' });
  if (canCmsRead) mainItems.push({ href: '/cms', label: 'CMS' });
  if (canBillingRead) mainItems.push({ href: '/billing', label: 'Abonnement' });
  mainItems.push({
    href: '/settings/organization',
    label: 'Organisation',
  });
  if (canNotificationRead) {
    mainItems.push({
      href: '/notifications',
      label: 'Notifications',
      trailing: <NotificationBadge variant="count" />,
    });
  }

  const adminItems: NavItem[] = [];
  if (canListUsers) {
    adminItems.push({ href: '/admin', label: 'Utilisateurs', match: 'exact' });
  }
  if (canBillingManage) {
    adminItems.push({ href: '/admin/payments', label: 'Paiements' });
  }
  if (canBrandRead) {
    adminItems.push({ href: '/admin/branding', label: 'Branding' });
  }
  if (isAdmin) {
    adminItems.push({ href: '/admin/ai-usage', label: 'Usage IA' });
    adminItems.push({ href: '/admin/organization', label: 'Organisation' });
  }

  const showAdmin = isAdmin && adminItems.length > 0;

  return (
    <aside
      className={`app-sidebar${open ? ' is-open' : ''}`}
      aria-label="Navigation principale"
    >
      <div className="app-sidebar-brand">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="app-sidebar-brand-link"
        >
          <BrandLogo height={32} />
        </Link>
        <p className="app-sidebar-company">{brand.companyName}</p>
      </div>

      <OrganizationSwitcher onNavigate={onNavigate} />

      <nav className="app-sidebar-nav">
        <p className="app-sidebar-section">Application</p>
        <ul>
          {mainItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={
                  isActive(pathname, item)
                    ? 'app-sidebar-link is-active'
                    : 'app-sidebar-link'
                }
                onClick={onNavigate}
              >
                <span>{item.label}</span>
                {item.trailing}
              </Link>
            </li>
          ))}
        </ul>

        {showAdmin ? (
          <>
            <p className="app-sidebar-section">Administration</p>
            <ul>
              {adminItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={
                      isActive(pathname, item)
                        ? 'app-sidebar-link is-active'
                        : 'app-sidebar-link'
                    }
                    onClick={onNavigate}
                  >
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </nav>

      <div className="app-sidebar-footer">
        <div className="px-1">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">
            Thème
          </p>
          <ThemeSwitcher compact className="w-full justify-center" />
        </div>
        {session?.user?.email ? (
          <p className="app-sidebar-user" title={session.user.email}>
            {session.user.email}
          </p>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="small"
          fullWidth
          onClick={() => void signOut()}
        >
          Se déconnecter
        </Button>
      </div>
    </aside>
  );
}
