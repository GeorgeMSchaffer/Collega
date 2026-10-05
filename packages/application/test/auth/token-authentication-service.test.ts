// Session revalidation on every request (SPEC/20-feature-auth.md requirements 15, 32a, 35-36;
// contracts/auth.md "Access Token Format and Session Revocation").
//
// The token names a user and a security stamp; everything else is read live. So a password change
// or an admin reset ends every session issued before it, a deactivation ends them too, and the
// mandatory-rotation flag comes from the row, not the token.

import { Role, UserStatus } from '@collega/domain/enums'
import type { User } from '@collega/domain/users'
import { describe, expect, it } from 'vitest'
import type { AuthenticatedPrincipal } from '../../src/auth/models.js'
import type { ImpersonationResolver } from '../../src/auth/ports.js'
import { TokenAuthenticationService } from '../../src/auth/token-authentication-service.js'
import { member, ORG_A, siteAdmin } from '../support/fixtures.js'
import {
  account,
  authHarness,
  movableClock,
  OTHER_VALID_PASSWORD,
  PASSWORD,
  tokens,
  type UserStore,
  userStore,
} from './auth-harness.js'

const noSession: ImpersonationResolver = { resolveActingPrincipal: async () => null }

function authenticator(users: UserStore, impersonation: ImpersonationResolver = noSession) {
  return new TokenAuthenticationService(tokens, users, impersonation, movableClock())
}

/** `account()` draws a fresh random stamp on every call, so issue from the object you store. */
function tokenFor(user: User): string {
  return tokens.issue(user.id, user.securityStamp, new Date()).token
}

describe('TokenAuthenticationService - what a token alone cannot do', () => {
  it('resolves a current token to the user it names', async () => {
    const user = account()
    const users = userStore([user])

    const principal = await authenticator(users).authenticate(tokenFor(user))

    expect(principal?.userId).toBe('user-a')
    expect(principal?.impersonation).toBeNull()
  })

  it('rejects an empty or unreadable token', async () => {
    const users = userStore([account()])

    expect(await authenticator(users).authenticate('')).toBeNull()
    expect(await authenticator(users).authenticate('garbage')).toBeNull()
  })

  it('rejects a token for a user who no longer exists', async () => {
    const users = userStore([])

    expect(await authenticator(users).authenticate(tokenFor(account()))).toBeNull()
  })

  it('rejects a token whose stamp is not the one the account holds now', async () => {
    const user = account()
    const users = userStore([{ ...user, securityStamp: 'ROTATED' }])

    expect(await authenticator(users).authenticate(tokenFor(user))).toBeNull()
  })

  it('rejects a token for an account deactivated after it was issued', async () => {
    const user = account()
    const users = userStore([{ ...user, status: UserStatus.Inactive }])

    expect(await authenticator(users).authenticate(tokenFor(user))).toBeNull()
  })

  it('reads mustChangePassword from the row, not from when the token was issued', async () => {
    const user = account()
    const users = userStore([{ ...user, mustChangePassword: true }])

    const principal = await authenticator(users).authenticate(tokenFor(user))

    expect(principal?.mustChangePassword).toBe(true)
  })

  it('hands back the acting principal when a View As session is live', async () => {
    const acting = { userId: 'target' } as AuthenticatedPrincipal
    const user = account()
    const users = userStore([user])

    const principal = await authenticator(users, {
      resolveActingPrincipal: async () => acting,
    }).authenticate(tokenFor(user))

    expect(principal).toBe(acting)
  })
})

describe('Security stamp rotation ends sessions (rules 35-36)', () => {
  it('a password change ends the session that made it', async () => {
    const harness = authHarness({ currentUser: member(ORG_A, 'user-a') })
    const { accessToken } = await harness.service.login({
      email: 'ann@acme.test',
      password: PASSWORD,
    })
    const auth = authenticator(harness.users)
    expect(await auth.authenticate(accessToken)).not.toBeNull()

    await harness.service.changePassword({
      currentPassword: PASSWORD,
      newPassword: OTHER_VALID_PASSWORD,
    })

    expect(await auth.authenticate(accessToken)).toBeNull()
  })

  it('a sign-in with the new password is accepted after the change', async () => {
    const harness = authHarness({ currentUser: member(ORG_A, 'user-a') })
    await harness.service.changePassword({
      currentPassword: PASSWORD,
      newPassword: OTHER_VALID_PASSWORD,
    })

    const { accessToken } = await harness.service.login({
      email: 'ann@acme.test',
      password: OTHER_VALID_PASSWORD,
    })

    expect(await authenticator(harness.users).authenticate(accessToken)).not.toBeNull()
  })

  it("an admin-issued temporary password ends the target's existing sessions", async () => {
    const user = account({ id: 'target', email: 'target@acme.test' })
    const users = [
      user,
      account({ id: 'root', email: 'root@x.test', organizationId: null, role: Role.SiteAdmin }),
    ]
    const harness = authHarness({ users, currentUser: siteAdmin('root') })
    const before = tokenFor(user)
    const auth = authenticator(harness.users)
    expect(await auth.authenticate(before)).not.toBeNull()

    await harness.service.issueTemporaryPassword('target')

    expect(await auth.authenticate(before)).toBeNull()
  })

  it("one user's password change leaves another user's session alone", async () => {
    const bob = account({ id: 'user-b', email: 'bob@acme.test' })
    const harness = authHarness({ users: [account(), bob], currentUser: member(ORG_A, 'user-a') })

    await harness.service.changePassword({
      currentPassword: PASSWORD,
      newPassword: OTHER_VALID_PASSWORD,
    })

    expect(await authenticator(harness.users).authenticate(tokenFor(bob))).not.toBeNull()
  })
})
