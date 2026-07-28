import type { HTMLAttributes, ImgHTMLAttributes, CSSProperties } from 'react';
import { avatar, sx } from '@/lib/components';

type Variant = 'primary' | 'secondary' | 'soft';
type Size = 'small' | 'medium' | 'large';

type BaseProps = {
  variant?: Variant;
  size?: Size;
  name?: string;
};

export type AvatarProps =
  | (BaseProps & HTMLAttributes<HTMLSpanElement> & { src?: undefined })
  | (BaseProps & ImgHTMLAttributes<HTMLImageElement> & { src: string });

const variantMap = {
  primary: avatar.primary,
  secondary: avatar.secondary,
  soft: avatar.soft,
} as const;

const sizeMap = {
  small: avatar.small,
  medium: avatar.medium,
  large: avatar.large,
} as const;

function initials(name?: string) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function Avatar({
  variant = 'secondary',
  size = 'medium',
  name,
  style,
  ...props
}: AvatarProps) {
  const base = sx(
    avatar.base,
    variantMap[variant],
    sizeMap[size],
    style as CSSProperties,
  );

  if ('src' in props && props.src) {
    const { src, alt, ...rest } = props;
    return (
      <img src={src} alt={alt ?? name ?? 'Avatar'} style={base} {...rest} />
    );
  }

  const { ...rest } = props as HTMLAttributes<HTMLSpanElement>;
  return (
    <span style={base} aria-label={name} {...rest}>
      {initials(name)}
    </span>
  );
}
