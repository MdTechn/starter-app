'use client';

import { useState } from 'react';
import { useBrand } from '@/providers';

export function BrandLogo({
  height = 40,
  className,
}: {
  height?: number;
  className?: string;
}) {
  const { brand } = useBrand();
  const [failed, setFailed] = useState(false);

  if (failed || !brand.logoUrl) {
    return (
      <span
        className={className ?? 'brand-logo'}
        style={{
          display: 'inline-block',
          fontWeight: 650,
          fontSize: `clamp(1.1rem, 2.5vw, ${Math.max(height * 0.4, 18)}px)`,
          color: 'var(--fg)',
          marginBottom: 'var(--space-md)',
        }}
      >
        {brand.appName}
      </span>
    );
  }

  return (
    <img
      src={brand.logoUrl}
      alt={brand.appName}
      height={height}
      className={className ?? 'brand-logo'}
      style={{ height, width: 'auto', maxWidth: '100%' }}
      onError={() => setFailed(true)}
    />
  );
}
