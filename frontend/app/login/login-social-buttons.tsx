'use client';

import { Button } from '@/components/ui';
import type { SocialIdp } from '@/hooks/use-auth';

type AuthMode = 'keycloak' | 'register' | SocialIdp;

type Props = {
  busy: boolean;
  pending: AuthMode | null;
  onStart: (mode: SocialIdp) => void;
};

/** Epic 3 social IdP buttons — code-split from Epic 1 login core. */
export function LoginSocialButtons({ busy, pending, onStart }: Props) {
  return (
    <>
      <div className="login-divider" aria-hidden="true">
        <span>ou</span>
      </div>

      <Button
        variant="social"
        fullWidth
        disabled={busy}
        aria-label="Continuer avec Google"
        onClick={() => onStart('google')}
      >
        {pending === 'google' ? 'Redirection…' : 'Continuer avec Google'}
      </Button>

      <Button
        variant="social"
        fullWidth
        disabled={busy}
        aria-label="Continuer avec Facebook"
        onClick={() => onStart('facebook')}
      >
        {pending === 'facebook' ? 'Redirection…' : 'Continuer avec Facebook'}
      </Button>

      <Button
        variant="social"
        fullWidth
        disabled={busy}
        aria-label="Continuer avec Apple"
        onClick={() => onStart('apple')}
      >
        {pending === 'apple' ? 'Redirection…' : 'Continuer avec Apple'}
      </Button>

      <Button
        variant="social"
        fullWidth
        disabled={busy}
        aria-label="Continuer avec Microsoft"
        onClick={() => onStart('microsoft')}
      >
        {pending === 'microsoft' ? 'Redirection…' : 'Continuer avec Microsoft'}
      </Button>
    </>
  );
}
