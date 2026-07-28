'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Toast, type ToastVariant } from '@/components/ui/toast';
import { toast as toastStyles } from '@/lib/components';

export type ToastInput = {
  message: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
};

type ToastApi = {
  toast: (input: ToastInput | string) => string;
  success: (message: string, duration?: number) => string;
  warning: (message: string, duration?: number) => string;
  info: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  dismiss: (id: string) => void;
};

const DEFAULT_DURATION = 4200;
const MAX_TOASTS = 4;

const ToastContext = createContext<ToastApi | null>(null);

function normalize(input: ToastInput | string): Omit<ToastItem, 'id'> {
  if (typeof input === 'string') {
    return {
      message: input,
      variant: 'info',
      duration: DEFAULT_DURATION,
    };
  }
  return {
    message: input.message,
    variant: input.variant ?? 'info',
    duration: input.duration ?? DEFAULT_DURATION,
  };
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (input: ToastInput | string) => {
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const next = { id, ...normalize(input) };

      setItems((prev) => {
        const merged = [...prev, next];
        return merged.length > MAX_TOASTS
          ? merged.slice(merged.length - MAX_TOASTS)
          : merged;
      });

      if (next.duration > 0) {
        const timer = window.setTimeout(() => dismiss(id), next.duration);
        timers.current.set(id, timer);
      }

      return id;
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      toast: push,
      success: (message, duration) =>
        push({ message, variant: 'success', duration }),
      warning: (message, duration) =>
        push({ message, variant: 'warning', duration }),
      info: (message, duration) => push({ message, variant: 'info', duration }),
      error: (message, duration) =>
        push({ message, variant: 'error', duration }),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div style={toastStyles.viewport} aria-label="Notifications">
        {items.map((item) => (
          <Toast
            key={item.id}
            variant={item.variant}
            message={item.message}
            onClose={() => dismiss(item.id)}
          />
        ))}
      </div>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-0.5rem); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
