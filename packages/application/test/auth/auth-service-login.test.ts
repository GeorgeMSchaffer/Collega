// Sign-in (SPEC/20-feature-auth.md requirements 1, 6, 13, 15, 16, 32b; contracts/auth.md
// `POST /auth/login`). What the anonymous caller can learn from the answer is the point of most of
// these: an unknown address and a wrong password must be the same refusal, a lockout must be
// reachable only by someone who does not know the password (decision 2026-09-12), and no audit row
// may file a probed address under an organization it does not belong to.

import { UserStatus } from '@collega/domain/enums'
import { describe, expect, it } from 'vitest'
import { ForbiddenError, LockedOutError, UnauthorizedError } from '../../src/common/index.js'
import { NOW, ORG_A } from '../support/fixtures.js'
import {
  type AuthHarness,
  account,
  authHarness,
  movableClock,
  PASSWORD,
  passwordHasher,
  refusal,
} from './auth-harness.js'

const LOCKED_MESSAGE =
  'This account is locked due to too many failed login attempts. Try again in 15 minutes.'

async function failTimes(harness: AuthHarness, times: number, email = 'ann@acme.test') {
  const refusals: Error[] = []
  for (let i = 0; i < times; i++) {
    refusals.push(await refusal(harness.service.login({ email, password: 'Wrong1!x' })))
  }
  return refusals
}

describe('AuthService.login - no account enumeration', () => {
  it('refuses an unknown address with the same error class and message as a wrong password', async () => {
    const harness = authHarness()

    const unknown = await refusal(
      harness.service.login({ email: 'nobody@acme.test', password: PASSWORD }),
    )
    const wrong = await refusal(
      harness.service.login({ email: 'ann@acme.test', password: 'Wrong1!x' }),
    )

    expect(unknown).toBeInstanceOf(UnauthorizedError)
    expect(wrong).toBeInstanceOf(UnauthorizedError)
    expect(unknown.message).toBe('Invalid email or password.')
    expect(wrong.message).toBe(unknown.message)
  })

  it('writes nothing to the user store for an unknown address', async () => {
    const harness = authHarness()

    await refusal(harness.service.login({ email: 'nobody@acme.test', password: PASSWORD }))

    expect(harness.users.writes).toBe(0)
  })

  it('files a probe for an unknown address under no organization, so no tenant reads it', async () => {
    const harness = authHarness()

    await refusal(harness.service.login({ email: '  Nobody@Acme.test ', password: PASSWORD }))

    expect(harness.audit.events).toHaveLength(1)
    const [event] = harness.audit.events
    expect(event?.eventType).toBe('AuthLoginFailed')
    expect(event?.organizationId).toBeNull()
    expect(event?.entityId).toBeNull()
    expect(JSON.parse(event?.metadataJson ?? '{}')).toEqual({ email: 'nobody@acme.test' })
  })

  it("files a wrong password under the account's own organization, without the address or the password", async () => {
    const harness = authHarness()

    await refusal(harness.service.login({ email: 'ann@acme.test', password: 'Wrong1!x' }))

    const [event] = harness.audit.events
    expect(event?.organizationId).toBe(ORG_A)
    expect(event?.entityId).toBe('user-a')
    expect(event?.metadataJson).not.toContain('ann@acme.test')
    expect(event?.metadataJson).not.toContain('Wrong1!x')
    expect(JSON.parse(event?.metadataJson ?? '{}')).toEqual({ reason: 'InvalidPassword' })
  })
})

describe('AuthService.login - success', () => {
  it('matches the address case- and whitespace-insensitively', async () => {
    const harness = authHarness()

    const result = await harness.service.login({ email: '  ANN@Acme.Test ', password: PASSWORD })

    expect(result.user.userId).toBe('user-a')
  })

  it('issues the token over the stamp the account holds now', async () => {
    const harness = authHarness()
    const stamp = harness.users.byId.get('user-a')?.securityStamp

    const result = await harness.service.login({ email: 'ann@acme.test', password: PASSWORD })

    expect(result.accessToken).toBe(`token:user-a:${stamp}`)
    expect(result.expiresInSeconds).toBe(28_800)
  })

  it('reports requiresPasswordChange from the account, true and false', async () => {
    const pending = authHarness({ users: [account({ mustChangePassword: true })] })
    const settled = authHarness()

    const pendingResult = await pending.service.login({
      email: 'ann@acme.test',
      password: PASSWORD,
    })
    const settledResult = await settled.service.login({
      email: 'ann@acme.test',
      password: PASSWORD,
    })

    expect(pendingResult.requiresPasswordChange).toBe(true)
    expect(settledResult.requiresPasswordChange).toBe(false)
  })

  it('audits the success as the account itself', async () => {
    const harness = authHarness()

    await harness.service.login({ email: 'ann@acme.test', password: PASSWORD })

    const [event] = harness.audit.events
    expect(event?.eventType).toBe('AuthLoginSucceeded')
    expect(event?.organizationId).toBe(ORG_A)
    expect(event?.attribution.actorUserId).toBe('user-a')
  })

  it('clears the failed-attempt counter', async () => {
    const harness = authHarness()
    await failTimes(harness, 3)

    await harness.service.login({ email: 'ann@acme.test', password: PASSWORD })

    expect(harness.users.byId.get('user-a')?.failedLoginCount).toBe(0)
  })
})

describe('AuthService.login - inactive accounts (requirement 15)', () => {
  it('refuses the correct password with 403, not a session', async () => {
    const harness = authHarness({ users: [account({ status: UserStatus.Inactive })] })

    const error = await refusal(
      harness.service.login({ email: 'ann@acme.test', password: PASSWORD }),
    )

    expect(error).toBeInstanceOf(ForbiddenError)
    expect(error.message).toBe('This account is inactive.')
  })

  it('answers a wrong password the same way, and counts nothing', async () => {
    const harness = authHarness({ users: [account({ status: UserStatus.Inactive })] })

    const refusals = await failTimes(harness, 6)

    expect(refusals.every((e) => e instanceof ForbiddenError)).toBe(true)
    expect(harness.users.writes).toBe(0)
  })
})

describe('AuthService.login - lockout (requirement 6, amended 2026-09-12)', () => {
  it('answers the first four wrong passwords 401 and the fifth 429', async () => {
    const harness = authHarness()

    const refusals = await failTimes(harness, 5)

    expect(refusals.slice(0, 4).every((e) => e instanceof UnauthorizedError)).toBe(true)
    expect(refusals[4]).toBeInstanceOf(LockedOutError)
    expect(refusals[4]?.message).toBe(LOCKED_MESSAGE)
  })

  it('locks for fifteen minutes from the fifth failure', async () => {
    const harness = authHarness()
    await failTimes(harness, 5)

    expect(harness.users.byId.get('user-a')?.lockedUntilUtc).toEqual(
      new Date(NOW.getTime() + 15 * 60_000),
    )
  })

  it('keeps refusing a wrong password while locked, without extending the lock', async () => {
    const harness = authHarness()
    await failTimes(harness, 5)
    const lockedUntil = harness.users.byId.get('user-a')?.lockedUntilUtc
    const writes = harness.users.writes
    harness.clock.advanceMinutes(14)

    const [error] = await failTimes(harness, 1)

    expect(error).toBeInstanceOf(LockedOutError)
    expect(harness.users.byId.get('user-a')?.lockedUntilUtc).toEqual(lockedUntil)
    expect(harness.users.writes).toBe(writes)
  })

  it('admits the correct password on a locked account and clears the lock', async () => {
    const harness = authHarness()
    await failTimes(harness, 5)

    const result = await harness.service.login({ email: 'ann@acme.test', password: PASSWORD })

    expect(result.user.userId).toBe('user-a')
    const after = harness.users.byId.get('user-a')
    expect(after?.lockedUntilUtc).toBeNull()
    expect(after?.failedLoginCount).toBe(0)
  })

  it('answers a wrong password 401 again once the fifteen minutes are up', async () => {
    const harness = authHarness()
    await failTimes(harness, 5)
    // A second past the lock: at exactly fifteen minutes the first failure is still inside the
    // window it opened, so a sixth one then counts with the other five and locks again.
    harness.clock.advanceMinutes(15 + 1 / 60)

    const [error] = await failTimes(harness, 1)

    expect(error).toBeInstanceOf(UnauthorizedError)
  })

  it('does not lock when the five failures span more than fifteen minutes', async () => {
    const harness = authHarness()
    await failTimes(harness, 4)
    harness.clock.advanceMinutes(16)

    const [error] = await failTimes(harness, 1)

    expect(error).toBeInstanceOf(UnauthorizedError)
    expect(harness.users.byId.get('user-a')?.lockedUntilUtc).toBeNull()
  })

  it("never locks one account for another's failures", async () => {
    const other = account({ id: 'user-b', email: 'bob@acme.test' })
    const harness = authHarness({ users: [account(), other] })
    await failTimes(harness, 5, 'bob@acme.test')

    const result = await harness.service.login({ email: 'ann@acme.test', password: PASSWORD })

    expect(result.user.userId).toBe('user-a')
  })

  it('records the lock with reason LockedOut, not the password', async () => {
    const harness = authHarness()
    await failTimes(harness, 5)

    const last = harness.audit.events.at(-1)
    expect(last?.eventType).toBe('AuthLoginFailed')
    expect(JSON.parse(last?.metadataJson ?? '{}')).toEqual({ reason: 'LockedOut' })
  })
})

describe('AuthService.login - temporary passwords (requirements 13, 32b)', () => {
  const issuedAt = NOW
  const temporary = () =>
    account({
      passwordHash: passwordHasher.hash('Temp1!pw'),
      mustChangePassword: true,
      temporaryPasswordExpiresAtUtc: new Date(issuedAt.getTime() + 24 * 60 * 60_000),
    })

  it('accepts the temporary password inside its 24 hours', async () => {
    const harness = authHarness({ users: [temporary()] })
    harness.clock.advanceMinutes(24 * 60 - 1)

    const result = await harness.service.login({ email: 'ann@acme.test', password: 'Temp1!pw' })

    expect(result.requiresPasswordChange).toBe(true)
  })

  it('refuses the matching temporary password once 24 hours have passed, as a wrong password', async () => {
    const harness = authHarness({ users: [temporary()] })
    harness.clock.advanceMinutes(24 * 60)

    const error = await refusal(
      harness.service.login({ email: 'ann@acme.test', password: 'Temp1!pw' }),
    )

    expect(error).toBeInstanceOf(UnauthorizedError)
    expect(error.message).toBe('Invalid email or password.')
  })

  it('keeps the deadline through a successful sign-in until the password is changed', async () => {
    const clock = movableClock(issuedAt)
    const harness = authHarness({ users: [temporary()], clock })

    await harness.service.login({ email: 'ann@acme.test', password: 'Temp1!pw' })

    expect(harness.users.byId.get('user-a')?.temporaryPasswordExpiresAtUtc).toEqual(
      new Date(issuedAt.getTime() + 24 * 60 * 60_000),
    )
  })
})
