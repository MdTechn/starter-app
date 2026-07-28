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
import { useAuth } from '@/hooks/use-auth';
import {
  listOrganizations,
  type OrganizationSummary,
} from '@/services/organizations.service';

const STORAGE_KEY = 'saas-starter-active-org';

type OrgContextValue = {
  organizations: OrganizationSummary[];
  activeOrganization: OrganizationSummary | null;
  activeOrganizationId: string | null;
  isLoading: boolean;
  setActiveOrganizationId: (id: string | null) => void;
  refreshOrganizations: () => Promise<void>;
};

const OrgContext = createContext<OrgContextValue>({
  organizations: [],
  activeOrganization: null,
  activeOrganizationId: null,
  isLoading: false,
  setActiveOrganizationId: () => undefined,
  refreshOrganizations: async () => undefined,
});

function readStoredOrgId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredOrgId(id: string | null) {
  try {
    if (!id) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { accessToken, isAuthenticated } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [activeOrganizationId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const setActiveOrganizationId = useCallback((id: string | null) => {
    setActiveId(id);
    writeStoredOrgId(id);
  }, []);

  const refreshOrganizations = useCallback(async () => {
    if (!accessToken || !isAuthenticated) {
      setOrganizations([]);
      setActiveId(null);
      return;
    }
    setIsLoading(true);
    try {
      const orgs = await listOrganizations(accessToken);
      setOrganizations(orgs);
      const stored = readStoredOrgId();
      const stillValid = stored && orgs.some((o) => o.id === stored);
      if (stillValid) {
        setActiveId(stored);
      } else if (orgs.length > 0) {
        setActiveOrganizationId(orgs[0].id);
      } else {
        setActiveOrganizationId(null);
      }
    } catch {
      setOrganizations([]);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, isAuthenticated, setActiveOrganizationId]);

  useEffect(() => {
    void refreshOrganizations();
  }, [refreshOrganizations]);

  const activeOrganization = useMemo(
    () => organizations.find((o) => o.id === activeOrganizationId) ?? null,
    [organizations, activeOrganizationId],
  );

  const value = useMemo(
    () => ({
      organizations,
      activeOrganization,
      activeOrganizationId,
      isLoading,
      setActiveOrganizationId,
      refreshOrganizations,
    }),
    [
      organizations,
      activeOrganization,
      activeOrganizationId,
      isLoading,
      setActiveOrganizationId,
      refreshOrganizations,
    ],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrganization() {
  return useContext(OrgContext);
}
