// SPEC/typescript-conversion-map/findings/07-nest-ambient-identity.md sections 4.3 and 11.
//
// These are the highest-value tests in the request-context module: a bug here is silent
// and permanent in the direction of over-permission (an absent store read as anonymous) or
// of one user's identity leaking into another's request (a cached field on the singleton).

import { Role } from '@collega/domain/enums'
import { describe, expect, it } from 'vitest'
import { AlsCurrentUserContext } from '../src/common/request-context/als-current-user-context.js'
import {
  NoAmbientIdentityError,
  type ResolvedIdentity,
  requestContextStorage,
} from '../src/common/request-context/request-context.js'
import { runAs, SYSTEM_IDENTITY } from '../src/common/request-context/run-as.js'

const TARGET: ResolvedIdentity = {
  userId: 'target-user',
  organizationId: 'org-1',
  role: Role.OrgAdmin,
  isImpersonating: true,
  realUserId: 'admin-user',
}

const OTHER: ResolvedIdentity = {
  userId: 'other-user',
  organizationId: 'org-2',
  role: Role.User,
  isImpersonating: false,
  realUserId: 'other-user',
}

describe('AlsCurrentUserContext', () => {
  it('throws NoAmbientIdentityError when read with no store open - it must NOT read as anonymous', () => {
    const ctx = new AlsCurrentUserContext()
    // If this returned nulls instead, ensureNotDirectSiteAdmin(ctx) would see role === null
    // and silently PASS for background work that never opened a request context - the
    // over-permission failure direction the spec names in section 11.
    expect(() => ctx.isAuthenticated).toThrow(NoAmbientIdentityError)
    expect(() => ctx.userId).toThrow(NoAmbientIdentityError)
    expect(() => ctx.organizationId).toThrow(NoAmbientIdentityError)
    expect(() => ctx.role).toThrow(NoAmbientIdentityError)
    expect(() => ctx.isImpersonating).toThrow(NoAmbientIdentityError)
    expect(() => ctx.realUserId).toThrow(NoAmbientIdentityError)
  })

  it('an open store with identity: null (an anonymous request, e.g. POST /auth/login) is a different, legitimate condition - no throw', () => {
    const ctx = new AlsCurrentUserContext()
    requestContextStorage.run({ identity: null, requestId: 'req-anon' }, () => {
      expect(ctx.isAuthenticated).toBe(false)
      expect(ctx.userId).toBeNull()
      expect(ctx.organizationId).toBeNull()
      expect(ctx.role).toBeNull()
      expect(ctx.isImpersonating).toBe(false)
      expect(ctx.realUserId).toBeNull()
    })
  })

  it('the singleton does not cache: the SAME instance reports each of two sequential contexts correctly', () => {
    // This is the test a constructor doing `this.role = store.identity.role` would fail. That
    // version would pass every test above (and even the first run of this one) and would only
    // fail here, on the second identity - which is exactly the serverless warm-container bug
    // section 4.3 calls out: a singleton built once must never snapshot identity into a field.
    const ctx = new AlsCurrentUserContext()

    runAs(TARGET, () => {
      expect(ctx.userId).toBe(TARGET.userId)
      expect(ctx.organizationId).toBe(TARGET.organizationId)
      expect(ctx.role).toBe(TARGET.role)
      expect(ctx.isImpersonating).toBe(true)
      expect(ctx.realUserId).toBe(TARGET.realUserId)
    })

    runAs(OTHER, () => {
      expect(ctx.userId).toBe(OTHER.userId)
      expect(ctx.organizationId).toBe(OTHER.organizationId)
      expect(ctx.role).toBe(OTHER.role)
      expect(ctx.isImpersonating).toBe(false)
      expect(ctx.realUserId).toBe(OTHER.realUserId)
    })

    // And back outside both: the store is gone again, not stuck on the last identity.
    expect(() => ctx.userId).toThrow(NoAmbientIdentityError)
  })

  it('runAs(SYSTEM_IDENTITY, ...) opens a store whose identity is null', () => {
    expect(SYSTEM_IDENTITY).toBeNull()
    const ctx = new AlsCurrentUserContext()
    runAs(SYSTEM_IDENTITY, () => {
      expect(ctx.isAuthenticated).toBe(false)
      expect(ctx.userId).toBeNull()
      expect(ctx.role).toBeNull()
    })
  })
})
