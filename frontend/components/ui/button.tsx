'use client';

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
} from 'react';
import { button, sx } from '@/lib/components';

type Variant =
  'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'social';
type Size = 'small' | 'medium' | 'large';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
};

const variantMap = {
  primary: button.primary,
  secondary: button.secondary,
  outline: button.outline,
  ghost: button.ghost,
  danger: button.danger,
  social: button.social,
} as const;

const sizeMap = {
  small: button.small,
  medium: button.medium,
  large: button.large,
} as const;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'medium',
      fullWidth = false,
      disabled,
      style,
      type = 'button',
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        style={sx(
          button.base,
          variantMap[variant],
          sizeMap[size],
          fullWidth && button.fullWidth,
          disabled && button.disabled,
          style as CSSProperties,
        )}
        {...props}
      />
    );
  },
);
