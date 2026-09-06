// AuditEventInput mirrors Collega.Domain.Auditing.AuditEvent.Create's parameter list
// (src/Collega.Domain/Auditing/AuditEvent.cs), minus validation - Create threw on blank
// eventType/entityType/message, which the type system can't express and Wave C's writer
// is expected to enforce instead.
//
// The property under test here is entirely compile-time: `attribution` being the branded
// `Attribution` type, not a raw { actorUserId, onBehalfOfUserId } pair, is the only thing
// that forces a caller through attributeAudit's rule-14 rewrite. Nothing at runtime
// distinguishes a branded value from an unbranded one - `as Attribution` erases cleanly -
// so the only test that can actually catch a caller bypassing attributeAudit is a
// `@ts-expect-error` that fails the build (via `tsc -p tsconfig.json`) if the field is ever
// loosened back to a plain object shape. vitest alone would pass either way.

import { Role } from '@collega/domain/enums'
import { describe, expect, it } from 'vitest'
import type { AuditEventInput } from '../src/common/audit.js'
import { attributeAudit } from '../src/common/audit-attribution.js'
import type { CurrentUserContext } from '../src/common/current-user-context.js'

const currentUser: CurrentUserContext = {
  isAuthenticated: true,
  userId: 'user-1',
  organizationId: 'org-1',
  role: Role.OrgAdmin,
  isImpersonating: false,
  realUserId: 'user-1',
}

describe('AuditEventInput', () => {
  it('accepts an attribution produced by attributeAudit, and occurredAtUtc from Clock', () => {
    const occurredAtUtc = new Date('2026-01-01T00:00:00.000Z')
    const input: AuditEventInput = {
      organizationId: 'org-1',
      attribution: attributeAudit(currentUser, currentUser.userId),
      eventType: 'user.login',
      entityType: 'User',
      entityId: 'user-1',
      message: 'Signed in.',
      occurredAtUtc,
    }

    expect(input.attribution.actorUserId).toBe('user-1')
    expect(input.attribution.onBehalfOfUserId).toBeNull()
    expect(input.occurredAtUtc).toBe(occurredAtUtc)
  })

  it('rejects a raw {actorUserId, onBehalfOfUserId} pair in place of attributeAudit output (type-level)', () => {
    const input: AuditEventInput = {
      organizationId: 'org-1',
      // @ts-expect-error - `attribution` is the branded Attribution type; a plain object
      // with the right shape but no brand must be rejected, or a caller could write an
      // audit row with an unrewritten actor and the type system would never have noticed.
      attribution: { actorUserId: 'user-1', onBehalfOfUserId: null },
      eventType: 'user.login',
      entityType: 'User',
      entityId: 'user-1',
      message: 'Signed in.',
      occurredAtUtc: new Date(),
    }

    expect(input).toBeDefined()
  })

  it('requires occurredAtUtc - omitting it must not compile (type-level)', () => {
    // @ts-expect-error - audit_events.occurred_at_utc is non-nullable with no database
    // default; a writer inventing its own timestamp reintroduces the ambient-time problem
    // Clock exists to remove, one layer down.
    const input: AuditEventInput = {
      organizationId: 'org-1',
      attribution: attributeAudit(currentUser, currentUser.userId),
      eventType: 'user.login',
      entityType: 'User',
      entityId: 'user-1',
      message: 'Signed in.',
    }

    expect(input).toBeDefined()
  })

  it('preserves a null organizationId (system-level events are not scoped to an organization)', () => {
    const input: AuditEventInput = {
      organizationId: null,
      attribution: attributeAudit(currentUser, null),
      eventType: 'auth.login_failed',
      entityType: 'User',
      entityId: null,
      message: 'Login attempt failed.',
      occurredAtUtc: new Date(),
    }

    expect(input.organizationId).toBeNull()
    expect(input.entityId).toBeNull()
  })
})
