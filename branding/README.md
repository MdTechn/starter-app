# Branding assets

Place logos, favicons and icons here. They are served by the frontend at
`/branding/*` (symlink → `frontend/public/branding`).

| File | Usage |
|------|--------|
| `logo.svg` | Login, dashboard, emails |
| `favicon.svg` | Browser tab |
| `icon-192.svg` / `icon-512.svg` | PWA / manifest |
| `apple-touch-icon.svg` | iOS home screen |

Override URLs via `LOGO_URL`, `FAVICON_URL`, `ICON_URL`, etc. — see
[`docs/WHITE_LABEL.md`](../docs/WHITE_LABEL.md).
