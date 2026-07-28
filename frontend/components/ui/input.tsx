'use client';

import {
  forwardRef,
  type InputHTMLAttributes,
  type CSSProperties,
} from 'react';
import { input, sx } from '@/lib/components';

type Size = 'small' | 'medium' | 'large';

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  inputSize?: Size;
  error?: boolean;
};

const sizeMap = {
  small: input.small,
  medium: input.medium,
  large: input.large,
} as const;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { inputSize = 'medium', error = false, disabled, style, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      disabled={disabled}
      style={sx(
        input.base,
        sizeMap[inputSize],
        error && input.error,
        disabled && input.disabled,
        style as CSSProperties,
      )}
      {...props}
    />
  );
});
