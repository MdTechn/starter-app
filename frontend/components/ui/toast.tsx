'use client';

import type { CSSProperties, HTMLAttributes } from 'react';
import { toast as toastStyles, sx } from '@/lib/components';

export type ToastVariant = 'success' | 'warning' | 'info' | 'error';

export type ToastProps = HTMLAttributes<HTMLDivElement> & {
  variant?: ToastVariant;
  message: string;
  onClose?: () => void;
};

const accentMap = {
  success: toastStyles.successAccent,
  warning: toastStyles.warningAccent,
  info: toastStyles.infoAccent,
  error: toastStyles.errorAccent,
} as const;

const iconColorMap = {
  success: toastStyles.success,
  warning: toastStyles.warning,
  info: toastStyles.info,
  error: toastStyles.error,
} as const;

function SuccessIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      width="100%"
      height="100%"
    >
      <path
        d="M5 12.5 10 17.5 19 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      width="100%"
      height="100%"
    >
      <path
        d="M12 7v7"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <circle cx="12" cy="18" r="1.25" fill="currentColor" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      width="100%"
      height="100%"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 11v6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="7.5" r="1.15" fill="currentColor" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      width="100%"
      height="100%"
    >
      <path
        d="M12 4.5 21 20H3L12 4.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M12 10v5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      width="14"
      height="14"
    >
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

const icons = {
  success: SuccessIcon,
  warning: WarningIcon,
  info: InfoIcon,
  error: ErrorIcon,
} as const;

export function Toast({
  variant = 'info',
  message,
  onClose,
  style,
  ...props
}: ToastProps) {
  const Icon = icons[variant];

  return (
    <div
      role="status"
      aria-live="polite"
      style={sx(toastStyles.item, style as CSSProperties)}
      {...props}
    >
      <span style={sx(toastStyles.icon, iconColorMap[variant])}>
        <Icon />
      </span>
      <p style={toastStyles.message}>{message}</p>
      {onClose ? (
        <button
          type="button"
          aria-label="Fermer"
          onClick={onClose}
          style={toastStyles.close}
        >
          <CloseIcon />
        </button>
      ) : null}
      <span style={sx(toastStyles.accent, accentMap[variant])} />
    </div>
  );
}
