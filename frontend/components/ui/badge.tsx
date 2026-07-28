import type { HTMLAttributes, CSSProperties } from 'react';
import { badge, sx } from '@/lib/components';

type Variant =
  'primary' | 'secondary' | 'outline' | 'success' | 'error' | 'warning';
type Size = 'small' | 'medium' | 'large';

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
  size?: Size;
};

const variantMap = {
  primary: badge.primary,
  secondary: badge.secondary,
  outline: badge.outline,
  success: badge.success,
  error: badge.error,
  warning: badge.warning,
} as const;

const sizeMap = {
  small: badge.small,
  medium: badge.medium,
  large: badge.large,
} as const;

export function Badge({
  variant = 'primary',
  size = 'medium',
  style,
  ...props
}: BadgeProps) {
  return (
    <span
      style={sx(
        badge.base,
        variantMap[variant],
        sizeMap[size],
        style as CSSProperties,
      )}
      {...props}
    />
  );
}
