// SPEC/20-feature-view-as.md. View As is the Site Admin's only route to organization content, so
// its boundaries carry the weight that `ensureNotDirectSiteAdmin` takes off every other service.
//
// The recurring assertion here is that authorization reads the REAL identity. Everywhere else in
// this package `currentUser.userId`/`role` is the right answer; in this service it is not, because
// while a session is live those already report the impersonated user.

import { ImpersonationEndReason, Role, UserStatus } from '@collega/domain/enums'
import type { ImpersonationSession } from '@collega/domain/impersonation'
import { IMPERSONATION_ABSOLUTE_LIFETIME_MS } from '@collega/domain/impersonation'
import { beforeEach, describe, expect, it } from 'vitest'
import type { CurrentUserContext } from '../../src/common/index.js'
import { ConflictError, ForbiddenError, NotFoundError } from '../../src/common/index.js'
import type {
  ImpersonationOrganizationSummary,
  ImpersonationOrganizationsPort,
  ImpersonationSessionRepository,
  ImpersonationUserSummary,
  ImpersonationUsersPort,
} from '../../src/impersonation/ports.js'
import { ViewAsService } from '../../src/impersonation/view-as-service.js'
import {
  countingUnitOfWork,
  fixedClock,
  impersonating,
  NOW,
  ORG_A,
  ORG_B,
  orgAdmin,
  readOnly,
  recordingAudit,
  siteAdmin,
  member as memberContext,
} from '../support/fixtures.js'

function user(overrides: Partial<ImpersonationUserSummary> = {}): ImpersonationUserSummary {
  return {
    id: 'target-1',
    organizationId: ORG_A,
    firstName: 'Tessa',
    lastName: 'Target',
    email: 'tessa@acme.test',
    role: Role.User,
    status: UserStatus.Active,
    ...overrides,
  }
}

const SITE_ADMIN = user({
  id: 'site-admin-1',
  organizationId: null,
  firstName: 'Sam',
  lastName: 'Site',
  email: 'sam@collega.test',
  role: Role.SiteAdmin,
})

const ORG_ADMIN_A = user({
  id: 'org-admin-1',
  organizationId: ORG_A,
  firstName: 'Ada',
  lastName: 'Admin',
  email: 'ada@acme.test',
  role: Role.OrgAdmin,
})

function organization(
  overrides: Partial<ImpersonationOrganizationSummary> = {},
): ImpersonationOrganizationSummary {
  return { id: ORG_A, title: 'Acme', isArchived: false, ...overrides }
}

type Harness = {
  service: ViewAsService
  sessions: ImpersonationSession[]
  audit: ReturnType<typeof recordingAudit>
  searchCalls: { organizationId: string | null; search: string | null }[]
}

function harness(options: {
  currentUser: CurrentUserContext
  users?: readonly ImpersonationUserSummary[]
  organizations?: readonly ImpersonationOrganizationSummary[]
  openSession?: ImpersonationSession | null
  searchResult?: readonly ImpersonationUserSummary[]
  commitFails?: Error
}): Harness {
  const stored: ImpersonationSession[] = []
  const usersById = new Map((options.users ?? []).map((u) => [u.id, u]))
  const orgsById = new Map((options.organizations ?? [organization()]).map((o) => [o.id, o]))
  const searchCalls: { organizationId: string | null; search: string | null }[] = []

  const sessions: ImpersonationSessionRepository = {
    async getOpenForRealUser() {
      return options.openSession ?? null
    },
    async add(session) {
      stored.push(session)
    },
    async update(session) {
      stored.push(session)
    },
  }

  const users: ImpersonationUsersPort = {
    async getById(userId) {
      return usersById.get(userId) ?? null
    },
    async searchForImpersonation(organizationId, search) {
      searchCalls.push({ organizationId, search })
      return options.searchResult ?? []
    },
  }

  const organizations: ImpersonationOrganizationsPort = {
    async getById(organizationId) {
      return orgsById.get(organizationId) ?? null
    },
  }

  const audit = recordingAudit()
  const unitOfWork = options.commitFails
    ? {
        async saveChanges() {
          throw options.commitFails
        },
      }
    : countingUnitOfWork()

  return {
    service: new ViewAsService(
      sessions,
      users,
      organizations,
      unitOfWork,
      audit,
      options.currentUser,
      fixedClock(),
    ),
    sessions: stored,
    audit,
    searchCalls,
  }
}

describe('ViewAsService.start', () => {
  it('lets a Site Admin act as a User in any organization', async () => {
    const target = user({ organizationId: ORG_B })
    const { service, sessions } = harness({
      currentUser: siteAdmin(),
      users: [SITE_ADMIN, target],
      organizations: [organization({ id: ORG_B, title: 'Beta' })],
    })

    const result = await service.start('target-1')

    expect(result.impersonating.userId).toBe('target-1')
    expect(result.impersonating.organizationId).toBe(ORG_B)
    expect(result.realUser.userId).toBe('site-admin-1')
    expect(result.realUser.organizationId).toBeNull()
    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.realUserId).toBe('site-admin-1')
    expect(sessions[0]?.targetUserId).toBe('target-1')
  })

  it('lets an Org Admin act as a member of their own organization', async () => {
    const { service, sessions } = harness({
      currentUser: orgAdmin(ORG_A),
      users: [ORG_ADMIN_A, user()],
    })

    await service.start('target-1')

    expect(sessions).toHaveLength(1)
  })

  it('refuses an Org Admin acting as a member of another organization', async () => {
    const { service, sessions } = harness({
      currentUser: orgAdmin(ORG_A),
      users: [ORG_ADMIN_A, user({ organizationId: ORG_B })],
      organizations: [organization({ id: ORG_B, title: 'Beta' })],
    })

    await expect(service.start('target-1')).rejects.toThrow(ForbiddenError)
    expect(sessions).toHaveLength(0)
  })

  it('authorizes against the REAL user, not the acting one - an Org Admin cannot reach another organization through an existing session', async () => {
    // The acting context claims ORG_B; the real user is an Org Admin of ORG_A. If the service
    // read `currentUser.organizationId` this would succeed, which is the hole rule 11 closes.
    const { service, sessions } = harness({
      currentUser: impersonating({
        targetUserId: 'someone-in-b',
        targetRole: Role.OrgAdmin,
        targetOrganizationId: ORG_B,
        realUserId: 'org-admin-1',
      }),
      users: [ORG_ADMIN_A, user({ id: 'target-b', organizationId: ORG_B })],
      organizations: [organization(), organization({ id: ORG_B, title: 'Beta' })],
    })

    await expect(service.start('target-b')).rejects.toThrow(ForbiddenError)
    expect(sessions).toHaveLength(0)
  })

  it.each([Role.User, Role.ReadOnly])('refuses %s outright', async (role) => {
    const caller = role === Role.User ? memberContext(ORG_A) : readOnly(ORG_A)
    const { service } = harness({
      currentUser: caller,
      users: [user({ id: caller.userId as string, role }), user()],
    })

    await expect(service.start('target-1')).rejects.toThrow(ForbiddenError)
  })

  it('refuses a Site Admin as a target - acting as a peer grants nothing and is a lateral move', async () => {
    const { service } = harness({
      currentUser: siteAdmin('site-admin-1'),
      users: [SITE_ADMIN, user({ id: 'other-site-admin', organizationId: null, role: Role.SiteAdmin })],
    })

    await expect(service.start('other-site-admin')).rejects.toThrow(ForbiddenError)
  })

  it('refuses an inactive target (rule 10)', async () => {
    const { service } = harness({
      currentUser: siteAdmin(),
      users: [SITE_ADMIN, user({ status: UserStatus.Inactive })],
    })

    await expect(service.start('target-1')).rejects.toThrow(ForbiddenError)
  })

  it('refuses a target in an archived organization (rule 12)', async () => {
    const { service } = harness({
      currentUser: siteAdmin(),
      users: [SITE_ADMIN, user()],
      organizations: [organization({ isArchived: true })],
    })

    await expect(service.start('target-1')).rejects.toThrow(ForbiddenError)
  })

  it('refuses a target with no organization', async () => {
    const { service } = harness({
      currentUser: siteAdmin(),
      users: [SITE_ADMIN, user({ organizationId: null })],
    })

    await expect(service.start('target-1')).rejects.toThrow(ForbiddenError)
  })

  it('refuses self-targeting', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      users: [ORG_ADMIN_A],
    })

    await expect(service.start('org-admin-1')).rejects.toThrow(ForbiddenError)
  })

  it('reports an unknown target id as not-found, narrower than every other refusal', async () => {
    const { service } = harness({ currentUser: siteAdmin(), users: [SITE_ADMIN] })

    await expect(service.start('no-such-user')).rejects.toThrow(NotFoundError)
  })

  it('gives every refusal the same message, so a caller cannot distinguish the reason', async () => {
    const cases: readonly ImpersonationUserSummary[] = [
      user({ id: 'a', organizationId: ORG_B }),
      user({ id: 'b', status: UserStatus.Inactive }),
      user({ id: 'c', organizationId: null }),
    ]

    const messages = new Set<string>()
    for (const target of cases) {
      const { service } = harness({
        currentUser: orgAdmin(ORG_A),
        users: [ORG_ADMIN_A, target],
        organizations: [organization(), organization({ id: ORG_B, title: 'Beta' })],
      })
      await service.start(target.id).catch((error: Error) => messages.add(error.message))
    }

    expect(messages.size).toBe(1)
  })

  it('refuses to nest: an already-active session is a conflict, never a silent replacement (rule 5)', async () => {
    const open: ImpersonationSession = {
      id: 'session-1',
      realUserId: 'site-admin-1',
      targetUserId: 'someone-else',
      startedAtUtc: NOW,
      lastSeenAtUtc: NOW,
      absoluteExpiresAtUtc: new Date(NOW.getTime() + IMPERSONATION_ABSOLUTE_LIFETIME_MS),
      endedAtUtc: null,
      endReason: null,
    }
    const { service, sessions } = harness({
      currentUser: siteAdmin(),
      users: [SITE_ADMIN, user()],
      openSession: open,
    })

    await expect(service.start('target-1')).rejects.toThrow(ConflictError)
    expect(sessions).toHaveLength(0)
  })

  it('closes an open-but-expired session rather than leaving a second null endedAtUtc row behind', async () => {
    const expired: ImpersonationSession = {
      id: 'session-1',
      realUserId: 'site-admin-1',
      targetUserId: 'someone-else',
      startedAtUtc: new Date(NOW.getTime() - 3 * 60 * 60 * 1000),
      lastSeenAtUtc: new Date(NOW.getTime() - 3 * 60 * 60 * 1000),
      absoluteExpiresAtUtc: new Date(NOW.getTime() - 60 * 60 * 1000),
      endedAtUtc: null,
      endReason: null,
    }
    const { service, sessions } = harness({
      currentUser: siteAdmin(),
      users: [SITE_ADMIN, user()],
      openSession: expired,
    })

    await service.start('target-1')

    expect(sessions).toHaveLength(2)
    expect(sessions[0]?.id).toBe('session-1')
    expect(sessions[0]?.endReason).toBe(ImpersonationEndReason.AbsoluteTimeout)
  })

  it('turns an open-session unique-index violation raised at commit into the same 409 the read-then-write check produces', async () => {
    // The constraint name is matched through the `.cause` chain, since the repository may wrap
    // the driver error.
    const { service } = harness({
      currentUser: siteAdmin(),
      users: [SITE_ADMIN, user()],
      commitFails: new Error('commit failed', {
        cause: new Error(
          'duplicate key value violates unique constraint "ux_impersonation_sessions_real_user_id_open"',
        ),
      }),
    })

    await expect(service.start('target-1')).rejects.toThrow(ConflictError)
  })

  it('re-throws a commit failure it does not recognize rather than reporting a conflict', async () => {
    const { service } = harness({
      currentUser: siteAdmin(),
      users: [SITE_ADMIN, user()],
      commitFails: new Error('connection reset'),
    })

    await expect(service.start('target-1')).rejects.toThrow('connection reset')
    await expect(service.start('target-1')).rejects.not.toBeInstanceOf(ConflictError)
  })

  it('attributes the start audit to the administrator and names the target (rules 13/14)', async () => {
    const { service, audit } = harness({
      currentUser: siteAdmin(),
      users: [SITE_ADMIN, user()],
    })

    await service.start('target-1')

    const event = audit.events.at(-1)
    expect(event?.eventType).toBe('ViewAsStarted')
    expect(event?.attribution.actorUserId).toBe('site-admin-1')
    expect(event?.attribution.onBehalfOfUserId).toBe('target-1')
    expect(event?.organizationId).toBe(ORG_A)
  })
})

describe('ViewAsService.end', () => {
  const liveSession: ImpersonationSession = {
    id: 'session-1',
    realUserId: 'site-admin-1',
    targetUserId: 'target-1',
    startedAtUtc: NOW,
    lastSeenAtUtc: NOW,
    absoluteExpiresAtUtc: new Date(NOW.getTime() + IMPERSONATION_ABSOLUTE_LIFETIME_MS),
    endedAtUtc: null,
    endReason: null,
  }

  it('is idempotent: ending with no open session succeeds and writes nothing', async () => {
    const { service, sessions, audit } = harness({
      currentUser: siteAdmin(),
      users: [SITE_ADMIN],
      openSession: null,
    })

    await expect(service.end()).resolves.toBeUndefined()
    expect(sessions).toHaveLength(0)
    expect(audit.events).toHaveLength(0)
  })

  it('records a live exit as ExitedByUser and audits it', async () => {
    const { service, sessions, audit } = harness({
      currentUser: impersonating({
        targetUserId: 'target-1',
        targetRole: Role.User,
        targetOrganizationId: ORG_A,
      }),
      users: [SITE_ADMIN, user()],
      openSession: liveSession,
    })

    await service.end()

    expect(sessions[0]?.endReason).toBe(ImpersonationEndReason.ExitedByUser)
    expect(audit.events).toHaveLength(1)
    expect(audit.events[0]?.eventType).toBe('ViewAsEnded')
    // Rule 14: the administrator acted, the target was acted upon - never the reverse.
    expect(audit.events[0]?.attribution.actorUserId).toBe('site-admin-1')
    expect(audit.events[0]?.attribution.onBehalfOfUserId).toBe('target-1')
  })

  it('closes an already-expired session as a timeout, and does not audit it as a deliberate exit', async () => {
    const expired: ImpersonationSession = {
      ...liveSession,
      lastSeenAtUtc: new Date(NOW.getTime() - 60 * 60 * 1000),
      absoluteExpiresAtUtc: new Date(NOW.getTime() - 30 * 60 * 1000),
    }
    const { service, sessions, audit } = harness({
      currentUser: siteAdmin(),
      users: [SITE_ADMIN, user()],
      openSession: expired,
    })

    await service.end()

    expect(sessions[0]?.endReason).toBe(ImpersonationEndReason.AbsoluteTimeout)
    expect(audit.events).toHaveLength(0)
  })

  it('distinguishes idle timeout from absolute timeout', async () => {
    const idle: ImpersonationSession = {
      ...liveSession,
      startedAtUtc: new Date(NOW.getTime() - 60 * 60 * 1000),
      lastSeenAtUtc: new Date(NOW.getTime() - 45 * 60 * 1000),
      absoluteExpiresAtUtc: new Date(NOW.getTime() + 60 * 60 * 1000),
    }
    const { service, sessions } = harness({
      currentUser: siteAdmin(),
      users: [SITE_ADMIN, user()],
      openSession: idle,
    })

    await service.end()

    expect(sessions[0]?.endReason).toBe(ImpersonationEndReason.IdleTimeout)
  })
})

describe('ViewAsService.listCandidates', () => {
  let candidates: ImpersonationUserSummary[]

  beforeEach(() => {
    candidates = [
      user({ id: 'active-a', organizationId: ORG_A }),
      user({ id: 'inactive-a', organizationId: ORG_A, status: UserStatus.Inactive }),
      user({ id: 'site-admin-2', organizationId: null, role: Role.SiteAdmin }),
      user({ id: 'orphan', organizationId: null }),
    ]
  })

  it('queries at the source with no organization for a Site Admin', async () => {
    const { service, searchCalls } = harness({
      currentUser: siteAdmin(),
      users: [SITE_ADMIN],
      searchResult: candidates,
    })

    await service.listCandidates('ad')

    expect(searchCalls).toEqual([{ organizationId: null, search: 'ad' }])
  })

  it("scopes an Org Admin's query to their own organization at the source, not afterwards", async () => {
    const { service, searchCalls } = harness({
      currentUser: orgAdmin(ORG_A),
      users: [ORG_ADMIN_A],
      searchResult: candidates,
    })

    await service.listCandidates(null)

    expect(searchCalls).toEqual([{ organizationId: ORG_A, search: null }])
  })

  it('drops Site Admins, the caller themselves, and users with no organization', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      users: [ORG_ADMIN_A],
      searchResult: [...candidates, ORG_ADMIN_A],
    })

    const result = await service.listCandidates(null)

    expect(result.map((c) => c.userId)).toEqual(['active-a', 'inactive-a'])
  })

  it('returns inactive users greyed out rather than hidden (rule 21)', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      users: [ORG_ADMIN_A],
      searchResult: candidates,
    })

    const result = await service.listCandidates(null)

    expect(result.find((c) => c.userId === 'active-a')?.selectable).toBe(true)
    expect(result.find((c) => c.userId === 'inactive-a')?.selectable).toBe(false)
  })

  it('marks members of an archived organization unselectable', async () => {
    const { service } = harness({
      currentUser: siteAdmin(),
      users: [SITE_ADMIN],
      organizations: [organization({ isArchived: true })],
      searchResult: [user({ id: 'active-a' })],
    })

    const result = await service.listCandidates(null)

    expect(result[0]?.selectable).toBe(false)
  })

  it.each([Role.User, Role.ReadOnly])('refuses %s', async (role) => {
    const caller = role === Role.User ? memberContext(ORG_A) : readOnly(ORG_A)
    const { service } = harness({
      currentUser: caller,
      users: [user({ id: caller.userId as string, role })],
    })

    await expect(service.listCandidates(null)).rejects.toThrow(ForbiddenError)
  })
})
