import { Role } from '@collega/domain/enums'
import { describe, expect, it } from 'vitest'
import { requestContextStorage } from '../src/common/request-context/request-context.js'
import { runAs } from '../src/common/request-context/run-as.js'

describe('runAs', () => {
  it('opens a store carrying exactly the given identity', () => {
    const identity = {
      userId: 'u1',
      organizationId: 'org-1',
      role: Role.User,
      isImpersonating: false,
      realUserId: 'u1',
    }
    runAs(identity, () => {
      expect(requestContextStorage.getStore()?.identity).toEqual(identity)
    })
  })

  it('gives each call its own requestId', () => {
    let first: string | undefined
    let second: string | undefined
    runAs(null, () => {
      first = requestContextStorage.getStore()?.requestId
    })
    runAs(null, () => {
      second = requestContextStorage.getStore()?.requestId
    })
    expect(first).toBeDefined()
    expect(second).toBeDefined()
    expect(first).not.toBe(second)
  })

  it('the store opened by runAs does not leak past its callback', () => {
    runAs(null, () => {})
    expect(requestContextStorage.getStore()).toBeUndefined()
  })
})
