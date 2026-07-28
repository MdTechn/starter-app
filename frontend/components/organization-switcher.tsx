'use client';

import Link from 'next/link';
import { useOrganization } from '@/providers/organization-provider';

type Props = {
  onNavigate?: () => void;
};

/** Compact org switcher for the app sidebar. */
export function OrganizationSwitcher({ onNavigate }: Props) {
  const {
    organizations,
    activeOrganizationId,
    setActiveOrganizationId,
    isLoading,
  } = useOrganization();

  if (isLoading && organizations.length === 0) {
    return (
      <div className="org-switcher">
        <p className="org-switcher-label">Organisation</p>
        <p className="hint" style={{ margin: 0, fontSize: '0.75rem' }}>
          Chargement…
        </p>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="org-switcher">
        <p className="org-switcher-label">Organisation</p>
        <p className="hint" style={{ margin: 0, fontSize: '0.75rem' }}>
          Aucune organisation
        </p>
        <Link
          href="/settings/organization"
          className="org-switcher-manage"
          onClick={onNavigate}
        >
          Gérer
        </Link>
      </div>
    );
  }

  return (
    <div className="org-switcher">
      <label className="org-switcher-label" htmlFor="org-switcher-select">
        Organisation
      </label>
      <select
        id="org-switcher-select"
        className="org-switcher-select"
        value={activeOrganizationId ?? ''}
        onChange={(e) => setActiveOrganizationId(e.target.value || null)}
        aria-label="Organisation active"
      >
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
      <Link
        href="/settings/organization"
        className="org-switcher-manage"
        onClick={onNavigate}
      >
        Membres & invitations
      </Link>
    </div>
  );
}
