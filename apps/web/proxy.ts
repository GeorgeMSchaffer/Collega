/**
 * The cheap half of the route gate. (`proxy.ts` is Next 16's name for what was `middleware.ts`.)
 *
 * It answers one question — is there a session cookie at all? — and redirects to sign-in when there
 * is not. It deliberately does **not** call `/auth/me`: this runs on every request including
 * prefetches, it may be deployed to the edge away from the API, and a network round trip here would
 * be paid twice, because the layout has to resolve identity properly anyway.
 *
 * So the real gate is `app/(desk)/layout.tsx`, which resolves the principal and redirects on a 401.
 * This one exists to save an authenticated round trip for a reader who is plainly signed out, and
 * to keep a signed-in reader off the sign-in form. A present-but-expired cookie passes here and is
 * caught there, which is correct: only the API can say whether a token is still good.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME } from '@/lib/api/config'

/** Everything the reader sees without signing in. */
const PUBLIC_PATHS = ['/login', '/change-password']

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl
  const signedIn = request.cookies.has(SESSION_COOKIE_NAME)
  const isPublic = PUBLIC_PATHS.includes(pathname)

  if (!signedIn && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // `/change-password` stays reachable while signed in — it is the only way out of a forced
  // rotation, and the API allowlists it for exactly that reason.
  if (signedIn && pathname === '/login') {
    return NextResponse.redirect(new URL('/boards', request.url))
  }

  return NextResponse.next()
}

export const config = {
  // Without a matcher this runs on static assets too, and a redirect would then break the CSS on
  // the very sign-in page it was redirecting to.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
