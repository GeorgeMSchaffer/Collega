import type { PrismaClient } from '@collega/infrastructure/persistence'
import { describe, expect, it } from 'vitest'
import { requestContextStorage } from '../src/common/request-context/request-context.js'
import { RequestContextMiddleware } from '../src/common/request-context/request-context.middleware.js'

// The middleware only hands this to a PrismaUnitOfWork constructor, which stores it untouched.
const stubPrisma = {} as PrismaClient

describe('RequestContextMiddleware', () => {
  it('opens an empty (identity: null), mutable store and calls next()', () => {
    const middleware = new RequestContextMiddleware(stubPrisma)
    let observed: unknown

    middleware.use({}, {}, () => {
      observed = requestContextStorage.getStore()
    })

    expect(observed).toBeDefined()
    expect((observed as { identity: unknown }).identity).toBeNull()
    expect(typeof (observed as { requestId: unknown }).requestId).toBe('string')
  })

  it('the store it opens is mutable - the guard can write identity into the same object later', () => {
    const middleware = new RequestContextMiddleware(stubPrisma)

    middleware.use({}, {}, () => {
      const store = requestContextStorage.getStore()
      if (!store) throw new Error('expected a store')
      // This is exactly what the guard does: writes into the object the middleware opened,
      // rather than opening a new store of its own.
      store.identity = {
        userId: 'u1',
        organizationId: null,
        role: 0 as never, // value irrelevant here; only mutability is under test
        isImpersonating: false,
        realUserId: 'u1',
      }
      expect(requestContextStorage.getStore()?.identity?.userId).toBe('u1')
    })
  })

  it('does not leak its store past the request - a later, unrelated read outside use() sees no store', () => {
    const middleware = new RequestContextMiddleware(stubPrisma)
    middleware.use({}, {}, () => {})
    expect(requestContextStorage.getStore()).toBeUndefined()
  })
})
