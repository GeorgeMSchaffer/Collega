// SPEC/typescript-conversion-map/findings/07-nest-ambient-identity.md section 9.
//
// The interesting property of this guard is what it does NOT do: there is no impersonation
// branch. `currentUser.role` already reports the TARGET's role during a live View As
// session, which is what lets one guard cover both the direct path and the View As path.
// The last test below documents that on purpose - it is the one a well-meaning "fix" that
// special-cases impersonation would break (rule 25b).

import { Role } from '@collega/domain/enums'
import { describe, expect, it } from 'vitest'
import type { CurrentUserContext } from '../src/common/current-user-context.js'
import { ForbiddenError } from '../src/common/errors.js'
import { ensureNotDirectSiteAdmin } from '../src/common/org-content-mutation-guard.js'

function ctx(overrides: Partial<CurrentUserContext>): CurrentUserContext {
  return {
    isAuthenticated: true,
    userId: 'user-1',
    organizationId: 'org-1',
    role: Role.User,
    isImpersonating: false,
    realUserId: 'user-1',
    ...overrides,
  }
}

describe('ensureNotDirectSiteAdmin', () => {
  it('throws ForbiddenError for a Site Admin acting directly', () => {
    expect(() => ensureNotDirectSiteAdmin(ctx({ role: Role.SiteAdmin }))).toThrow(ForbiddenError)
  })

  it.each([Role.OrgAdmin, Role.User, Role.ReadOnly])('does not throw for %s', (role) => {
    expect(() => ensureNotDirectSiteAdmin(ctx({ role }))).not.toThrow()
  })

  it('does NOT throw during impersonation, even though the real user (realUserId) is a Site Admin - there is deliberately no impersonation special case here, and this test is why one must never be added', () => {
    const impersonatedOrgAdmin = ctx({
      userId: 'target-user',
      role: Role.OrgAdmin, // the TARGET's role - this is the whole mechanism
      isImpersonating: true,
      realUserId: 'site-admin-user',
    })
    expect(() => ensureNotDirectSiteAdmin(impersonatedOrgAdmin)).not.toThrow()
  })
})
