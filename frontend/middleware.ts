import NextAuth from 'next-auth';
import { UserRole } from '@saas-starter/shared/auth';
import { NextResponse } from 'next/server';
import { authConfig } from './auth.config';

const { auth } = NextAuth(authConfig);

const publicPaths = ['/', '/login'];

function isPublicPath(pathname: string) {
  return (
    publicPaths.includes(pathname) ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/branding/')
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = isPublicPath(pathname);
  const sessionError = (req.auth as { error?: string } | null)?.error;
  const refreshFailed =
    sessionError === 'RefreshAccessTokenError' ||
    sessionError === 'RefreshTokenMissing';

  // Token / refresh expiré → forcer la page login (le client nettoie aussi la session).
  if (
    refreshFailed &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/api/auth')
  ) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('reason', 'session_expired');
    return NextResponse.redirect(loginUrl);
  }

  if (!isPublic && !req.auth) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith('/admin')) {
    const roles = (req.auth?.roles ?? []) as string[];
    const isAdmin = roles.includes(UserRole.ADMIN);
    if (!isAdmin) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|branding/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
