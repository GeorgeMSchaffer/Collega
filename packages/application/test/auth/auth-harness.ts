// Shared doubles for the auth suites. `AuthService` takes nine collaborators; these keep each test
// to the one or two it is actually about.
//
// The hasher and the token issuer are deliberately transparent - `hashed:<password>` and
// `token:<userId>:<stamp>` - so a test can read what was stored or issued without a real KDF or a
// real signature. The real ones are exercised in `packages/infrastructure`.

import { Role, UserStatus } from '@collega/domain/enums'
import type { Organization } from '@collega/domain/organizations'
import { createOrganizationUser, type User } from '@collega/domain/users'
import { AuthService } from '../../src/auth/auth-service.js'
import type {
  AccessTokenIssuer,
  AccessTokenValidator,
  ImageProcessor,
  PasswordHasher,
} from '../../src/auth/ports.js'
import type { Clock, CurrentUserContext } from '../../src/common/index.js'
import type { OrganizationRepository } from '../../src/organizations/ports.js'
import type { UserRepository } from '../../src/users/ports.js'
import {
  anonymous,
  type CountingUnitOfWork,
  countingUnitOfWork,
  NOW,
  ORG_A,
  ORG_B,
  type RecordingAudit,
  recordingAudit,
} from '../support/fixtures.js'

export const PASSWORD = 'Abc123!'
export const OTHER_VALID_PASSWORD = 'Xyz789?q'

export const passwordHasher: PasswordHasher = {
  hash: (password) => `hashed:${password}`,
  verify: (password, hash) => hash === `hashed:${password}`,
}

/** Issues `token:<userId>:<stamp>`, and validates exactly that shape back. */
export const tokens: AccessTokenIssuer & AccessTokenValidator = {
  issue: (userId, securityStamp) => ({
    token: `token:${userId}:${securityStamp}`,
    expiresInSeconds: 28_800,
  }),
  tryValidate: (token) => {
    const [kind, userId, securityStamp] = token.split(':')
    return kind === 'token' && userId && securityStamp ? { userId, securityStamp } : null
  },
}

const noImages: ImageProcessor = { tryCreatePngThumbnail: async () => null }

export function account(overrides: Partial<User> = {}): User {
  const base = createOrganizationUser(
    {
      id: 'user-a',
      organizationId: ORG_A,
      firstName: 'Ann',
      lastName: 'Author',
      email: 'ann@acme.test',
      passwordHash: passwordHasher.hash(PASSWORD),
      role: Role.User,
      status: UserStatus.Active,
      mustChangePassword: false,
    },
    NOW,
    'seed',
  )
  const merged = { ...base, ...overrides }
  return { ...merged, normalizedEmail: merged.email.trim().toLowerCase() }
}

export function organization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: ORG_A,
    title: 'Acme Robotics',
    inviteCode: 'ACME-INVITE',
    isArchived: false,
    ...overrides,
  } as Organization
}

export const ORGANIZATIONS: readonly Organization[] = [
  organization(),
  organization({ id: ORG_B, title: 'Beta Labs', inviteCode: 'BETA-INVITE' }),
]

/** An in-memory user store. `writes` counts `add` and `update` calls, which is what "nothing
 * changed" means for a refusal. */
export type UserStore = UserRepository & {
  readonly byId: Map<string, User>
  writes: number
  emailLookups: number
}

export function userStore(users: readonly User[]): UserStore {
  const byId = new Map(users.map((u) => [u.id, u]))
  const store = {
    byId,
    writes: 0,
    emailLookups: 0,
    getById: async (id: string) => byId.get(id) ?? null,
    getByNormalizedEmail: async (email: string) =>
      [...byId.values()].find((u) => u.normalizedEmail === email) ?? null,
    existsByNormalizedEmail: async (email: string) => {
      store.emailLookups++
      return [...byId.values()].some((u) => u.normalizedEmail === email)
    },
    add: async (user: User) => {
      store.writes++
      byId.set(user.id, user)
    },
    update: async (user: User) => {
      store.writes++
      byId.set(user.id, user)
    },
  }
  return store as unknown as UserStore
}

function organizationStore(organizations: readonly Organization[]): OrganizationRepository {
  return {
    getById: async (id: string) => organizations.find((o) => o.id === id) ?? null,
    getByInviteCode: async (code: string) =>
      organizations.find((o) => o.inviteCode === code) ?? null,
  } as unknown as OrganizationRepository
}

/** A clock a test can move, since lockout and temporary-password expiry are both about time. */
export type MovableClock = Clock & { set(to: Date): void; advanceMinutes(minutes: number): void }

export function movableClock(start: Date = NOW): MovableClock {
  let now = start
  return {
    now: () => now,
    set: (to) => {
      now = to
    },
    advanceMinutes: (minutes) => {
      now = new Date(now.getTime() + minutes * 60_000)
    },
  }
}

export type AuthHarness = {
  readonly service: AuthService
  readonly users: UserStore
  readonly audit: RecordingAudit
  readonly unitOfWork: CountingUnitOfWork
  readonly clock: MovableClock
}

export function authHarness(
  options: {
    users?: readonly User[]
    organizations?: readonly Organization[]
    currentUser?: CurrentUserContext
    clock?: MovableClock
  } = {},
): AuthHarness {
  const users = userStore(options.users ?? [account()])
  const audit = recordingAudit()
  const unitOfWork = countingUnitOfWork()
  const clock = options.clock ?? movableClock()
  const service = new AuthService(
    users,
    organizationStore(options.organizations ?? ORGANIZATIONS),
    unitOfWork,
    passwordHasher,
    tokens,
    audit,
    options.currentUser ?? anonymous,
    noImages,
    clock,
  )
  return { service, users, audit, unitOfWork, clock }
}

/** Resolves to the rejection, failing the test if the call succeeded. */
export async function refusal(promise: Promise<unknown>): Promise<Error> {
  const outcome = await promise.then(
    () => null,
    (error: unknown) => error,
  )
  if (!(outcome instanceof Error)) {
    throw new Error('Expected the call to be refused, and it succeeded.')
  }
  return outcome
}
