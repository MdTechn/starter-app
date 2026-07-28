'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useOrganization, useToast } from '@/providers';
import { ApiError } from '@/lib/api';
import { acceptInvitation } from '@/services/organizations.service';

const PENDING_INVITE_KEY = 'saas-starter-pending-invite';

export function stashPendingInvite(token: string) {
  try {
    sessionStorage.setItem(PENDING_INVITE_KEY, token);
  } catch {
    /* ignore */
  }
}

export function readPendingInvite(): string | null {
  try {
    return sessionStorage.getItem(PENDING_INVITE_KEY);
  } catch {
    return null;
  }
}

export function clearPendingInvite() {
  try {
    sessionStorage.removeItem(PENDING_INVITE_KEY);
  } catch {
    /* ignore */
  }
}

function parseApiMessage(err: unknown): string {
  if (err instanceof ApiError) {
    try {
      const json = JSON.parse(err.body) as { message?: string | string[] };
      if (Array.isArray(json.message)) return json.message.join(', ');
      if (typeof json.message === 'string') return json.message;
    } catch {
      /* plain */
    }
    return err.body || err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Impossible d’accepter l’invitation';
}

/**
 * After login, consumes `?invite=` (or sessionStorage stash) and accepts membership.
 */
export function InviteAcceptHandler() {
  const { accessToken, isAuthenticated, isLoading } = useAuth();
  const { refreshOrganizations, setActiveOrganizationId } = useOrganization();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const handled = useRef(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !accessToken || handled.current) {
      return;
    }

    const fromQuery = searchParams.get('invite');
    const token = fromQuery ?? readPendingInvite();
    if (!token) return;

    handled.current = true;
    setBusy(true);

    void (async () => {
      try {
        const accepted = await acceptInvitation(accessToken, token);
        clearPendingInvite();
        await refreshOrganizations();
        if (accepted.organizationId) {
          setActiveOrganizationId(accepted.organizationId);
        }
        toast.success(
          accepted.organization
            ? `Bienvenue dans ${accepted.organization.name}`
            : 'Invitation acceptée',
        );
        const next = new URLSearchParams(searchParams.toString());
        next.delete('invite');
        const qs = next.toString();
        router.replace(
          qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
        );
      } catch (err) {
        clearPendingInvite();
        toast.error(parseApiMessage(err));
      } finally {
        setBusy(false);
      }
    })();
  }, [
    accessToken,
    isAuthenticated,
    isLoading,
    refreshOrganizations,
    router,
    searchParams,
    setActiveOrganizationId,
    toast,
  ]);

  if (!busy) return null;
  return (
    <div className="invite-accept-banner" role="status">
      Acceptation de l’invitation…
    </div>
  );
}
