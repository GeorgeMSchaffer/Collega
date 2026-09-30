// Registration, password change, admin-issued temporary passwords and the caller's own summary
// (SPEC/20-feature-auth.md requirements 12-13, 17, 31, 36; contracts/auth.md).
//
// Registration's enumeration oracle is a known open risk (decision 2026-09-11), so these do not
// pretend it is closed. What they pin is what that decision kept: the password policy is checked
// before the address, the refusal is a plain 409, and a refused registration writes nothing - in
// particular no audit row carrying an address that may belong to another tenant, which is what the
// reverted `UserSelfRegistrationRejected` event leaked to Org Admins.

import { Role, UserStatus } from '@collega/domain/enums'
import { describe, expect, it } from 'vitest'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../src/common/index.js'
import {
  anonymous,
  impersonating,
  member,
  NOW,
  ORG_A,
  ORG_B,
  orgAdmin,
  readOnly,
  siteAdmin,
} from '../support/fixtures.js'
import {
  account,
  authHarness,
  OTHER_VALID_PASSWORD,
  organization,
  PASSWORD,
  passwordHasher,
  refusal,
} from './auth-harness.js'

const REGISTRATION = {
  inviteCode: 'beta-invite',
  firstName: 'Nia',
  lastName: 'New',
  email: 'nia@beta.test',
  password: PASSWORD,
}

describe('AuthService.register - invite codes', () => {
  it('refuses an archived organization exactly as it refuses an unknown code', async () => {
    const archived = authHarness({
      organizations: [organization({ inviteCode: 'ACME-INVITE', isArchived: true })],
    })
    const unknown = authHarness()

    const archivedError = await refusal(
      archived.service.register({ ...REGISTRATION, inviteCode: 'acme-invite' }),
    )
    const unknownError = await refusal(
      unknown.service.register({ ...REGISTRATION, inviteCode: 'NO-SUCH-CODE' }),
    )

    expect(archivedError).toBeInstanceOf(ValidationError)
    expect((archivedError as ValidationError).failures).toEqual({
      inviteCode: ['Invite code is invalid. Please provide a valid organization invite code.'],
    })
    expect((unknownError as ValidationError).failures).toEqual(
      (archivedError as ValidationError).failures,
    )
  })

  it('refuses a blank code before looking anything up', async () => {
    const harness = authHarness()

    const error = await refusal(harness.service.register({ ...REGISTRATION, inviteCode: '   ' }))

    expect((error as ValidationError).failures).toEqual({
      inviteCode: ['Invite code is required.'],
    })
    expect(harness.users.emailLookups).toBe(0)
  })
})

describe('AuthService.register - the taken-address refusal (decision 2026-09-11)', () => {
  it('checks the password policy before it asks whether the address is taken', async () => {
    const harness = authHarness()

    const error = await refusal(
      harness.service.register({ ...REGISTRATION, email: 'ANN@acme.test', password: 'weak' }),
    )

    expect(error).toBeInstanceOf(ValidationError)
    expect(Object.keys((error as ValidationError).failures)).toEqual(['password'])
    expect(harness.users.emailLookups).toBe(0)
  })

  it('answers a taken address 409 "Email is already in use.", across tenants and case', async () => {
    // The account is in organization A; the invite code is organization B's.
    const harness = authHarness()

    const error = await refusal(
      harness.service.register({ ...REGISTRATION, email: '  ANN@Acme.test ' }),
    )

    expect(error).toBeInstanceOf(ConflictError)
    expect(error.message).toBe('Email is already in use.')
  })

  it('writes no user and no audit event for a taken address', async () => {
    const harness = authHarness()

    await refusal(harness.service.register({ ...REGISTRATION, email: 'ann@acme.test' }))

    expect(harness.users.writes).toBe(0)
    expect(harness.unitOfWork.saves).toBe(0)
    expect(harness.audit.events).toEqual([])
  })
})

describe('AuthService.register - the account it creates', () => {
  it("joins the invite code's organization as an active User with no forced change", async () => {
    const harness = authHarness()

    const result = await harness.service.register(REGISTRATION)

    expect(result).toMatchObject({
      organizationId: ORG_B,
      email: 'nia@beta.test',
      role: Role.User,
      status: UserStatus.Active,
    })
    const stored = harness.users.byId.get(result.userId)
    expect(stored?.mustChangePassword).toBe(false)
    expect(stored?.passwordHash).toBe(passwordHasher.hash(PASSWORD))
  })

  it("audits the registration under the new account's own organization", async () => {
    const harness = authHarness()

    const result = await harness.service.register(REGISTRATION)

    expect(harness.audit.events).toHaveLength(1)
    expect(harness.audit.events[0]).toMatchObject({
      eventType: 'UserSelfRegistered',
      organizationId: ORG_B,
      entityId: result.userId,
      metadataJson: null,
    })
  })
})

describe('AuthService.changePassword', () => {
  it('refuses a wrong current password with 401 and changes nothing', async () => {
    const harness = authHarness({ currentUser: member(ORG_A, 'user-a') })
    const before = harness.users.byId.get('user-a')

    const error = await refusal(
      harness.service.changePassword({
        currentPassword: 'Wrong1!x',
        newPassword: OTHER_VALID_PASSWORD,
      }),
    )

    expect(error).toBeInstanceOf(UnauthorizedError)
    expect(error.message).toBe('Current password is incorrect.')
    expect(harness.users.byId.get('user-a')).toBe(before)
    expect(harness.audit.events.map((e) => e.eventType)).toEqual(['AuthPasswordChangeFailed'])
  })

  it('refuses a new password that fails the policy, keyed newPassword, and changes nothing', async () => {
    const harness = authHarness({ currentUser: member(ORG_A, 'user-a') })

    const error = await refusal(
      harness.service.changePassword({ currentPassword: PASSWORD, newPassword: 'short' }),
    )

    expect(error).toBeInstanceOf(ValidationError)
    expect(Object.keys((error as ValidationError).failures)).toEqual(['newPassword'])
    expect(harness.users.writes).toBe(0)
  })

  it('regenerates the security stamp, which is what ends every other session (rule 36)', async () => {
    const harness = authHarness({ currentUser: member(ORG_A, 'user-a') })
    const before = harness.users.byId.get('user-a')?.securityStamp

    await harness.service.changePassword({
      currentPassword: PASSWORD,
      newPassword: OTHER_VALID_PASSWORD,
    })

    const after = harness.users.byId.get('user-a')
    expect(after?.securityStamp).not.toBe(before)
    expect(after?.passwordHash).toBe(passwordHasher.hash(OTHER_VALID_PASSWORD))
  })

  it('clears a pending rotation and retires the temporary deadline (rules 31, 32b)', async () => {
    const harness = authHarness({
      users: [
        account({
          mustChangePassword: true,
          temporaryPasswordExpiresAtUtc: new Date(NOW.getTime() + 60_000),
        }),
      ],
      currentUser: member(ORG_A, 'user-a'),
    })

    await harness.service.changePassword({
      currentPassword: PASSWORD,
      newPassword: OTHER_VALID_PASSWORD,
    })

    const after = harness.users.byId.get('user-a')
    expect(after?.mustChangePassword).toBe(false)
    expect(after?.temporaryPasswordExpiresAtUtc).toBeNull()
  })

  it('changes the password of whoever the context names, not a caller-chosen account', async () => {
    const harness = authHarness({
      users: [account(), account({ id: 'user-b', email: 'bob@acme.test' })],
      currentUser: member(ORG_A, 'user-b'),
    })
    const annBefore = harness.users.byId.get('user-a')

    await harness.service.changePassword({
      currentPassword: PASSWORD,
      newPassword: OTHER_VALID_PASSWORD,
    })

    expect(harness.users.byId.get('user-a')).toBe(annBefore)
    expect(harness.users.byId.get('user-b')?.passwordHash).toBe(
      passwordHasher.hash(OTHER_VALID_PASSWORD),
    )
  })

  it('refuses an anonymous caller', async () => {
    const harness = authHarness({ currentUser: anonymous })

    const error = await refusal(
      harness.service.changePassword({
        currentPassword: PASSWORD,
        newPassword: OTHER_VALID_PASSWORD,
      }),
    )

    expect(error).toBeInstanceOf(UnauthorizedError)
  })
})

describe('AuthService.issueTemporaryPassword - who may, and across which tenants', () => {
  const target = () => account({ id: 'target', email: 'target@acme.test', organizationId: ORG_A })

  it('lets a Site Admin reset anyone, and an Org Admin reset someone in their own organization', async () => {
    for (const caller of [siteAdmin(), orgAdmin(ORG_A)]) {
      const harness = authHarness({ users: [target()], currentUser: caller })

      const result = await harness.service.issueTemporaryPassword('target')

      expect(result.mustChangePassword).toBe(true)
      expect(harness.users.byId.get('target')?.passwordHash).toBe(
        passwordHasher.hash(result.temporaryPassword),
      )
    }
  })

  it('refuses an Org Admin of another organization and leaves the account untouched', async () => {
    const harness = authHarness({ users: [target()], currentUser: orgAdmin(ORG_B) })
    const before = harness.users.byId.get('target')

    const error = await refusal(harness.service.issueTemporaryPassword('target'))

    expect(error).toBeInstanceOf(ForbiddenError)
    expect(harness.users.byId.get('target')).toBe(before)
    expect(harness.audit.events).toEqual([])
  })

  it('refuses an Org Admin resetting the Site Admin, who belongs to no organization', async () => {
    const harness = authHarness({
      users: [account({ id: 'root', organizationId: null, role: Role.SiteAdmin })],
      currentUser: orgAdmin(ORG_A),
    })

    const error = await refusal(harness.service.issueTemporaryPassword('root'))

    expect(error).toBeInstanceOf(ForbiddenError)
  })

  it('refuses a User and a Read Only caller in the same organization', async () => {
    for (const caller of [member(ORG_A), readOnly(ORG_A)]) {
      const harness = authHarness({ users: [target()], currentUser: caller })

      const error = await refusal(harness.service.issueTemporaryPassword('target'))

      expect(error).toBeInstanceOf(ForbiddenError)
      expect(harness.users.writes).toBe(0)
    }
  })

  it('answers 404 for an id that names nobody', async () => {
    const harness = authHarness({ users: [target()], currentUser: siteAdmin() })

    const error = await refusal(harness.service.issueTemporaryPassword('missing'))

    expect(error).toBeInstanceOf(NotFoundError)
  })

  it('forces a change, starts the 24-hour expiry, clears a lockout and ends existing sessions', async () => {
    const locked = target()
    const harness = authHarness({
      users: [
        {
          ...locked,
          failedLoginCount: 5,
          lockoutWindowStartUtc: NOW,
          lockedUntilUtc: new Date(NOW.getTime() + 15 * 60_000),
        },
      ],
      currentUser: siteAdmin(),
    })

    await harness.service.issueTemporaryPassword('target')

    const after = harness.users.byId.get('target')
    expect(after?.mustChangePassword).toBe(true)
    expect(after?.temporaryPasswordExpiresAtUtc).toEqual(new Date(NOW.getTime() + 24 * 60 * 60_000))
    expect(after?.lockedUntilUtc).toBeNull()
    expect(after?.securityStamp).not.toBe(locked.securityStamp)
  })

  it('keeps the temporary password out of the audit row', async () => {
    const harness = authHarness({ users: [target()], currentUser: siteAdmin() })

    const { temporaryPassword } = await harness.service.issueTemporaryPassword('target')

    expect(harness.audit.events).toHaveLength(1)
    expect(JSON.stringify(harness.audit.events[0])).not.toContain(temporaryPassword)
  })
})

describe('AuthService.getCurrentUser - the organization it names', () => {
  it("names the caller's own organization, never another", async () => {
    const harness = authHarness({
      users: [account({ id: 'b-user', email: 'b@beta.test', organizationId: ORG_B })],
    })

    const summary = await harness.service.getCurrentUser('b-user')

    expect(summary.organizationId).toBe(ORG_B)
    expect(summary.organizationTitle).toBe('Beta Labs')
  })

  it('names no organization for the Site Admin', async () => {
    const harness = authHarness({
      users: [account({ id: 'root', organizationId: null, role: Role.SiteAdmin })],
    })

    const summary = await harness.service.getCurrentUser('root')

    expect(summary.organizationTitle).toBeNull()
  })

  it('refuses an id that no longer resolves with 401', async () => {
    const harness = authHarness()

    const error = await refusal(harness.service.getCurrentUser('gone'))

    expect(error).toBeInstanceOf(UnauthorizedError)
  })
})

describe('AuthService self-service edits during View As', () => {
  it('attributes the change to the real administrator, on behalf of the target', async () => {
    const harness = authHarness({
      currentUser: impersonating({
        targetUserId: 'user-a',
        targetRole: Role.User,
        targetOrganizationId: ORG_A,
        realUserId: 'site-admin-1',
      }),
    })

    await harness.service.updateProfile({ firstName: 'Anna', lastName: 'Author' })

    const [event] = harness.audit.events
    expect(event?.attribution.actorUserId).toBe('site-admin-1')
    expect(event?.attribution.onBehalfOfUserId).toBe('user-a')
  })
})
