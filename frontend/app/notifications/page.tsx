'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Permission } from '@saas-starter/shared';
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/providers';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
} from '@/services/notifications.service';

type Tab = 'unread' | 'read';
type SortOrder = 'newest' | 'oldest';

function isUnread(n: NotificationRow) {
  return !n.readAt && n.status !== 'READ';
}

function eventLabel(eventType: string) {
  const map: Record<string, string> = {
    PAYMENT_SUCCESS: 'Paiement réussi',
    PAYMENT_FAILED: 'Paiement échoué',
    SUBSCRIPTION_CREATED: 'Abonnement',
    USER_INVITED: 'Invitation',
    WELCOME: 'Bienvenue',
  };
  return map[eventType] ?? eventType.replaceAll('_', ' ');
}

function eventTone(eventType: string): 'critical' | 'warning' | 'info' | 'ok' {
  if (eventType.includes('FAILED') || eventType.includes('ERROR')) {
    return 'critical';
  }
  if (eventType.includes('PAYMENT') || eventType.includes('SUBSCRIPTION')) {
    return 'info';
  }
  if (eventType.includes('SUCCESS') || eventType.includes('WELCOME')) {
    return 'ok';
  }
  return 'warning';
}

function formatRelative(iso: string) {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'À l’instant';
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Hier';
  if (days < 7) return `Il y a ${days} j`;
  return date.toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function NotificationsPage() {
  const { accessToken } = useAuth();
  const { can } = usePermissions();
  const toast = useToast();
  const canRead = can(Permission.NOTIFICATION_READ);

  const [items, setItems] = useState<NotificationRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('unread');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOrder>('newest');
  const [menuId, setMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken || !canRead) return;
    try {
      setItems(await listNotifications(accessToken));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur notifications');
    }
  }, [accessToken, canRead, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const close = () => setMenuId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const onRead = async (id: string) => {
    if (!accessToken) return;
    setBusy(true);
    setMenuId(null);
    try {
      await markNotificationRead(accessToken, id);
      toast.success('Notification marquée comme lue.');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lecture impossible');
    } finally {
      setBusy(false);
    }
  };

  const onReadAll = async () => {
    if (!accessToken) return;
    setBusy(true);
    try {
      await markAllNotificationsRead(accessToken);
      toast.success('Toutes les notifications sont lues.');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action impossible');
    } finally {
      setBusy(false);
    }
  };

  const unreadItems = useMemo(() => items.filter(isUnread), [items]);
  const readItems = useMemo(() => items.filter((n) => !isUnread(n)), [items]);
  const unreadCount = unreadItems.length;

  const visible = useMemo(() => {
    const source = tab === 'unread' ? unreadItems : readItems;
    const q = query.trim().toLowerCase();
    const filtered = q
      ? source.filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.body.toLowerCase().includes(q) ||
            n.eventType.toLowerCase().includes(q),
        )
      : source;
    return [...filtered].sort((a, b) => {
      const diff =
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sort === 'newest' ? -diff : diff;
    });
  }, [tab, unreadItems, readItems, query, sort]);

  if (!canRead) {
    return (
      <main className="notif-page">
        <p className="error">Accès notifications refusé.</p>
      </main>
    );
  }

  return (
    <main className="notif-page">
      <header className="notif-page-header">
        <div>
          <h1>Notifications</h1>
          <div
            className="notif-tabs"
            role="tablist"
            aria-label="Filtre lecture"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'unread'}
              className={`notif-tab${tab === 'unread' ? ' active' : ''}`}
              onClick={() => setTab('unread')}
            >
              Non lues
              {unreadCount > 0 ? (
                <span className="notif-tab-count">{unreadCount}</span>
              ) : null}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'read'}
              className={`notif-tab${tab === 'read' ? ' active' : ''}`}
              onClick={() => setTab('read')}
            >
              Lues
            </button>
          </div>
        </div>
        <Link href="/notifications/preferences" className="notif-prefs-link">
          Préférences
        </Link>
      </header>

      <div className="notif-toolbar">
        <div className="notif-search">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une notification…"
            aria-label="Rechercher une notification"
          />
        </div>
        <label className="notif-sort">
          <span className="sr-only">Trier</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOrder)}
            aria-label="Trier par date"
          >
            <option value="newest">Date et heure · récentes</option>
            <option value="oldest">Date et heure · anciennes</option>
          </select>
        </label>
        <Button
          variant="social"
          disabled={busy || unreadCount === 0}
          onClick={() => void onReadAll()}
        >
          Tout marquer comme lu
        </Button>
      </div>

      <ul className="notif-feed">
        {visible.map((n) => {
          const unread = isUnread(n);
          const tone = eventTone(n.eventType);
          return (
            <li key={n.id} className={`notif-row${unread ? ' is-unread' : ''}`}>
              <span
                className={`notif-dot${unread ? ' on' : ''}`}
                aria-hidden="true"
              />
              <div className="notif-row-main">
                <strong className="notif-row-title">{n.title}</strong>
                <p className="notif-row-body">{n.body}</p>
              </div>
              <span className={`notif-tag tone-${tone}`}>
                {eventLabel(n.eventType)}
              </span>
              <time
                className="notif-row-time"
                dateTime={n.createdAt}
                title={new Date(n.createdAt).toLocaleString('fr-FR')}
              >
                {formatRelative(n.createdAt)}
              </time>
              <div className="notif-row-menu">
                <button
                  type="button"
                  className="notif-menu-btn"
                  aria-label="Actions"
                  aria-expanded={menuId === n.id}
                  disabled={busy}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuId((cur) => (cur === n.id ? null : n.id));
                  }}
                >
                  ⋯
                </button>
                {menuId === n.id ? (
                  <div
                    className="notif-menu-pop"
                    role="menu"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {unread ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => void onRead(n.id)}
                      >
                        Marquer comme lu
                      </button>
                    ) : (
                      <span className="hint">Déjà lue</span>
                    )}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
        {visible.length === 0 ? (
          <li className="notif-empty">
            {tab === 'unread'
              ? 'Aucune notification non lue.'
              : 'Aucune notification lue.'}
          </li>
        ) : null}
      </ul>
    </main>
  );
}
