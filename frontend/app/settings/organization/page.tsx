'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Permission } from '@saas-starter/shared';
import { Button, Input } from '@/components/ui';
import { layout } from '@/lib/components';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useOrganization, useToast } from '@/providers';
import { ApiError } from '@/lib/api';
import {
  createInvitation,
  getOrganization,
  listInvitations,
  removeOrganizationMember,
  revokeInvitation,
  type OrganizationDetail,
  type UserInvitation,
} from '@/services/organizations.service';

function parseApiMessage(err: unknown): string {
  if (err instanceof ApiError) {
    try {
      const json = JSON.parse(err.body) as {
        message?: string | string[];
        code?: string;
      };
      if (Array.isArray(json.message)) return json.message.join(', ');
      if (typeof json.message === 'string') return json.message;
    } catch {
      /* plain text */
    }
    return err.body || err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Une erreur est survenue';
}

export default function OrganizationSettingsPage() {
  const { accessToken } = useAuth();
  const { canInvite, can, isAdmin } = usePermissions();
  const toast = useToast();
  const {
    organizations,
    activeOrganizationId,
    setActiveOrganizationId,
    refreshOrganizations,
  } = useOrganization();

  const [org, setOrg] = useState<OrganizationDetail | null>(null);
  const [invites, setInvites] = useState<UserInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canManageMembers = canInvite || isAdmin || can(Permission.ORG_MANAGE);

  const orgId = activeOrganizationId ?? organizations[0]?.id ?? null;

  const load = useCallback(async () => {
    if (!accessToken || !orgId) {
      setOrg(null);
      setInvites([]);
      return;
    }
    setLoading(true);
    try {
      const detail = await getOrganization(accessToken, orgId);
      setOrg(detail);
      if (canManageMembers) {
        const listed = await listInvitations(accessToken, {
          status: 'PENDING',
          pageSize: 50,
        });
        setInvites(listed.items.filter((i) => i.organizationId === orgId));
      } else {
        setInvites([]);
      }
    } catch (err) {
      toast.error(parseApiMessage(err));
    } finally {
      setLoading(false);
    }
  }, [accessToken, orgId, canManageMembers, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const onInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!accessToken || !orgId || !inviteEmail.trim()) return;
    setSubmitting(true);
    try {
      await createInvitation(accessToken, {
        email: inviteEmail.trim(),
        organizationId: orgId,
      });
      toast.success('Invitation envoyée');
      setInviteEmail('');
      await load();
      await refreshOrganizations();
    } catch (err) {
      toast.error(parseApiMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onRemove = async (userId: string) => {
    if (!accessToken || !orgId) return;
    if (!window.confirm('Retirer ce membre de l’organisation ?')) return;
    try {
      await removeOrganizationMember(accessToken, orgId, userId);
      toast.success('Membre retiré');
      await load();
      await refreshOrganizations();
    } catch (err) {
      toast.error(parseApiMessage(err));
    }
  };

  const onRevoke = async (id: string) => {
    if (!accessToken) return;
    try {
      await revokeInvitation(accessToken, id);
      toast.success('Invitation révoquée');
      await load();
    } catch (err) {
      toast.error(parseApiMessage(err));
    }
  };

  const memberCount = org?.members.length ?? 0;
  const limit = org?.memberLimit;
  const limitLabel =
    limit === null || limit === undefined
      ? 'Illimité'
      : `${memberCount} / ${limit}`;

  return (
    <main style={layout.admin}>
      <header className="page-header">
        <div>
          <h1>Organisation</h1>
          <p className="hint" style={{ margin: 0 }}>
            Membres, invitations et limite de plan.
          </p>
        </div>
        <Link href="/billing" className="hint">
          Voir l’abonnement →
        </Link>
      </header>

      {organizations.length > 1 ? (
        <div className="admin-filters" style={{ marginBottom: '1rem' }}>
          <label className="hint" htmlFor="settings-org-select">
            Organisation active
          </label>
          <select
            id="settings-org-select"
            value={orgId ?? ''}
            onChange={(e) => setActiveOrganizationId(e.target.value || null)}
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {loading && !org ? <p className="hint">Chargement…</p> : null}

      {!loading && !orgId ? (
        <section className="status">
          <p>Vous n’appartenez à aucune organisation pour le moment.</p>
          <p className="hint">
            Un administrateur peut vous inviter, ou créer une org via l’API.
          </p>
        </section>
      ) : null}

      {org ? (
        <>
          <section className="status" style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ marginTop: 0 }}>{org.name}</h2>
            <p className="hint" style={{ margin: 0 }}>
              <code>{org.slug}</code>
              {org.description ? ` — ${org.description}` : null}
            </p>
            <p style={{ margin: '0.75rem 0 0' }}>
              Membres : <strong>{limitLabel}</strong>
              {org.pendingInviteCount > 0
                ? ` · ${org.pendingInviteCount} invitation(s) en attente`
                : null}
            </p>
            {typeof limit === 'number' && memberCount >= limit ? (
              <p className="error" role="status" style={{ marginBottom: 0 }}>
                Limite atteinte —{' '}
                <Link href="/billing">passez au plan Pro</Link> pour des membres
                illimités.
              </p>
            ) : null}
          </section>

          <section style={{ marginBottom: '1.5rem' }}>
            <h2>Membres</h2>
            <ul className="admin-list">
              {org.members.map((m) => (
                <li key={m.id} className="admin-list-item">
                  <div>
                    <strong>{m.user.name ?? m.user.email}</strong>
                    <p className="hint" style={{ margin: 0 }}>
                      {m.user.email} · {m.role}
                    </p>
                  </div>
                  {canManageMembers ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="small"
                      onClick={() => void onRemove(m.userId)}
                    >
                      Retirer
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          {canManageMembers ? (
            <>
              <section style={{ marginBottom: '1.5rem' }}>
                <h2>Inviter un membre</h2>
                <form
                  onSubmit={(e) => void onInvite(e)}
                  className="admin-filters"
                  style={{ alignItems: 'flex-end' }}
                >
                  <Input
                    type="email"
                    placeholder="email@exemple.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    aria-label="Email à inviter"
                  />
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Envoi…' : 'Envoyer l’invitation'}
                  </Button>
                </form>
              </section>

              <section>
                <h2>Invitations en attente</h2>
                {invites.length === 0 ? (
                  <p className="hint">Aucune invitation en attente.</p>
                ) : (
                  <ul className="admin-list">
                    {invites.map((inv) => (
                      <li key={inv.id} className="admin-list-item">
                        <div>
                          <strong>{inv.email}</strong>
                          <p className="hint" style={{ margin: 0 }}>
                            Expire le{' '}
                            {new Date(inv.expiresAt).toLocaleDateString(
                              'fr-FR',
                            )}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="small"
                          onClick={() => void onRevoke(inv.id)}
                        >
                          Révoquer
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
