'use client';

import { useBrand } from '@/providers';

type Props = {
  /** Smaller control for headers / sidebars. */
  compact?: boolean;
  className?: string;
};

/**
 * Pill toggle Light ↔ Dark — labels as plain text, lavender track, white thumb.
 */
export function ThemeSwitcher({ compact = false, className }: Props) {
  const { brand, setTheme, toggleTheme } = useBrand();
  const isDark = brand.theme === 'dark';

  return (
    <div
      className={[
        'theme-switcher',
        compact ? 'theme-switcher--compact' : '',
        isDark ? 'is-dark' : 'is-light',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className="theme-switcher__label"
        aria-pressed={!isDark}
        onClick={() => setTheme('light')}
      >
        Light
      </button>

      <button
        type="button"
        role="switch"
        className="theme-switcher__track"
        aria-checked={isDark}
        aria-label={isDark ? 'Passer en thème clair' : 'Passer en thème sombre'}
        onClick={() => toggleTheme()}
      >
        <span
          className="theme-switcher__star theme-switcher__star--sm"
          aria-hidden
        />
        <span
          className="theme-switcher__star theme-switcher__star--md"
          aria-hidden
        />
        <span className="theme-switcher__thumb" aria-hidden />
      </button>

      <button
        type="button"
        className="theme-switcher__label"
        aria-pressed={isDark}
        onClick={() => setTheme('dark')}
      >
        Dark
      </button>
    </div>
  );
}
