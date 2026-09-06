import { Role } from '@collega/domain/enums'
import type { CurrentUserContext } from './current-user-context.js'
import { ForbiddenError } from './errors.js'

/**
 * Refuses organization-owned content mutations attempted by a Site Admin acting as
 * themselves (SPEC/20-feature-view-as.md rules 25-25b). View As is the mutation path.
 *
 * NO IMPERSONATION SPECIAL CASE, DELIBERATELY. While a View As session is live,
 * `currentUser.role` reports the TARGET's role rather than SiteAdmin, so this simply does
 * not fire. One guard therefore blocks the direct path and permits the View As path, and
 * the property that makes rule 4 work is what makes that true.
 *
 * Not for organization or user administration - those are the bootstrap exception
 * (rule 26). Reads are untouched: a Site Admin still sees everything.
 *
 * It must NOT become a Nest guard or a controller decorator. `@UseGuards(...)` is the
 * natural TypeScript idiom and it is the same mistake this rule was moved away from on
 * 2026-08-13: route-shaped enforcement is bypassable. Even after it moved into the
 * application layer, a third review pass found two unguarded paths - reassigning an idea
 * type, and CSV idea import, which let a refused Site Admin bulk-create exactly the ideas
 * they had just been refused one at a time. Both had been enumerated by hand rather than
 * found through a chokepoint. Call this from the service, at every mutation.
 */
export function ensureNotDirectSiteAdmin(currentUser: CurrentUserContext): void {
  if (currentUser.role === Role.SiteAdmin) {
    throw new ForbiddenError(
      'Site Admins cannot change organization content directly. ' +
        'Use View As to act as a user in that organization.',
    )
  }
}
