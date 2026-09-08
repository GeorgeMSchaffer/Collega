import { AsyncLocalStorage } from 'node:async_hooks'
import type { PrismaUnitOfWork } from '@collega/infrastructure/persistence'

/**
 * A SEPARATE `AsyncLocalStorage` from `request-context.ts`'s `requestContextStorage`, holding
 * this request's `PrismaUnitOfWork` buffer rather than its identity.
 *
 * Two reasons, not one:
 *
 * 1. `tools/arch/identity-chokepoint.test.ts` asserts an EXACT list of files permitted to read
 *    `requestContextStorage` directly. A unit-of-work reader has nothing to do with identity and
 *    does not belong on that list - reusing the identity store would force adding one, which
 *    would make the chokepoint test's list mean "reads identity or persistence state", when its
 *    whole point is to mean only the former.
 * 2. Findings 07 section 13 uncertainty 4 leaves the choice open ("either works - deciding it
 *    once matters") between one store or two. Two keeps identity and persistence from sharing a
 *    lifetime for reasons unrelated to each other - a future change to one store's shape (say,
 *    carrying a second, nested transaction handle) cannot accidentally widen what the identity
 *    chokepoint test has to reason about.
 */
export const unitOfWorkStorage = new AsyncLocalStorage<PrismaUnitOfWork>()

/**
 * Thrown when `AlsUnitOfWork` is used outside a request. Mirrors `NoAmbientIdentityError`:
 * background work must supply its own `PrismaUnitOfWork` explicitly rather than silently getting
 * none - a repository that quietly no-ops its writes is a worse failure than one that throws.
 */
export class NoAmbientUnitOfWorkError extends Error {
  constructor() {
    super(
      'No unit-of-work in scope. A PrismaUnitOfWork is only ambient inside an HTTP request. ' +
        'Background work must open its own via unitOfWorkStorage.run().',
    )
    this.name = 'NoAmbientUnitOfWorkError'
  }
}
