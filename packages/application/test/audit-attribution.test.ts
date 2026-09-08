// SPEC/typescript-conversion-map/findings/07-nest-ambient-identity.md section 8.
//
// attributeAudit is a pure function of the context, deliberately conditional. Each branch
// below is one of the four the spec calls out; the fourth (not impersonating) doubles as a
// regression test for the condition itself - see its comment.

import { Role } from '@collega/domain/enums'
import { describe, expect, it } from 'vitest'
import { attributeAudit } from '../src/common/audit-attribution.js'
import type { CurrentUserContext } from '../src/common/current-user-context.js'

const ADMIN = 'admin-user-id'
const TARGET = 'target-user-id'
const THIRD_PARTY = 'third-party-user-id'

function impersonating(overrides: Partial<CurrentUserContext> = {}): CurrentUserContext {
  return {
    isAuthenticated: true,
    userId: TARGET,
    organizationId: 'org-1',
    role: Role.OrgAdmin,
    isImpersonating: true,
    realUserId: ADMIN,
    ...overrides,
  }
}

// Not impersonating: realUserId equals userId, per CurrentUserContext's own contract.
function notImpersonating(overrides: Partial<CurrentUserContext> = {}): CurrentUserContext {
  return {
    isAuthenticated: true,
    userId: ADMIN,
    organizationId: 'org-1',
    role: Role.OrgAdmin,
    isImpersonating: false,
    realUserId: ADMIN,
    ...overrides,
  }
}

describe('attributeAudit', () => {
  it('rule 14: impersonating and the intended actor is the acting (impersonated) user - the real admin becomes actor, the target moves to onBehalfOf', () => {
    const result = attributeAudit(impersonating(), TARGET)
    expect(result.actorUserId).toBe(ADMIN)
    expect(result.onBehalfOfUserId).toBe(TARGET)
  })

  it('impersonating, but the intended actor is a third party - passes through untouched, onBehalfOfUserId null', () => {
    const result = attributeAudit(impersonating(), THIRD_PARTY)
    expect(result.actorUserId).toBe(THIRD_PARTY)
    expect(result.onBehalfOfUserId).toBeNull()
  })

  it('impersonating, but the intended actor is null (a login-failure event, which runs before any authenticated context exists) - passes through untouched', () => {
    const result = attributeAudit(impersonating(), null)
    expect(result.actorUserId).toBeNull()
    expect(result.onBehalfOfUserId).toBeNull()
  })

  it('not impersonating - passes through untouched, even when the intended actor equals the acting user', () => {
    // The intended actor here (ADMIN) equals both userId and realUserId on this context,
    // because they are the same person when not impersonating. That makes this the one test
    // that would fail if the implementation dropped `currentUser.isImpersonating` from the
    // condition and rewrote on `intendedActorUserId === currentUser.userId` alone: it would
    // still report actorUserId ADMIN by coincidence, but onBehalfOfUserId would become ADMIN
    // instead of staying null. Assert both.
    const result = attributeAudit(notImpersonating(), ADMIN)
    expect(result.actorUserId).toBe(ADMIN)
    expect(result.onBehalfOfUserId).toBeNull()
  })
})
