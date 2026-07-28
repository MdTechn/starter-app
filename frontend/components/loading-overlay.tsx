'use client';

import { Spinner } from '@/components/ui/spinner';

type Props = {
  open: boolean;
  label?: string;
};

/** Full-screen dimmed backdrop + spinner. */
export function LoadingOverlay({ open, label = 'Chargement…' }: Props) {
  if (!open) return null;

  return (
    <div
      className="global-loading-overlay"
      role="alertdialog"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
    >
      <Spinner size={44} label={label} />
      <span className="global-loading-label">{label}</span>
    </div>
  );
}
