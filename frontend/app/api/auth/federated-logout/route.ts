import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Ends the Keycloak SSO session (back-channel) and returns the
 * front-channel logout URL so the browser also clears KC cookies.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  const issuer = process.env.AUTH_KEYCLOAK_ISSUER;
  const clientId = process.env.AUTH_KEYCLOAK_ID ?? 'saas-web';
  const frontend =
    process.env.FRONTEND_URL ?? process.env.APP_URL ?? req.nextUrl.origin;

  if (!issuer || !secret) {
    return NextResponse.json(
      { ok: false, error: 'Keycloak logout not configured' },
      { status: 500 },
    );
  }

  const redirectParam = req.nextUrl.searchParams.get('redirect') || '/';
  const safeRedirect = redirectParam.startsWith('/') ? redirectParam : '/login';
  const postLogout = `${frontend.replace(/\/$/, '')}${safeRedirect === '/' ? '/' : safeRedirect}`;

  const token = await getToken({ req, secret });
  const refreshToken = token?.refreshToken as string | undefined;
  const idToken = token?.idToken as string | undefined;

  if (refreshToken) {
    try {
      await fetch(`${issuer}/protocol/openid-connect/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          ...(process.env.AUTH_KEYCLOAK_SECRET
            ? { client_secret: process.env.AUTH_KEYCLOAK_SECRET }
            : {}),
          refresh_token: refreshToken,
        }),
      });
    } catch {
      // Best-effort; front-channel logout still runs.
    }
  }

  const logoutUrl = new URL(`${issuer}/protocol/openid-connect/logout`);
  logoutUrl.searchParams.set('client_id', clientId);
  logoutUrl.searchParams.set('post_logout_redirect_uri', postLogout);
  if (idToken) {
    logoutUrl.searchParams.set('id_token_hint', idToken);
  }

  return NextResponse.json({
    ok: true,
    logoutUrl: logoutUrl.toString(),
  });
}
