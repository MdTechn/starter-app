'use client';

import {
  useEffect,
  type HTMLAttributes,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { modal, sx } from '@/lib/components';

type Size = 'small' | 'medium' | 'large';

export type ModalProps = {
  open: boolean;
  onClose?: () => void;
  size?: Size;
  sheet?: boolean;
  children: ReactNode;
  panelProps?: HTMLAttributes<HTMLDivElement>;
};

const sizeMap = {
  small: modal.small,
  medium: modal.medium,
  large: modal.large,
} as const;

export function Modal({
  open,
  onClose,
  size = 'medium',
  sheet = false,
  children,
  panelProps,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={modal.overlay}
      onClick={onClose}
    >
      <div
        {...panelProps}
        style={sx(
          modal.panel,
          sizeMap[size],
          sheet && modal.sheet,
          panelProps?.style as CSSProperties,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
