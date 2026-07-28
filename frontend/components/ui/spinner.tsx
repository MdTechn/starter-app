'use client';

type SpinnerProps = {
  size?: number;
  label?: string;
};

export function Spinner({ size = 40, label = 'Chargement' }: SpinnerProps) {
  return (
    <div
      className="global-loading-spinner"
      role="status"
      aria-label={label}
      style={{ width: size, height: size }}
    />
  );
}
