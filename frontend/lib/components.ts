import {
  BORDER_RADIUS,
  COLORS,
  LAYOUT,
  SPACING,
  TYPOGRAPHY,
  sx,
  type Style,
} from './theme';

const surface: Style = {
  background: 'var(--surface)',
  color: 'var(--fg)',
  border: '1px solid var(--border)',
};

export const button = {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.SM,
    border: '1px solid transparent',
    borderRadius: BORDER_RADIUS.MD,
    fontFamily: 'var(--font)',
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_SEMIBOLD,
    lineHeight: TYPOGRAPHY.LINE_HEIGHT_TIGHT,
    cursor: 'pointer',
    userSelect: 'none',
    textDecoration: 'none',
    transition: 'background .15s, border-color .15s, opacity .15s',
  } satisfies Style,
  primary: {
    background: 'var(--accent)',
    color: COLORS.TEXT_ON_PRIMARY,
    borderColor: 'var(--accent)',
  } satisfies Style,
  secondary: {
    background: 'var(--brand-secondary)',
    color: COLORS.TEXT_ON_PRIMARY,
    borderColor: 'var(--brand-secondary)',
  } satisfies Style,
  outline: {
    background: 'transparent',
    color: 'var(--accent)',
    borderColor: 'var(--accent)',
  } satisfies Style,
  ghost: {
    background: 'var(--surface)',
    color: 'var(--fg)',
    borderColor: 'var(--border)',
  } satisfies Style,
  danger: {
    background: COLORS.ERROR,
    color: COLORS.TEXT_ON_PRIMARY,
    borderColor: COLORS.ERROR,
  } satisfies Style,
  social: {
    background: 'var(--surface)',
    color: 'var(--fg)',
    borderColor: 'var(--border)',
    textAlign: 'center',
  } satisfies Style,
  small: {
    padding: `${SPACING.XS} ${SPACING.SM}`,
    fontSize: 'var(--font-sm)',
  } satisfies Style,
  medium: {
    padding: `.45rem .875rem`,
    fontSize: 'var(--font-base)',
  } satisfies Style,
  large: {
    padding: `.65rem 1.15rem`,
    fontSize: 'var(--font-lg)',
  } satisfies Style,
  fullWidth: { width: '100%' } satisfies Style,
  disabled: { opacity: 0.5, cursor: 'not-allowed' } satisfies Style,
};

export const card = {
  base: {
    ...surface,
    borderRadius: BORDER_RADIUS.LG,
    boxShadow: 'var(--shadow-md)',
    padding: SPACING.MD,
  } satisfies Style,
  flat: { boxShadow: 'none' } satisfies Style,
  raised: { boxShadow: 'var(--shadow-lg)' } satisfies Style,
  outline: { boxShadow: 'none', background: 'transparent' } satisfies Style,
  small: {
    padding: SPACING.SM,
    borderRadius: BORDER_RADIUS.MD,
  } satisfies Style,
  medium: {
    padding: SPACING.MD,
    borderRadius: BORDER_RADIUS.LG,
  } satisfies Style,
  large: {
    padding: SPACING.LG,
    borderRadius: BORDER_RADIUS.XL,
  } satisfies Style,
};

export const input = {
  base: {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    background: 'var(--surface)',
    color: 'var(--fg)',
    border: '1px solid var(--border)',
    borderRadius: BORDER_RADIUS.MD,
    fontFamily: 'var(--font)',
    fontSize: 'var(--font-base)',
    lineHeight: TYPOGRAPHY.LINE_HEIGHT_NORMAL,
    outline: 'none',
    transition: 'border-color .15s, box-shadow .15s',
  } satisfies Style,
  disabled: {
    background: 'color-mix(in srgb, var(--surface) 80%, var(--bg))',
    color: 'var(--muted)',
    cursor: 'not-allowed',
  } satisfies Style,
  error: {
    borderColor: 'var(--error)',
    boxShadow: '0 0 0 3px color-mix(in srgb, var(--error) 20%, transparent)',
  } satisfies Style,
  focused: {
    borderColor: 'var(--accent)',
    boxShadow: '0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent)',
  } satisfies Style,
  small: {
    padding: `${SPACING.XS} .6rem`,
    fontSize: 'var(--font-sm)',
    minHeight: LAYOUT.INPUT_HEIGHT_SM,
  } satisfies Style,
  medium: {
    padding: `.45rem .7rem`,
    fontSize: 'var(--font-base)',
    minHeight: LAYOUT.INPUT_HEIGHT,
  } satisfies Style,
  large: {
    padding: `.6rem ${SPACING.MD}`,
    fontSize: 'var(--font-lg)',
    minHeight: LAYOUT.INPUT_HEIGHT_LG,
  } satisfies Style,
};

export const badge = {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: SPACING.XS,
    borderRadius: BORDER_RADIUS.PILL,
    fontFamily: 'var(--font)',
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_SEMIBOLD,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    border: '1px solid var(--border)',
  } satisfies Style,
  primary: {
    background: 'color-mix(in srgb, var(--accent) 18%, transparent)',
    color: 'var(--accent)',
    borderColor: 'transparent',
  } satisfies Style,
  secondary: {
    background: 'color-mix(in srgb, var(--brand-secondary) 18%, transparent)',
    color: 'var(--fg)',
    borderColor: 'transparent',
  } satisfies Style,
  outline: {
    background: 'transparent',
    color: 'var(--accent)',
    borderColor: 'var(--accent)',
  } satisfies Style,
  success: {
    background: 'color-mix(in srgb, var(--success) 18%, transparent)',
    color: 'var(--success)',
    borderColor: 'color-mix(in srgb, var(--success) 40%, transparent)',
  } satisfies Style,
  error: {
    background: 'color-mix(in srgb, var(--error) 18%, transparent)',
    color: 'var(--error)',
    borderColor: 'color-mix(in srgb, var(--error) 40%, transparent)',
  } satisfies Style,
  warning: {
    background: 'color-mix(in srgb, var(--warning) 18%, transparent)',
    color: 'var(--warning)',
    borderColor: 'color-mix(in srgb, var(--warning) 40%, transparent)',
  } satisfies Style,
  small: {
    padding: '.15rem .45rem',
    fontSize: 'var(--font-xs)',
  } satisfies Style,
  medium: {
    padding: '.2rem .55rem',
    fontSize: 'var(--font-sm)',
  } satisfies Style,
  large: {
    padding: '.3rem .7rem',
    fontSize: 'var(--font-base)',
  } satisfies Style,
};

export const avatar = {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.PILL,
    background: 'var(--brand-secondary)',
    color: COLORS.TEXT_ON_PRIMARY,
    fontFamily: 'var(--font)',
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_SEMIBOLD,
    overflow: 'hidden',
    objectFit: 'cover',
    flexShrink: 0,
  } satisfies Style,
  primary: { background: 'var(--accent)' } satisfies Style,
  secondary: { background: 'var(--brand-secondary)' } satisfies Style,
  soft: {
    background: 'color-mix(in srgb, var(--accent) 18%, transparent)',
    color: 'var(--accent)',
  } satisfies Style,
  small: {
    width: '1.75rem',
    height: '1.75rem',
    fontSize: 'var(--font-xs)',
  } satisfies Style,
  medium: {
    width: 'clamp(2.25rem, 5vw, 2.5rem)',
    height: 'clamp(2.25rem, 5vw, 2.5rem)',
    fontSize: 'var(--font-sm)',
  } satisfies Style,
  large: {
    width: 'clamp(3rem, 8vw, 3.5rem)',
    height: 'clamp(3rem, 8vw, 3.5rem)',
    fontSize: 'var(--font-lg)',
  } satisfies Style,
};

export const modal = {
  overlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: COLORS.OVERLAY,
    padding: 'var(--page-pad-x)',
    zIndex: 50,
  } satisfies Style,
  panel: {
    ...surface,
    borderRadius: BORDER_RADIUS.LG,
    boxShadow: 'var(--shadow-lg)',
    width: '100%',
    maxHeight: LAYOUT.MAX_MODAL_HEIGHT,
    overflow: 'auto',
  } satisfies Style,
  sheet: {
    alignSelf: 'flex-end',
    borderRadius: `${BORDER_RADIUS.LG} ${BORDER_RADIUS.LG} 0 0`,
    maxHeight: '85vh',
  } satisfies Style,
  small: { maxWidth: 'min(22rem, 100%)', padding: SPACING.MD } satisfies Style,
  medium: { maxWidth: 'min(28rem, 100%)', padding: '1.25rem' } satisfies Style,
  large: { maxWidth: 'min(40rem, 100%)', padding: SPACING.LG } satisfies Style,
};

export const toast = {
  viewport: {
    position: 'fixed',
    top: SPACING.LG,
    right: SPACING.LG,
    left: 'auto',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: SPACING.SM,
    pointerEvents: 'none',
    maxWidth: 'min(24rem, calc(100vw - 2rem))',
    width: '100%',
  } satisfies Style,
  item: {
    pointerEvents: 'auto',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: SPACING.SM,
    width: '100%',
    padding: `${SPACING.SM} ${SPACING.MD}`,
    paddingBottom: `calc(${SPACING.SM} + 3px)`,
    background: 'var(--surface)',
    color: 'var(--fg)',
    border: '1px solid var(--border)',
    borderRadius: BORDER_RADIUS.XL,
    boxShadow: 'var(--shadow-md)',
    fontFamily: 'var(--font)',
    fontSize: 'var(--font-sm)',
    lineHeight: TYPOGRAPHY.LINE_HEIGHT_NORMAL,
    overflow: 'hidden',
    animation: 'toast-in .22s ease-out',
  } satisfies Style,
  message: {
    flex: 1,
    minWidth: 0,
    margin: 0,
  } satisfies Style,
  icon: {
    flexShrink: 0,
    display: 'inline-flex',
    width: '1.25rem',
    height: '1.25rem',
  } satisfies Style,
  close: {
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '1.5rem',
    height: '1.5rem',
    margin: 0,
    padding: 0,
    border: 'none',
    borderRadius: BORDER_RADIUS.SM,
    background: 'transparent',
    color: 'var(--muted)',
    cursor: 'pointer',
  } satisfies Style,
  accent: {
    position: 'absolute',
    left: BORDER_RADIUS.XL,
    right: BORDER_RADIUS.XL,
    bottom: 0,
    height: '2px',
    borderRadius: BORDER_RADIUS.PILL,
  } satisfies Style,
  success: { color: 'var(--success)' } satisfies Style,
  warning: { color: 'var(--warning)' } satisfies Style,
  info: { color: 'var(--accent)' } satisfies Style,
  error: { color: 'var(--error)' } satisfies Style,
  successAccent: { background: 'var(--success)' } satisfies Style,
  warningAccent: { background: 'var(--warning)' } satisfies Style,
  infoAccent: { background: 'var(--accent)' } satisfies Style,
  errorAccent: { background: 'var(--error)' } satisfies Style,
};

export const layout = {
  main: {
    maxWidth: 'none',
    margin: 0,
    padding: 'var(--page-pad-y) var(--page-pad-x)',
    width: '100%',
  } satisfies Style,
  login: {
    minHeight: '100dvh',
    width: '100%',
    maxWidth: 'none',
    margin: 0,
    padding: 'var(--page-pad-y) var(--page-pad-x)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  } satisfies Style,
  admin: {
    maxWidth: 'none',
    margin: 0,
    padding: 'var(--page-pad-y) var(--page-pad-x)',
    width: '100%',
  } satisfies Style,
  cms: {
    maxWidth: 'none',
    margin: 0,
    padding: 'var(--page-pad-y) var(--page-pad-x)',
    width: '100%',
  } satisfies Style,
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: SPACING.SM,
  } satisfies Style,
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SPACING.SM,
  } satisfies Style,
};

export const SharedStyles = {
  buttonPrimary: sx(button.base, button.primary, button.medium),
  buttonSecondary: sx(button.base, button.secondary, button.medium),
  buttonOutline: sx(button.base, button.outline, button.medium),
  buttonGhost: sx(button.base, button.ghost, button.medium),
  buttonDanger: sx(button.base, button.danger, button.medium),
  buttonSocial: sx(button.base, button.social, button.medium, button.fullWidth),

  card: sx(card.base, card.medium),
  cardRaised: sx(card.base, card.raised, card.medium),
  cardFlat: sx(card.base, card.flat, card.medium),

  input: sx(input.base, input.medium),
  inputError: sx(input.base, input.medium, input.error),
  inputDisabled: sx(input.base, input.medium, input.disabled),

  badgePrimary: sx(badge.base, badge.primary, badge.medium),
  badgeSuccess: sx(badge.base, badge.success, badge.medium),
  badgeError: sx(badge.base, badge.error, badge.medium),
  badgeWarning: sx(badge.base, badge.warning, badge.medium),

  avatar: sx(avatar.base, avatar.medium),
  avatarSoft: sx(avatar.base, avatar.soft, avatar.medium),

  modalOverlay: modal.overlay,
  modalPanel: sx(modal.panel, modal.medium),

  main: layout.main,
  login: layout.login,
  admin: layout.admin,
  cms: layout.cms,
};

export { sx };
