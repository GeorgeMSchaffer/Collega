import { AsyncLocalStorage } from 'node:async_hooks'
import type { Role } from '@collega/domain/enums'

/**
 * Already-resolved effective identity. `role` is the TARGET's role during impersonation -
 * that single fact is what makes authorization apply to the impersonated user without any
 * authorization code knowing impersonation exists.
 */
export interface ResolvedIdentity {
  readonly userId: string
  readonly organizationId: string | null
  readonly role: Role
  readonly isImpersonating: boolean
  readonly realUserId: string
}

export interface RequestContext {
  identity: ResolvedIdentity | null
  readonly requestId: string
}

/**
 * The ONLY module permitted to construct or read this directly. The Biome override on
 * apps/api and tools/arch/identity-chokepoint.test.ts both enforce that.
 *
 * AsyncLocalStorage rather than a Nest request-scoped provider: request scope would bubble
 * through 14 of the 16 concrete application services and 14 of the 15 controllers above
 * them; Scope.REQUEST cannot cross the package boundary, so the lifetime rule protecting a
 * property of packages/application would live entirely in apps/api, invisible from the code
 * depending on it; and Wave B's tests would then need a Nest runtime Wave D has not built.
 */
export const requestContextStorage = new AsyncLocalStorage<RequestContext>()

/**
 * Thrown when identity is read outside a request. An absent store and an anonymous request
 * are DIFFERENT conditions and must not collapse into one: returning nulls for an absent
 * store would let `ensureNotDirectSiteAdmin` pass for background work.
 */
export class NoAmbientIdentityError extends Error {
  constructor() {
    super(
      'No request context. Identity is only ambient inside an HTTP request. ' +
        'Background work must supply one explicitly via runAs().',
    )
    this.name = 'NoAmbientIdentityError'
  }
}
