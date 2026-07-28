import type { BrandConfig, BrandTheme } from '@saas-starter/shared';
import type { CSSProperties } from 'react';

export const COLORS = {
  PRIMARY: '#3d9cf0',
  PRIMARY_DARK: '#2f86d4',
  PRIMARY_LIGHT: '#6bb5f5',
  SECONDARY: '#1e3a5f',
  SECONDARY_DARK: '#142033',
  SECONDARY_LIGHT: '#2a4d7a',
  ACCENT: '#3d9cf0',

  SUCCESS: '#16a34a',
  WARNING: '#f59e0b',
  ERROR: '#e11d48',
  INFO: '#3d9cf0',

  WHITE: '#ffffff',
  BLACK: '#000000',
  LIGHT_GRAY: '#f4f7fb',

  TEXT_PRIMARY: '#142033',
  TEXT_SECONDARY: '#5b6b7c',
  TEXT_MUTED: '#8b9aab',
  TEXT_ON_PRIMARY: '#ffffff',
  TEXT_PLACEHOLDER: '#8b9aab',

  BACKGROUND: '#ffffff',
  SURFACE: '#ffffff',
  BORDER: '#d5dee8',
  OVERLAY: 'rgba(20, 32, 51, 0.4)',

  INPUT_BG: '#ffffff',
  INPUT_BG_DISABLED: '#f4f7fb',

  SOCIAL_GOOGLE: '#5b9bd5',
  SOCIAL_FACEBOOK: '#4267b2',
  BADGE_ERROR_BG: '#dc2626',
} as const;

export const THEME_COLORS = {
  dark: {
    BACKGROUND: '#0f1419',
    FOREGROUND: '#e8eef4',
    MUTED: '#8b9aab',
    SURFACE: '#1a222d',
    BORDER: '#2a3544',
    ERROR: '#f87171',
    SUCCESS: '#86efac',
    WARNING: '#fcd34d',
    DANGER: '#fca5a5',
    UPLOAD_TRACK: '#0b1016',
  },
  light: {
    BACKGROUND: '#f4f7fb',
    FOREGROUND: '#142033',
    MUTED: '#5b6b7c',
    SURFACE: '#ffffff',
    BORDER: '#d5dee8',
    ERROR: '#e11d48',
    SUCCESS: '#15803d',
    WARNING: '#a16207',
    DANGER: '#be123c',
    UPLOAD_TRACK: '#e8eef4',
  },
} as const;

export const TYPOGRAPHY = {
  FONT_FAMILY_PRIMARY: "'Segoe UI', system-ui, sans-serif",
  FONT_FAMILY_MONO: 'ui-monospace, monospace',

  FONT_SIZE_XS: 'clamp(.65rem, .6rem + .2vw, .75rem)',
  FONT_SIZE_SM: 'clamp(.75rem, .7rem + .25vw, .85rem)',
  FONT_SIZE_BASE: 'clamp(.875rem, .825rem + .25vw, .95rem)',
  FONT_SIZE_LG: 'clamp(1rem, .9rem + .5vw, 1.25rem)',
  FONT_SIZE_XL: 'clamp(1.25rem, 1.05rem + .9vw, 1.75rem)',
  FONT_SIZE_2XL: 'clamp(1.4rem, 1.15rem + 1.1vw, 2rem)',

  LINE_HEIGHT_TIGHT: 1.2,
  LINE_HEIGHT_NORMAL: 1.4,
  LINE_HEIGHT_RELAXED: 1.6,

  FONT_WEIGHT_NORMAL: '400',
  FONT_WEIGHT_MEDIUM: '500',
  FONT_WEIGHT_SEMIBOLD: '600',
  FONT_WEIGHT_BOLD: '700',
} as const;

export const SPACING = {
  XS: '.25rem',
  SM: '.5rem',
  MD: '1rem',
  LG: '1.5rem',
  XL: '2rem',
  XXL: '3rem',
  XXXL: '4rem',
} as const;

export const BORDER_RADIUS = {
  SM: '.25rem',
  MD: '.5rem',
  LG: '.75rem',
  XL: '1rem',
  PILL: '9999px',
} as const;

export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
} as const;

export const MEDIA = {
  sm: `@media (min-width: ${BREAKPOINTS.SM}px)`,
  md: `@media (min-width: ${BREAKPOINTS.MD}px)`,
  lg: `@media (min-width: ${BREAKPOINTS.LG}px)`,
  xl: `@media (min-width: ${BREAKPOINTS.XL}px)`,
  maxSm: `@media (max-width: ${BREAKPOINTS.SM - 1}px)`,
  maxMd: `@media (max-width: ${BREAKPOINTS.MD - 1}px)`,
} as const;

export const SHADOWS = {
  SMALL: '0 1px 2px rgba(0, 0, 0, 0.08)',
  MEDIUM: '0 4px 12px rgba(0, 0, 0, 0.1)',
  LARGE: '0 8px 28px rgba(20, 32, 51, 0.12)',
} as const;

export const LAYOUT = {
  INPUT_HEIGHT_SM: '2rem',
  INPUT_HEIGHT: '2.5rem',
  INPUT_HEIGHT_LG: '2.875rem',
  MAX_MODAL_HEIGHT: '90vh',
  MAIN_MAX_WIDTH: 'none',
  ADMIN_MAX_WIDTH: 'none',
  CMS_MAX_WIDTH: 'none',
  LOGIN_ACTIONS_MAX: '22rem',
  PAGE_PADDING_X: 'clamp(1rem, 3vw, 1.5rem)',
  PAGE_PADDING_Y: 'clamp(1.5rem, 5vw, 4rem)',
  CONTAINER: 'min(100% - 2rem, 72rem)',
} as const;

export type Style = CSSProperties;

export function sx(...parts: Array<Style | false | null | undefined>): Style {
  return Object.assign({}, ...parts.filter(Boolean));
}

export function themeSurface(mode: BrandTheme = 'light') {
  return THEME_COLORS[mode];
}

/** Apply design-token CSS variables on :root (used by BrandProvider). */
export function applyThemeCssVars(brand: BrandConfig) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const surface = themeSurface(brand.theme);

  root.dataset.theme = brand.theme;
  root.classList.toggle('dark', brand.theme === 'dark');
  root.style.setProperty('--accent', brand.primaryColor || COLORS.PRIMARY);
  root.style.setProperty(
    '--brand-secondary',
    brand.secondaryColor || COLORS.SECONDARY,
  );
  root.style.setProperty(
    '--font',
    brand.fontFamily || TYPOGRAPHY.FONT_FAMILY_PRIMARY,
  );

  root.style.setProperty('--bg', surface.BACKGROUND);
  root.style.setProperty('--fg', surface.FOREGROUND);
  root.style.setProperty('--muted', surface.MUTED);
  root.style.setProperty('--surface', surface.SURFACE);
  root.style.setProperty('--border', surface.BORDER);
  root.style.setProperty('--error', surface.ERROR);
  root.style.setProperty('--success', surface.SUCCESS);
  root.style.setProperty('--warning', surface.WARNING);
  root.style.setProperty('--danger', surface.DANGER);
  root.style.setProperty('--upload-track', surface.UPLOAD_TRACK);

  root.style.setProperty('--space-xs', SPACING.XS);
  root.style.setProperty('--space-sm', SPACING.SM);
  root.style.setProperty('--space-md', SPACING.MD);
  root.style.setProperty('--space-lg', SPACING.LG);
  root.style.setProperty('--space-xl', SPACING.XL);
  root.style.setProperty('--space-xxl', SPACING.XXL);

  root.style.setProperty('--radius-sm', BORDER_RADIUS.SM);
  root.style.setProperty('--radius-md', BORDER_RADIUS.MD);
  root.style.setProperty('--radius-lg', BORDER_RADIUS.LG);
  root.style.setProperty('--radius-xl', BORDER_RADIUS.XL);
  root.style.setProperty('--radius-pill', BORDER_RADIUS.PILL);

  root.style.setProperty('--font-xs', TYPOGRAPHY.FONT_SIZE_XS);
  root.style.setProperty('--font-sm', TYPOGRAPHY.FONT_SIZE_SM);
  root.style.setProperty('--font-base', TYPOGRAPHY.FONT_SIZE_BASE);
  root.style.setProperty('--font-lg', TYPOGRAPHY.FONT_SIZE_LG);
  root.style.setProperty('--font-xl', TYPOGRAPHY.FONT_SIZE_XL);
  root.style.setProperty('--font-2xl', TYPOGRAPHY.FONT_SIZE_2XL);

  root.style.setProperty('--shadow-sm', SHADOWS.SMALL);
  root.style.setProperty('--shadow-md', SHADOWS.MEDIUM);
  root.style.setProperty('--shadow-lg', SHADOWS.LARGE);

  root.style.setProperty('--bp-sm', `${BREAKPOINTS.SM}px`);
  root.style.setProperty('--bp-md', `${BREAKPOINTS.MD}px`);
  root.style.setProperty('--bp-lg', `${BREAKPOINTS.LG}px`);
  root.style.setProperty('--page-pad-x', LAYOUT.PAGE_PADDING_X);
  root.style.setProperty('--page-pad-y', LAYOUT.PAGE_PADDING_Y);
  root.style.setProperty('--main-max', LAYOUT.MAIN_MAX_WIDTH);
  root.style.setProperty('--admin-max', LAYOUT.ADMIN_MAX_WIDTH);
  root.style.setProperty('--cms-max', LAYOUT.CMS_MAX_WIDTH);
}

/** SSR-safe :root defaults (light) matching theme tokens. */
export function getRootCssVars(mode: BrandTheme = 'light'): string {
  const surface = themeSurface(mode);
  return [
    `--bg: ${surface.BACKGROUND}`,
    `--fg: ${surface.FOREGROUND}`,
    `--muted: ${surface.MUTED}`,
    `--accent: ${COLORS.PRIMARY}`,
    `--brand-secondary: ${COLORS.SECONDARY}`,
    `--surface: ${surface.SURFACE}`,
    `--border: ${surface.BORDER}`,
    `--font: ${TYPOGRAPHY.FONT_FAMILY_PRIMARY}`,
    `--error: ${surface.ERROR}`,
    `--success: ${surface.SUCCESS}`,
    `--warning: ${surface.WARNING}`,
    `--danger: ${surface.DANGER}`,
    `--upload-track: ${surface.UPLOAD_TRACK}`,
    `--space-xs: ${SPACING.XS}`,
    `--space-sm: ${SPACING.SM}`,
    `--space-md: ${SPACING.MD}`,
    `--space-lg: ${SPACING.LG}`,
    `--space-xl: ${SPACING.XL}`,
    `--space-xxl: ${SPACING.XXL}`,
    `--radius-sm: ${BORDER_RADIUS.SM}`,
    `--radius-md: ${BORDER_RADIUS.MD}`,
    `--radius-lg: ${BORDER_RADIUS.LG}`,
    `--radius-xl: ${BORDER_RADIUS.XL}`,
    `--radius-pill: ${BORDER_RADIUS.PILL}`,
    `--font-xs: ${TYPOGRAPHY.FONT_SIZE_XS}`,
    `--font-sm: ${TYPOGRAPHY.FONT_SIZE_SM}`,
    `--font-base: ${TYPOGRAPHY.FONT_SIZE_BASE}`,
    `--font-lg: ${TYPOGRAPHY.FONT_SIZE_LG}`,
    `--font-xl: ${TYPOGRAPHY.FONT_SIZE_XL}`,
    `--font-2xl: ${TYPOGRAPHY.FONT_SIZE_2XL}`,
    `--shadow-sm: ${SHADOWS.SMALL}`,
    `--shadow-md: ${SHADOWS.MEDIUM}`,
    `--shadow-lg: ${SHADOWS.LARGE}`,
    `--page-pad-x: ${LAYOUT.PAGE_PADDING_X}`,
    `--page-pad-y: ${LAYOUT.PAGE_PADDING_Y}`,
    `--main-max: ${LAYOUT.MAIN_MAX_WIDTH}`,
    `--admin-max: ${LAYOUT.ADMIN_MAX_WIDTH}`,
    `--cms-max: ${LAYOUT.CMS_MAX_WIDTH}`,
  ].join(';');
}
