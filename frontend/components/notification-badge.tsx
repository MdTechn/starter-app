'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Permission } from '@saas-starter/shared/auth';
import { Badge } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { getUnreadCount } from '@/services/notifications.service';

type Props = {
  className?: string;
  /** `link` = full text link (legacy). `count` = badge only for sidebar. */
  variant?: 'link' | 'count';
};

export function NotificationBadge({ className, variant = 'link' }: Props) {
  const { accessToken } = useAuth();
  const { can } = usePermissions();
  const canRead = can(Permission.NOTIFICATION_READ);
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!accessToken || !canRead) {
      setCount(0);
      return;
    }
    try {
      const res = await getUnreadCount(accessToken);
      setCount(res.count);
    } catch {
      setCount(0);
    }
  }, [accessToken, canRead]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  if (!canRead) return null;

  const countBadge =
    count > 0 ? (
      <Badge
        variant="error"
        size="small"
        aria-label={`${count} non lues`}
        style={{
          background: '#dc2626',
          color: '#fff',
          borderColor: 'transparent',
          minWidth: '1.25rem',
          justifyContent: 'center',
        }}
      >
        {count > 99 ? '99+' : count}
      </Badge>
    ) : null;

  if (variant === 'count') {
    return countBadge;
  }

  return (
    <Link href="/notifications" className={className ?? 'notif-link'}>
      Notifications
      {countBadge}
    </Link>
  );
}
