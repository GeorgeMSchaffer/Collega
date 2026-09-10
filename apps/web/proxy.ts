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
 *
 * Which is why this file also has to be the one that *drops* such a cookie. `requireCurrentUser`
 * finds out the token is dead, but it is rendering, and cookies are immutable during a render — so
 * it can only redirect, and a plain redirect to `/login` would bounce straight back off the rule
 * below. Deleting the cookie here on the way past is the half that ends the cycle.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME } from '@/lib/api/config'

/** Everything the reader sees without signing in. */
const PUBLIC_PATHS = ['/login', '/register', '/change-password']

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl
  const signedIn = request.cookies.has(SESSION_COOKIE_NAME)
  const isPublic = PUBLIC_PATHS.includes(pathname)

  if (!signedIn && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // `/change-password` is the exception and stays reachable while signed in — it is the only way
  // out of a forced rotation, and the API allowlists it for exactly that reason. `/register` is not
  // like it: an account holder has nothing to do on it, and `POST /auth/register` is anonymous, so
  // submitting it while signed in would silently create a *second* account rather than adding the
  // current one to another organization.
  if (signedIn && (pathname === '/login' || pathname === '/register')) {
    // `?expired=1` is `requireCurrentUser` saying the API refused this cookie. Cookie-and-JWT
    // share a lifetime, so ordinary expiry drops both together and never lands here — but a
    // rotated signing key, a deactivated account, a reseeded database or a fast browser clock all
    // leave a live cookie the API rejects, and without this the reader can only reach the form by
    // clearing site data by hand. Dropping the cookie as well as letting the request through is
    // what keeps the next navigation from paying another wasted `/auth/me`.
    //
    // Only `/login` has it, because only `/login` is redirected to — nothing sends a reader to
    // `/register` to recover from anything, and a stale cookie reaching here is bounced to
    // `/boards`, which resolves the principal properly and lands them back on `/login?expired=1`.
    if (pathname === '/login' && request.nextUrl.searchParams.has('expired')) {
      const response = NextResponse.next()
      response.cookies.delete(SESSION_COOKIE_NAME)
      return response
    }
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
