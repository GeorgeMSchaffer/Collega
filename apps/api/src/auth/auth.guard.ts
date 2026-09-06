import { type CanActivate, Injectable } from '@nestjs/common'
import type { ResolvedIdentity } from '../common/request-context/request-context.js'
import { requestContextStorage } from '../common/request-context/request-context.js'

/**
 * Skeleton. S0.3 establishes the shape and the chokepoint; Wave D1/B7 fill in resolution.
 *
 * This file and the request-context module are the ONLY places on the API side permitted to
 * read a credential. Everything else asks CurrentUserContext. That is what lets View As work
 * without any authorization code knowing impersonation exists - and reading a credential
 * anywhere else silently opts that code out of impersonation.
 *
 * Resolution is one query, not four: the .NET path issued up to four sequential reads per
 * authenticated request while impersonating (user, open session, target, target's org).
 *
 * The role written here is the TARGET's role during a live session. Nothing recomputes it at
 * read time, which is what makes ensureNotDirectSiteAdmin correct without a special case.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(): boolean {
    const store = requestContextStorage.getStore()
    if (!store) {
      // The middleware did not run. Failing here is right: an absent store must never be
      // read as "anonymous", or ensureNotDirectSiteAdmin passes for an unauthenticated call.
      throw new Error(
        'RequestContextMiddleware did not run for this route. Identity cannot be resolved.',
      )
    }

    store.identity = this.resolve()
    return true
  }

  /**
   * Wave D1 replaces this: verify the session cookie, load the user, and if an open
   * impersonation session exists, resolve the target and report the target's role.
   */
  private resolve(): ResolvedIdentity | null {
    return null
  }
}
