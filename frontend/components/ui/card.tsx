import type { HTMLAttributes, CSSProperties } from 'react';
import { card, sx } from '@/lib/components';

type Variant = 'base' | 'flat' | 'raised' | 'outline';
type Size = 'small' | 'medium' | 'large';

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: Variant;
  size?: Size;
};

const variantMap = {
  base: {},
  flat: card.flat,
  raised: card.raised,
  outline: card.outline,
} as const;

const sizeMap = {
  small: card.small,
  medium: card.medium,
  large: card.large,
} as const;

export function Card({
  variant = 'base',
  size = 'medium',
  style,
  ...props
}: CardProps) {
  return (
    <div
      style={sx(
        card.base,
        variantMap[variant],
        sizeMap[size],
        style as CSSProperties,
      )}
      {...props}
    />
  );
}
