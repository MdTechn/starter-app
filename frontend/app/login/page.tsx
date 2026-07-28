'use client';

import dynamic from 'next/dynamic';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui';
import { useAuth, type SocialIdp } from '@/hooks/use-auth';
import { layout, sx } from '@/lib/components';
import { useBrand } from '@/providers';
import { stashPendingInvite } from '@/components/invite-accept-handler';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

type AuthMode = 'keycloak' | 'register' | SocialIdp;

const LoginSocialButtons = dynamic(
  () => import('./login-social-buttons').then((m) => m.LoginSocialButtons),
  {
    ssr: false,
    loading: () => (
      <div className="login-divider" aria-hidden="true">
        <span>ou</span>
      </div>
    ),
  },
);

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  OAuthCallback: 'Échec du retour OAuth. Réessayez ou utilisez un autre moyen.',
  OAuthSignin:
    'Impossible de démarrer la connexion. Vérifiez la config Keycloak.',
  OAuthCreateAccount:
    'Création du compte impossible. Contactez un administrateur.',
  AccessDenied: 'Accès refusé. Connexion annulée ou compte non autorisé.',
  access_denied: 'Connexion annulée.',
  Configuration: 'Configuration d’authentification invalide.',
  Callback: 'Erreur lors du callback d’authentification.',
  Default: 'Une erreur d’authentification est survenue.',
};

function resolveAuthError(
  error: string | null,
  description: string | null,
): string | null {
  if (!error) return null;
  if (error === 'access_denied' || description?.includes('access_denied')) {
    return AUTH_ERROR_MESSAGES.access_denied;
  }
  return AUTH_ERROR_MESSAGES[error] ?? AUTH_ERROR_MESSAGES.Default;
}

function LoginContent() {
  const { brand } = useBrand();
  const { signIn, signUp, signInWithSocial, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const callbackUrl =
    searchParams.get('callbackUrl') ??
    (inviteToken
      ? `/settings/organization?invite=${encodeURIComponent(inviteToken)}`
      : '/dashboard');
  const authError = resolveAuthError(
    searchParams.get('error'),
    searchParams.get('error_description'),
  );
  const sessionExpired = searchParams.get('reason') === 'session_expired';
  const [pending, setPending] = useState<AuthMode | null>(null);

  useEffect(() => {
    if (inviteToken) stashPendingInvite(inviteToken);
  }, [inviteToken]);

  const busy = isLoading || pending !== null;

  const start = async (mode: AuthMode) => {
    setPending(mode);
    try {
      if (mode === 'keycloak') {
        await signIn(callbackUrl);
      } else if (mode === 'register') {
        await signUp(callbackUrl);
      } else {
        await signInWithSocial(mode, callbackUrl);
      }
    } catch {
      setPending(null);
    }
  };

  return (
    <main className="login" style={layout.login}>
      <div
        style={sx(layout.stack, {
          alignItems: 'center',
          width: '100%',
          maxWidth: 'min(22rem, 100%)',
        })}
      >
        <BrandLogo height={48} />
        <h1 style={{ marginBottom: 0 }}>{brand.appName}</h1>

        {authError ? (
          <p className="error" role="alert" style={{ margin: 0 }}>
            {authError}
          </p>
        ) : null}
        {sessionExpired && !authError ? (
          <p className="hint" role="status" style={{ margin: 0 }}>
            Session expirée — reconnectez-vous.
          </p>
        ) : null}
        {inviteToken && !authError ? (
          <p className="hint" role="status" style={{ margin: 0 }}>
            Une invitation vous attend — connectez-vous avec l’email invité.
          </p>
        ) : null}

        <div
          className="login-actions"
          style={sx(layout.stack, { width: '100%', maxWidth: '100%' })}
        >
          <Button
            variant="primary"
            fullWidth
            disabled={busy}
            onClick={() => void start('keycloak')}
          >
            {pending === 'keycloak' ? 'Redirection…' : 'Se connecter'}
          </Button>

          <Button
            variant="outline"
            fullWidth
            disabled={busy}
            onClick={() => void start('register')}
          >
            {pending === 'register' ? 'Redirection…' : "S'inscrire"}
          </Button>

          <LoginSocialButtons
            busy={busy}
            pending={pending}
            onStart={(idp) => void start(idp)}
          />
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main style={layout.login}>
          <p>Chargement…</p>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
