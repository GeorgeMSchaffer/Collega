// Sign-in message use cases (SPEC/20-feature-login-messages.md LMS-1..LMS-6; contract in
// SPEC/contracts/login-messages.md). The repository is an in-memory double that keeps the ordering,
// scope and audience rules the real one implements, so the visible set, the receipts and the
// acknowledgement report can be checked end to end over a fixed clock. Message ids come from the
// service (`randomUUID`), so the tests read them from the result rather than assuming them.

import { LoginMessageDismissal, LoginMessageDisplay, Role } from '@collega/domain/enums'
import type { LoginMessage, LoginMessageReceipt } from '@collega/domain/login-messages'
import { describe, expect, it } from 'vitest'
import type { AccessTokenValidator, ImpersonationResolver } from '../src/auth/ports.js'
import { TokenAuthenticationService } from '../src/auth/token-authentication-service.js'
import {
  type CurrentUserContext,
  ForbiddenError,
  NotFoundError,
  type PageRequest,
  UnauthorizedError,
  UnprocessableError,
  ValidationError,
} from '../src/common/index.js'
import { LoginMessageService } from '../src/login-messages/login-message.service.js'
import type {
  LoginMessageAcknowledgement,
  LoginMessageInput,
} from '../src/login-messages/models.js'
import type { LoginMessageRepository } from '../src/login-messages/ports.js'
import { account, userStore } from './auth/auth-harness.js'
import {
  anonymous,
  countingUnitOfWork,
  fixedClock,
  impersonating,
  member,
  ORG_A,
  ORG_B,
  orgAdmin,
  readOnly,
  recordingAudit,
  siteAdmin,
} from './support/fixtures.js'

const T0 = new Date('2026-11-01T00:00:00.000Z')
const SIGN_IN_1 = new Date('2026-11-02T09:00:00.000Z')
const SIGN_IN_2 = new Date('2026-11-03T09:00:00.000Z')
const NOW = new Date('2026-11-02T12:00:00.000Z')
const END = new Date('2026-11-08T00:00:00.000Z')

type TestUser = {
  readonly id: string
  readonly name: string
  readonly email: string
  readonly organizationId: string | null
  readonly organizationName: string | null
  readonly active: boolean
}

const USERS: readonly TestUser[] = [
  {
    id: 'u-a1',
    name: 'Ann',
    email: 'ann@a.test',
    organizationId: ORG_A,
    organizationName: 'Org A',
    active: true,
  },
  {
    id: 'u-a2',
    name: 'Bob',
    email: 'bob@a.test',
    organizationId: ORG_A,
    organizationName: 'Org A',
    active: true,
  },
  {
    id: 'u-a3',
    name: 'Cy',
    email: 'cy@a.test',
    organizationId: ORG_A,
    organizationName: 'Org A',
    active: false,
  },
  {
    id: 'u-b1',
    name: 'Dee',
    email: 'dee@b.test',
    organizationId: ORG_B,
    organizationName: 'Org B',
    active: true,
  },
]

function fakeRepository(users: readonly TestUser[] = USERS) {
  const messages = new Map<string, LoginMessage>()
  const receipts = new Map<string, LoginMessageReceipt>()
  const key = (messageId: string, userId: string) => `${messageId}|${userId}`
  const audience = (organizationId: string | null) =>
    users.filter(
      (u) => u.active && (organizationId === null || u.organizationId === organizationId),
    )
  const ackOf = (m: Pick<LoginMessage, 'id' | 'revision'>, userId: string) => {
    const r = receipts.get(key(m.id, userId))
    return r && r.revision === m.revision ? r.acknowledgedAtUtc : null
  }
  const byDisplay = (a: LoginMessage, b: LoginMessage) =>
    (a.organizationId === null ? 0 : 1) - (b.organizationId === null ? 0 : 1) ||
    a.startsAtUtc.getTime() - b.startsAtUtc.getTime() ||
    a.createdAtUtc.getTime() - b.createdAtUtc.getTime() ||
    a.id.localeCompare(b.id)

  const repository: LoginMessageRepository = {
    getById: async (id) => messages.get(id) ?? null,
    list: async (organizationId, page) => {
      const all = [...messages.values()]
        .filter((m) => m.organizationId === organizationId)
        .sort(
          (a, b) =>
            b.startsAtUtc.getTime() - a.startsAtUtc.getTime() ||
            b.createdAtUtc.getTime() - a.createdAtUtc.getTime(),
        )
      const start = (page.page - 1) * page.pageSize
      return { items: all.slice(start, start + page.pageSize), totalCount: all.length }
    },
    listLive: async (organizationId, now) =>
      [...messages.values()]
        .filter(
          (m) =>
            (m.organizationId === null || m.organizationId === organizationId) &&
            m.startsAtUtc.getTime() <= now.getTime() &&
            (m.endsAtUtc === null || now.getTime() < m.endsAtUtc.getTime()),
        )
        .sort(byDisplay),
    add: async (m) => {
      messages.set(m.id, m)
    },
    save: async (m) => {
      messages.set(m.id, m)
    },
    remove: async (id) => {
      messages.delete(id)
      for (const k of [...receipts.keys()]) if (k.startsWith(`${id}|`)) receipts.delete(k)
    },
    listReceipts: async (userId, ids) =>
      ids.flatMap((id) => {
        const r = receipts.get(key(id, userId))
        return r ? [r] : []
      }),
    saveReceipt: async (r) => {
      receipts.set(key(r.messageId, r.userId), r)
    },
    countAudience: async (organizationId) => audience(organizationId).length,
    countAcknowledged: async (list) =>
      new Map(
        list.map((m) => [
          m.id,
          audience(m.organizationId).filter((u) => ackOf(m, u.id) !== null).length,
        ]),
      ),
    listAcknowledgements: async (m, page: PageRequest) => {
      const rows: LoginMessageAcknowledgement[] = audience(m.organizationId).map((u) => ({
        userId: u.id,
        name: u.name,
        email: u.email,
        organizationName: u.organizationName,
        acknowledgedAtUtc: ackOf(m, u.id),
      }))
      rows.sort(
        (a, b) => Number(b.acknowledgedAtUtc !== null) - Number(a.acknowledgedAtUtc !== null),
      )
      const start = (page.page - 1) * page.pageSize
      return { items: rows.slice(start, start + page.pageSize), totalCount: rows.length }
    },
  }
  return { repository, messages, receipts }
}

function input(overrides: Partial<LoginMessageInput> = {}): LoginMessageInput {
  return {
    title: 'Planned maintenance',
    body: 'Read-only on Saturday.',
    display: LoginMessageDisplay.Modal,
    dismissalMode: LoginMessageDismissal.EveryLogin,
    startsAtUtc: T0,
    endsAtUtc: END,
    ...overrides,
  }
}

function build(user: CurrentUserContext, repo = fakeRepository(), now: Date = NOW) {
  const audit = recordingAudit()
  const unitOfWork = countingUnitOfWork()
  const service = new LoginMessageService(repo.repository, unitOfWork, audit, user, fixedClock(now))
  return { service, audit, unitOfWork, ...repo }
}

/** A service for the same repository acting as someone else, or at another time. */
function as(repo: ReturnType<typeof fakeRepository>, user: CurrentUserContext, now: Date = NOW) {
  return build(user, repo, now)
}

function signedIn(user: CurrentUserContext, at: Date): CurrentUserContext {
  return { ...user, signedInAtUtc: at }
}

async function seedMessage(
  repo: ReturnType<typeof fakeRepository>,
  organizationId: string | null,
  overrides: Partial<LoginMessageInput> = {},
  now: Date = NOW,
) {
  const admin = organizationId === null ? siteAdmin() : orgAdmin(organizationId)
  const svc = as(repo, admin, now).service
  return organizationId === null
    ? svc.createSystem(input(overrides))
    : svc.createForOrganization(organizationId, input(overrides))
}

async function thrown(promise: Promise<unknown>): Promise<unknown> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  expect(error).not.toBeNull()
  return error
}

describe('LoginMessageService authorization', () => {
  it('lets a Site Admin acting directly list, create, read, update and delete system messages', async () => {
    const { service } = build(siteAdmin())
    const created = await service.createSystem(input())
    expect(created.organizationId).toBeNull()
    expect((await service.listSystem()).items.map((m) => m.id)).toEqual([created.id])
    expect((await service.get(created.id)).id).toBe(created.id)
    const updated = await service.update(created.id, {
      ...input({ title: 'New' }),
      showAgain: false,
    })
    expect(updated.title).toBe('New')
    await service.delete(created.id)
    expect((await service.listSystem()).items).toEqual([])
  })

  it.each([
    ['an Org Admin', orgAdmin()],
    ['a User', member()],
    ['a Read Only member', readOnly()],
    [
      'a Site Admin in View As (acting as an Org Admin)',
      impersonating({ targetUserId: 'u', targetRole: Role.OrgAdmin, targetOrganizationId: ORG_A }),
    ],
  ])('refuses %s every system-message list and create with 403', async (_label, user) => {
    const { service } = build(user)
    expect(await thrown(service.listSystem())).toBeInstanceOf(ForbiddenError)
    expect(await thrown(service.createSystem(input()))).toBeInstanceOf(ForbiddenError)
  })

  it.each([
    ['an Org Admin', orgAdmin()],
    ['a User', member()],
    ['a Read Only member', readOnly()],
  ])('refuses %s read, update and delete of a system message with 403', async (_label, user) => {
    const repo = fakeRepository()
    const sys = await seedMessage(repo, null)
    const { service, messages } = as(repo, user)
    expect(await thrown(service.get(sys.id))).toBeInstanceOf(ForbiddenError)
    expect(await thrown(service.update(sys.id, { ...input(), showAgain: false }))).toBeInstanceOf(
      ForbiddenError,
    )
    expect(await thrown(service.delete(sys.id))).toBeInstanceOf(ForbiddenError)
    expect(messages.has(sys.id)).toBe(true)
  })

  it('lets an Org Admin list, create, read, update and delete their own organization messages', async () => {
    const { service } = build(orgAdmin(ORG_A))
    const created = await service.createForOrganization(ORG_A, input())
    expect(created.organizationId).toBe(ORG_A)
    expect((await service.listForOrganization(ORG_A)).items.map((m) => m.id)).toEqual([created.id])
    expect((await service.get(created.id)).id).toBe(created.id)
    expect(
      (await service.update(created.id, { ...input({ title: 'T2' }), showAgain: false })).title,
    ).toBe('T2')
    await service.delete(created.id)
    expect((await service.listForOrganization(ORG_A)).items).toEqual([])
  })

  it('lets a Site Admin in View As manage the viewed organization', async () => {
    const viewAs = impersonating({
      targetUserId: 'u',
      targetRole: Role.OrgAdmin,
      targetOrganizationId: ORG_A,
    })
    const { service } = build(viewAs)
    const created = await service.createForOrganization(ORG_A, input())
    expect(created.organizationId).toBe(ORG_A)
    expect((await service.listForOrganization(ORG_A)).items).toHaveLength(1)
  })

  it.each([
    ['a User', member()],
    ['a Read Only member', readOnly()],
  ])('refuses %s list and create in their own organization with 403', async (_label, user) => {
    const { service } = build(user)
    expect(await thrown(service.listForOrganization(ORG_A))).toBeInstanceOf(ForbiddenError)
    expect(await thrown(service.createForOrganization(ORG_A, input()))).toBeInstanceOf(
      ForbiddenError,
    )
  })

  it('refuses a Site Admin acting directly any organization-message change with 403', async () => {
    const repo = fakeRepository()
    const org = await seedMessage(repo, ORG_A)
    const { service, messages } = as(repo, siteAdmin())
    expect(await thrown(service.listForOrganization(ORG_A))).toBeInstanceOf(ForbiddenError)
    expect(await thrown(service.createForOrganization(ORG_A, input()))).toBeInstanceOf(
      ForbiddenError,
    )
    expect(await thrown(service.get(org.id))).toBeInstanceOf(ForbiddenError)
    expect(await thrown(service.update(org.id, { ...input(), showAgain: false }))).toBeInstanceOf(
      ForbiddenError,
    )
    expect(await thrown(service.delete(org.id))).toBeInstanceOf(ForbiddenError)
    expect(messages.has(org.id)).toBe(true)
  })

  it.each([
    ['an Org Admin', orgAdmin(ORG_B)],
    ['a User', member(ORG_B)],
  ])(
    'answers 404 when %s of another organization reaches an organization message',
    async (_label, user) => {
      const repo = fakeRepository()
      const org = await seedMessage(repo, ORG_A)
      const { service, messages } = as(repo, user)
      expect(await thrown(service.listForOrganization(ORG_A))).toBeInstanceOf(NotFoundError)
      expect(await thrown(service.createForOrganization(ORG_A, input()))).toBeInstanceOf(
        NotFoundError,
      )
      expect(await thrown(service.get(org.id))).toBeInstanceOf(NotFoundError)
      expect(await thrown(service.update(org.id, { ...input(), showAgain: false }))).toBeInstanceOf(
        NotFoundError,
      )
      expect(await thrown(service.delete(org.id))).toBeInstanceOf(NotFoundError)
      expect(messages.has(org.id)).toBe(true)
    },
  )

  it('answers 404 for a message that does not exist', async () => {
    const { service } = build(orgAdmin())
    expect(await thrown(service.get('missing'))).toBeInstanceOf(NotFoundError)
    expect(await thrown(service.delete('missing'))).toBeInstanceOf(NotFoundError)
  })

  it('answers 401 to an anonymous caller on every entry point', async () => {
    const { service } = build(anonymous)
    expect(await thrown(service.listSystem())).toBeInstanceOf(UnauthorizedError)
    expect(await thrown(service.get('x'))).toBeInstanceOf(UnauthorizedError)
    expect(await thrown(service.listVisible())).toBeInstanceOf(UnauthorizedError)
    expect(await thrown(service.close('x'))).toBeInstanceOf(UnauthorizedError)
    expect(await thrown(service.acknowledge('x'))).toBeInstanceOf(UnauthorizedError)
  })
})

describe('LoginMessageService manage', () => {
  it('reports the state against the clock', async () => {
    const repo = fakeRepository()
    const scheduled = await seedMessage(repo, null, {
      startsAtUtc: new Date('2026-12-01T00:00:00Z'),
      endsAtUtc: null,
    })
    const live = await seedMessage(repo, null)
    const ended = await seedMessage(repo, null, {
      startsAtUtc: T0,
      endsAtUtc: new Date('2026-11-02T00:00:00Z'),
    })
    expect([scheduled.state, live.state, ended.state]).toEqual(['Scheduled', 'Live', 'Ended'])
  })

  it('answers 400 keyed by field for an invalid title, writing nothing', async () => {
    const { service, messages, audit, unitOfWork } = build(siteAdmin())
    const error = await thrown(service.createSystem(input({ title: '   ' })))
    expect(error).toBeInstanceOf(ValidationError)
    expect(Object.keys((error as ValidationError).failures)).toEqual(['title'])
    expect(messages.size).toBe(0)
    expect(audit.events).toEqual([])
    expect(unitOfWork.saves).toBe(0)
  })

  it('answers 400 keyed endsAtUtc when the end is not after the start', async () => {
    const { service } = build(siteAdmin())
    const error = await thrown(service.createSystem(input({ endsAtUtc: T0 })))
    expect(Object.keys((error as ValidationError).failures)).toEqual(['endsAtUtc'])
  })

  it('answers 400 keyed startsAtUtc for an invalid date on update and keeps the stored message', async () => {
    const repo = fakeRepository()
    const sys = await seedMessage(repo, null)
    const { service, messages } = as(repo, siteAdmin())
    const error = await thrown(
      service.update(sys.id, { ...input({ startsAtUtc: new Date(Number.NaN) }), showAgain: true }),
    )
    expect(Object.keys((error as ValidationError).failures)).toEqual(['startsAtUtc'])
    expect(messages.get(sys.id)?.revision).toBe(1)
  })

  it('raises the revision only with showAgain true', async () => {
    const { service } = build(siteAdmin())
    const created = await service.createSystem(input())
    const kept = await service.update(created.id, { ...input({ title: 'Edit' }), showAgain: false })
    expect(kept.revision).toBe(1)
    const raised = await service.update(created.id, {
      ...input({ title: 'Edit' }),
      showAgain: true,
    })
    expect(raised.revision).toBe(2)
  })

  it('pages the list newest start first', async () => {
    const { service } = build(siteAdmin())
    const early = await service.createSystem(input({ title: 'early', startsAtUtc: T0 }))
    const late = await service.createSystem(
      input({ title: 'late', startsAtUtc: new Date('2026-11-02T00:00:00Z'), endsAtUtc: null }),
    )
    const page = await service.listSystem({ page: 1, pageSize: 1 })
    expect(page.items.map((m) => m.id)).toEqual([late.id])
    expect(page.totalCount).toBe(2)
    expect((await service.listSystem({ page: 2, pageSize: 1 })).items.map((m) => m.id)).toEqual([
      early.id,
    ])
  })

  it('omits the counts for modes other than AcknowledgeRequired and includes them for it', async () => {
    const { service } = build(orgAdmin(ORG_A))
    const every = await service.createForOrganization(ORG_A, input())
    const once = await service.createForOrganization(
      ORG_A,
      input({ dismissalMode: LoginMessageDismissal.DismissOnce }),
    )
    const ack = await service.createForOrganization(
      ORG_A,
      input({ dismissalMode: LoginMessageDismissal.AcknowledgeRequired }),
    )
    expect(every).not.toHaveProperty('acknowledgedCount')
    expect(once).not.toHaveProperty('audienceCount')
    expect(ack).toMatchObject({ acknowledgedCount: 0, audienceCount: 2 })
  })

  it('removes the message together with its receipts on delete', async () => {
    const repo = fakeRepository()
    const sys = await seedMessage(repo, null)
    await as(repo, signedIn(member(ORG_A, 'u-a1'), SIGN_IN_1)).service.close(sys.id)
    expect(repo.receipts.size).toBe(1)
    await as(repo, siteAdmin()).service.delete(sys.id)
    expect(repo.receipts.size).toBe(0)
  })
})

describe('LoginMessageService audit', () => {
  it('writes LoginMessageCreated for a system message with scope and the message id', async () => {
    const { service, audit } = build(siteAdmin())
    const created = await service.createSystem(input())
    expect(audit.events).toHaveLength(1)
    expect(audit.events[0]).toMatchObject({
      eventType: 'LoginMessageCreated',
      entityType: 'LoginMessage',
      entityId: created.id,
      organizationId: null,
      occurredAtUtc: NOW,
    })
    expect(JSON.parse(audit.events[0]?.metadataJson ?? '{}')).toMatchObject({ scope: 'System' })
  })

  it('writes LoginMessageCreated for an organization message carrying that organization', async () => {
    const { service, audit } = build(orgAdmin(ORG_A))
    const created = await service.createForOrganization(ORG_A, input())
    expect(audit.events[0]).toMatchObject({
      eventType: 'LoginMessageCreated',
      entityType: 'LoginMessage',
      entityId: created.id,
      organizationId: ORG_A,
    })
    expect(JSON.parse(audit.events[0]?.metadataJson ?? '{}')).toMatchObject({
      scope: 'Organization',
    })
  })

  it.each([true, false])('writes LoginMessageUpdated recording showAgain %s', async (showAgain) => {
    const { service, audit } = build(siteAdmin())
    const created = await service.createSystem(input())
    await service.update(created.id, { ...input(), showAgain })
    expect(audit.events.map((e) => e.eventType)).toEqual([
      'LoginMessageCreated',
      'LoginMessageUpdated',
    ])
    expect(audit.events[1]).toMatchObject({ entityType: 'LoginMessage', entityId: created.id })
    expect(JSON.parse(audit.events[1]?.metadataJson ?? '{}')).toMatchObject({ showAgain })
  })

  it('writes LoginMessageDeleted with the message id', async () => {
    const { service, audit } = build(siteAdmin())
    const created = await service.createSystem(input())
    await service.delete(created.id)
    expect(audit.events[1]).toMatchObject({
      eventType: 'LoginMessageDeleted',
      entityType: 'LoginMessage',
      entityId: created.id,
    })
  })

  it('attributes a View As change to the real administrator', async () => {
    const viewAs = impersonating({
      targetUserId: 'u-a1',
      targetRole: Role.OrgAdmin,
      targetOrganizationId: ORG_A,
      realUserId: 'site-admin-9',
    })
    const { service, audit } = build(viewAs)
    await service.createForOrganization(ORG_A, input())
    expect(JSON.stringify(audit.events[0])).toContain('site-admin-9')
  })

  it('writes no audit event for a refused change', async () => {
    const { service, audit } = build(member())
    await thrown(service.createForOrganization(ORG_A, input()))
    expect(audit.events).toEqual([])
  })

  it('writes no audit event for close or acknowledge', async () => {
    const repo = fakeRepository()
    const sys = await seedMessage(repo, null, {
      dismissalMode: LoginMessageDismissal.AcknowledgeRequired,
    })
    const { service, audit } = as(repo, signedIn(member(ORG_A, 'u-a1'), SIGN_IN_1))
    await service.close(sys.id)
    await service.acknowledge(sys.id)
    expect(audit.events).toEqual([])
  })
})

describe('LoginMessageService.listVisible', () => {
  const user = (id = 'u-a1', org = ORG_A) => member(org, id)

  it('orders system first, then earlier start, then earlier creation', async () => {
    const repo = fakeRepository()
    const orgEarly = await seedMessage(
      repo,
      ORG_A,
      { title: 'org early', startsAtUtc: new Date('2026-11-01T00:00:00Z') },
      new Date('2026-11-01T01:00:00Z'),
    )
    const sysLate = await seedMessage(
      repo,
      null,
      { title: 'sys late', startsAtUtc: new Date('2026-11-02T00:00:00Z') },
      new Date('2026-11-01T02:00:00Z'),
    )
    const sysEarlyCreatedSecond = await seedMessage(
      repo,
      null,
      { title: 'sys early 2', startsAtUtc: new Date('2026-11-01T06:00:00Z') },
      new Date('2026-11-01T04:00:00Z'),
    )
    const sysEarlyCreatedFirst = await seedMessage(
      repo,
      null,
      { title: 'sys early 1', startsAtUtc: new Date('2026-11-01T06:00:00Z') },
      new Date('2026-11-01T03:00:00Z'),
    )
    const orgLate = await seedMessage(
      repo,
      ORG_A,
      { title: 'org late', startsAtUtc: new Date('2026-11-02T00:00:00Z') },
      new Date('2026-11-01T05:00:00Z'),
    )

    const visible = await as(repo, signedIn(user(), SIGN_IN_1)).service.listVisible()

    expect(visible.map((m) => m.id)).toEqual([
      sysEarlyCreatedFirst.id,
      sysEarlyCreatedSecond.id,
      sysLate.id,
      orgEarly.id,
      orgLate.id,
    ])
    expect(visible.map((m) => m.scope)).toEqual([
      'System',
      'System',
      'System',
      'Organization',
      'Organization',
    ])
  })

  it('returns the contract fields only', async () => {
    const repo = fakeRepository()
    const sys = await seedMessage(repo, null)
    const [first] = await as(repo, signedIn(user(), SIGN_IN_1)).service.listVisible()
    expect(first).toEqual({
      id: sys.id,
      scope: 'System',
      title: sys.title,
      body: sys.body,
      display: sys.display,
      dismissalMode: sys.dismissalMode,
      revision: 1,
    })
  })

  it('excludes scheduled and ended messages and includes one live from its exact start', async () => {
    const repo = fakeRepository()
    await seedMessage(repo, null, {
      title: 'scheduled',
      startsAtUtc: new Date(NOW.getTime() + 1),
      endsAtUtc: null,
    })
    await seedMessage(repo, null, { title: 'ended', startsAtUtc: T0, endsAtUtc: NOW })
    const starting = await seedMessage(repo, null, {
      title: 'starting',
      startsAtUtc: NOW,
      endsAtUtc: null,
    })
    const visible = await as(repo, signedIn(user(), SIGN_IN_1)).service.listVisible()
    expect(visible.map((m) => m.id)).toEqual([starting.id])
  })

  it("shows an organization's messages to its members only", async () => {
    const repo = fakeRepository()
    const orgA = await seedMessage(repo, ORG_A)
    const mine = await as(repo, signedIn(user('u-a1', ORG_A), SIGN_IN_1)).service.listVisible()
    const theirs = await as(repo, signedIn(user('u-b1', ORG_B), SIGN_IN_1)).service.listVisible()
    expect(mine.map((m) => m.id)).toEqual([orgA.id])
    expect(theirs).toEqual([])
  })

  it('shows a Site Admin the system messages only', async () => {
    const repo = fakeRepository()
    const sys = await seedMessage(repo, null)
    await seedMessage(repo, ORG_A)
    const visible = await as(repo, signedIn(siteAdmin(), SIGN_IN_1)).service.listVisible()
    expect(visible.map((m) => m.id)).toEqual([sys.id])
  })

  it('answers an empty set during View As even with live messages', async () => {
    const repo = fakeRepository()
    await seedMessage(repo, null)
    await seedMessage(repo, ORG_A)
    const viewAs = {
      ...impersonating({
        targetUserId: 'u-a1',
        targetRole: Role.User,
        targetOrganizationId: ORG_A,
      }),
      signedInAtUtc: SIGN_IN_1,
    }
    expect(await as(repo, viewAs).service.listVisible()).toEqual([])
  })

  it('shows a Read Only member the messages', async () => {
    const repo = fakeRepository()
    const sys = await seedMessage(repo, null)
    const visible = await as(repo, signedIn(readOnly(), SIGN_IN_1)).service.listVisible()
    expect(visible.map((m) => m.id)).toEqual([sys.id])
  })

  it('hides an EveryLogin message after a close in this sign-in and shows it again after the next sign-in', async () => {
    const repo = fakeRepository()
    const sys = await seedMessage(repo, null)
    const first = signedIn(user(), SIGN_IN_1)
    await as(repo, first).service.close(sys.id)
    expect(await as(repo, first).service.listVisible()).toEqual([])
    const second = signedIn(user(), SIGN_IN_2)
    expect(
      (await as(repo, second, new Date('2026-11-03T10:00:00Z')).service.listVisible()).map(
        (m) => m.id,
      ),
    ).toEqual([sys.id])
  })

  it('hides a DismissOnce message for good across sign-ins', async () => {
    const repo = fakeRepository()
    const sys = await seedMessage(repo, null, { dismissalMode: LoginMessageDismissal.DismissOnce })
    await as(repo, signedIn(user(), SIGN_IN_1)).service.close(sys.id)
    const later = new Date('2026-11-03T10:00:00Z')
    expect(await as(repo, signedIn(user(), SIGN_IN_2), later).service.listVisible()).toEqual([])
  })

  it('keeps an AcknowledgeRequired message after a close and hides it for good after an acknowledgement', async () => {
    const repo = fakeRepository()
    const sys = await seedMessage(repo, null, {
      dismissalMode: LoginMessageDismissal.AcknowledgeRequired,
    })
    const later = new Date('2026-11-03T10:00:00Z')
    await as(repo, signedIn(user(), SIGN_IN_1)).service.close(sys.id)
    expect(
      (await as(repo, signedIn(user(), SIGN_IN_2), later).service.listVisible()).map((m) => m.id),
    ).toEqual([sys.id])

    await as(repo, signedIn(user(), SIGN_IN_2), later).service.acknowledge(sys.id)
    expect(await as(repo, signedIn(user(), SIGN_IN_2), later).service.listVisible()).toEqual([])
    expect(
      await as(
        repo,
        signedIn(user(), new Date('2026-11-04T09:00:00Z')),
        new Date('2026-11-04T10:00:00Z'),
      ).service.listVisible(),
    ).toEqual([])
  })

  it("keeps one user's receipt from hiding the message for another", async () => {
    const repo = fakeRepository()
    const sys = await seedMessage(repo, null)
    await as(repo, signedIn(user('u-a1'), SIGN_IN_1)).service.close(sys.id)
    const other = await as(repo, signedIn(user('u-a2'), SIGN_IN_1)).service.listVisible()
    expect(other.map((m) => m.id)).toEqual([sys.id])
  })

  it('shows the message again to everyone after an edit with showAgain, but not without it', async () => {
    const repo = fakeRepository()
    const sys = await seedMessage(repo, null, {
      dismissalMode: LoginMessageDismissal.AcknowledgeRequired,
    })
    const viewer = signedIn(user(), SIGN_IN_1)
    await as(repo, viewer).service.acknowledge(sys.id)

    await as(repo, siteAdmin()).service.update(sys.id, {
      ...input({ title: 'Reworded', dismissalMode: LoginMessageDismissal.AcknowledgeRequired }),
      showAgain: false,
    })
    expect(await as(repo, viewer).service.listVisible()).toEqual([])

    await as(repo, siteAdmin()).service.update(sys.id, {
      ...input({ title: 'Reworded', dismissalMode: LoginMessageDismissal.AcknowledgeRequired }),
      showAgain: true,
    })
    const after = await as(repo, viewer).service.listVisible()
    expect(after.map((m) => [m.id, m.title, m.revision])).toEqual([[sys.id, 'Reworded', 2]])
  })

  it('shows the edited text to a user who has not hidden the message', async () => {
    const repo = fakeRepository()
    const sys = await seedMessage(repo, null)
    await as(repo, siteAdmin()).service.update(sys.id, {
      ...input({ title: 'Changed' }),
      showAgain: false,
    })
    const [first] = await as(repo, signedIn(user(), SIGN_IN_1)).service.listVisible()
    expect(first?.title).toBe('Changed')
  })

  it('treats a token without a sign-in time as the oldest sign-in, so any close hides the message', async () => {
    const repo = fakeRepository()
    const sys = await seedMessage(repo, null)
    await as(repo, signedIn(user(), SIGN_IN_1)).service.close(sys.id)
    expect((await as(repo, user()).service.listVisible()).map((m) => m.id)).toEqual([])
  })

  it('returns nothing and skips the receipt read when nothing is live', async () => {
    const repo = fakeRepository()
    expect(await as(repo, signedIn(user(), SIGN_IN_1)).service.listVisible()).toEqual([])
  })
})

describe('LoginMessageService.close and acknowledge', () => {
  const viewer = (id = 'u-a1', org = ORG_A) => signedIn(member(org, id), SIGN_IN_1)

  it.each([
    ['close', (s: LoginMessageService, id: string) => s.close(id)],
    ['acknowledge', (s: LoginMessageService, id: string) => s.acknowledge(id)],
  ])('refuses %s during View As with 403 and writes no receipt', async (_label, act) => {
    const repo = fakeRepository()
    const sys = await seedMessage(repo, null, {
      dismissalMode: LoginMessageDismissal.AcknowledgeRequired,
    })
    const viewAs = impersonating({
      targetUserId: 'u-a1',
      targetRole: Role.User,
      targetOrganizationId: ORG_A,
    })
    const { service, receipts, unitOfWork } = as(repo, viewAs)
    expect(await thrown(act(service, sys.id))).toBeInstanceOf(ForbiddenError)
    expect(receipts.size).toBe(0)
    expect(unitOfWork.saves).toBe(0)
  })

  it.each([
    ['not live yet', { startsAtUtc: new Date(NOW.getTime() + 1), endsAtUtc: null }],
    ['already ended', { startsAtUtc: T0, endsAtUtc: NOW }],
  ])('answers 404 when the message is %s', async (_label, overrides) => {
    const repo = fakeRepository()
    const sys = await seedMessage(repo, null, {
      dismissalMode: LoginMessageDismissal.AcknowledgeRequired,
      ...overrides,
    })
    const { service, receipts } = as(repo, viewer())
    expect(await thrown(service.close(sys.id))).toBeInstanceOf(NotFoundError)
    expect(await thrown(service.acknowledge(sys.id))).toBeInstanceOf(NotFoundError)
    expect(receipts.size).toBe(0)
  })

  it("answers 404 for another organization's message and for a missing one", async () => {
    const repo = fakeRepository()
    const orgA = await seedMessage(repo, ORG_A, {
      dismissalMode: LoginMessageDismissal.AcknowledgeRequired,
    })
    const { service } = as(repo, viewer('u-b1', ORG_B))
    expect(await thrown(service.close(orgA.id))).toBeInstanceOf(NotFoundError)
    expect(await thrown(service.acknowledge(orgA.id))).toBeInstanceOf(NotFoundError)
    expect(await thrown(service.close('missing'))).toBeInstanceOf(NotFoundError)
  })

  it('answers 404 to a Site Admin acting directly for an organization message', async () => {
    const repo = fakeRepository()
    const orgA = await seedMessage(repo, ORG_A)
    expect(
      await thrown(as(repo, signedIn(siteAdmin(), SIGN_IN_1)).service.close(orgA.id)),
    ).toBeInstanceOf(NotFoundError)
  })

  it.each([LoginMessageDismissal.EveryLogin, LoginMessageDismissal.DismissOnce])(
    'answers 422 acknowledgeNotRequired when acknowledging a %s message',
    async (mode) => {
      const repo = fakeRepository()
      const sys = await seedMessage(repo, null, { dismissalMode: mode })
      const { service, receipts } = as(repo, viewer())
      const error = await thrown(service.acknowledge(sys.id))
      expect(error).toBeInstanceOf(UnprocessableError)
      expect((error as UnprocessableError).code).toBe('acknowledgeNotRequired')
      expect(receipts.size).toBe(0)
    },
  )

  it('lets a Read Only member close and acknowledge', async () => {
    const repo = fakeRepository()
    const sys = await seedMessage(repo, null, {
      dismissalMode: LoginMessageDismissal.AcknowledgeRequired,
    })
    const { service, receipts } = as(repo, signedIn(readOnly(ORG_A, 'u-a2'), SIGN_IN_1))
    await service.close(sys.id)
    await service.acknowledge(sys.id)
    expect(receipts.get(`${sys.id}|u-a2`)?.acknowledgedAtUtc).toEqual(NOW)
  })

  it('records the close time and the message revision on the receipt', async () => {
    const repo = fakeRepository()
    const sys = await seedMessage(repo, null)
    await as(repo, viewer()).service.close(sys.id)
    expect(repo.receipts.get(`${sys.id}|u-a1`)).toEqual({
      messageId: sys.id,
      userId: 'u-a1',
      revision: 1,
      closedAtUtc: NOW,
      dismissedAtUtc: null,
      acknowledgedAtUtc: null,
    })
  })

  it('records a DismissOnce close as a dismissal', async () => {
    const repo = fakeRepository()
    const sys = await seedMessage(repo, null, { dismissalMode: LoginMessageDismissal.DismissOnce })
    await as(repo, viewer()).service.close(sys.id)
    expect(repo.receipts.get(`${sys.id}|u-a1`)).toMatchObject({
      dismissedAtUtc: NOW,
      closedAtUtc: null,
    })
  })

  it('is idempotent: the first acknowledgement is kept, the latest close wins, each save commits', async () => {
    const repo = fakeRepository()
    const sys = await seedMessage(repo, null, {
      dismissalMode: LoginMessageDismissal.AcknowledgeRequired,
    })
    const later = new Date('2026-11-02T15:00:00Z')
    await as(repo, viewer()).service.acknowledge(sys.id)
    await as(repo, viewer()).service.close(sys.id)
    const again = as(repo, viewer(), later)
    await again.service.acknowledge(sys.id)
    await again.service.close(sys.id)
    expect(repo.receipts.get(`${sys.id}|u-a1`)).toMatchObject({
      acknowledgedAtUtc: NOW,
      closedAtUtc: later,
    })
    expect(again.unitOfWork.saves).toBe(2)
  })

  it('starts a fresh receipt after showAgain so the old acknowledgement stops counting', async () => {
    const repo = fakeRepository()
    const sys = await seedMessage(repo, null, {
      dismissalMode: LoginMessageDismissal.AcknowledgeRequired,
    })
    await as(repo, viewer()).service.acknowledge(sys.id)
    await as(repo, siteAdmin()).service.update(sys.id, {
      ...input({ dismissalMode: LoginMessageDismissal.AcknowledgeRequired }),
      showAgain: true,
    })
    await as(repo, viewer()).service.close(sys.id)
    expect(repo.receipts.get(`${sys.id}|u-a1`)).toMatchObject({
      revision: 2,
      acknowledgedAtUtc: null,
      closedAtUtc: NOW,
    })
  })
})

describe('LoginMessageService.acknowledgements', () => {
  const ackMode = { dismissalMode: LoginMessageDismissal.AcknowledgeRequired }

  async function acknowledgeAs(
    repo: ReturnType<typeof fakeRepository>,
    userId: string,
    org: string,
    id: string,
    at: Date,
  ) {
    await as(repo, signedIn(member(org, userId), SIGN_IN_1), at).service.acknowledge(id)
  }

  it("counts N of M over the organization's Active users only", async () => {
    const repo = fakeRepository()
    const msg = await seedMessage(repo, ORG_A, ackMode)
    await acknowledgeAs(repo, 'u-a1', ORG_A, msg.id, NOW)
    const report = await as(repo, orgAdmin(ORG_A)).service.acknowledgements(msg.id)
    expect(report).toMatchObject({ acknowledgedCount: 1, audienceCount: 2, totalCount: 2 })
  })

  it('lists acknowledged users first with name, email, organization and time, others as not yet', async () => {
    const repo = fakeRepository()
    const msg = await seedMessage(repo, ORG_A, ackMode)
    await acknowledgeAs(repo, 'u-a2', ORG_A, msg.id, NOW)
    const report = await as(repo, orgAdmin(ORG_A)).service.acknowledgements(msg.id)
    expect(report.items).toEqual([
      {
        userId: 'u-a2',
        name: 'Bob',
        email: 'bob@a.test',
        organizationName: 'Org A',
        acknowledgedAtUtc: NOW,
      },
      {
        userId: 'u-a1',
        name: 'Ann',
        email: 'ann@a.test',
        organizationName: 'Org A',
        acknowledgedAtUtc: null,
      },
    ])
  })

  it('counts every Active user for a system message, across organizations', async () => {
    const repo = fakeRepository()
    const msg = await seedMessage(repo, null, ackMode)
    await acknowledgeAs(repo, 'u-a1', ORG_A, msg.id, NOW)
    await acknowledgeAs(repo, 'u-b1', ORG_B, msg.id, NOW)
    const report = await as(repo, siteAdmin()).service.acknowledgements(msg.id)
    expect(report).toMatchObject({ acknowledgedCount: 2, audienceCount: 3 })
  })

  it('starts from zero after showAgain', async () => {
    const repo = fakeRepository()
    const msg = await seedMessage(repo, ORG_A, ackMode)
    await acknowledgeAs(repo, 'u-a1', ORG_A, msg.id, NOW)
    const admin = as(repo, orgAdmin(ORG_A)).service
    await admin.update(msg.id, { ...input(ackMode), showAgain: true })
    expect(await admin.acknowledgements(msg.id)).toMatchObject({
      acknowledgedCount: 0,
      audienceCount: 2,
    })
  })

  it('shows the same N of M on the message item as on the report', async () => {
    const repo = fakeRepository()
    const msg = await seedMessage(repo, ORG_A, ackMode)
    await acknowledgeAs(repo, 'u-a1', ORG_A, msg.id, NOW)
    const item = await as(repo, orgAdmin(ORG_A)).service.get(msg.id)
    expect(item).toMatchObject({ acknowledgedCount: 1, audienceCount: 2 })
  })

  it('pages the user list', async () => {
    const repo = fakeRepository()
    const msg = await seedMessage(repo, ORG_A, ackMode)
    const report = await as(repo, orgAdmin(ORG_A)).service.acknowledgements(msg.id, {
      page: 2,
      pageSize: 1,
    })
    expect(report.items).toHaveLength(1)
    expect(report).toMatchObject({ page: 2, pageSize: 1, totalCount: 2 })
  })

  it.each([LoginMessageDismissal.EveryLogin, LoginMessageDismissal.DismissOnce])(
    'answers 422 acknowledgeNotRequired for a %s message',
    async (mode) => {
      const repo = fakeRepository()
      const msg = await seedMessage(repo, ORG_A, { dismissalMode: mode })
      const error = await thrown(as(repo, orgAdmin(ORG_A)).service.acknowledgements(msg.id))
      expect(error).toBeInstanceOf(UnprocessableError)
      expect((error as UnprocessableError).code).toBe('acknowledgeNotRequired')
    },
  )

  it('refuses the report to everyone but the manager', async () => {
    const repo = fakeRepository()
    const sys = await seedMessage(repo, null, ackMode)
    const org = await seedMessage(repo, ORG_A, ackMode)
    expect(await thrown(as(repo, orgAdmin(ORG_A)).service.acknowledgements(sys.id))).toBeInstanceOf(
      ForbiddenError,
    )
    expect(await thrown(as(repo, member(ORG_A)).service.acknowledgements(org.id))).toBeInstanceOf(
      ForbiddenError,
    )
    expect(await thrown(as(repo, siteAdmin()).service.acknowledgements(org.id))).toBeInstanceOf(
      ForbiddenError,
    )
    expect(await thrown(as(repo, orgAdmin(ORG_B)).service.acknowledgements(org.id))).toBeInstanceOf(
      NotFoundError,
    )
  })
})

describe('TokenAuthenticationService sign-in time', () => {
  const noSession: ImpersonationResolver = { resolveActingPrincipal: async () => null }

  function authenticator(issuedAtUtc: Date | undefined) {
    const user = account()
    const validator: AccessTokenValidator = {
      tryValidate: () => ({
        userId: user.id,
        securityStamp: user.securityStamp,
        ...(issuedAtUtc === undefined ? {} : { issuedAtUtc }),
      }),
    }
    return new TokenAuthenticationService(validator, userStore([user]), noSession, fixedClock(NOW))
  }

  it('carries the token issue time on the principal as signedInAtUtc', async () => {
    const principal = await authenticator(SIGN_IN_1).authenticate('token')
    expect(principal?.signedInAtUtc).toEqual(SIGN_IN_1)
  })

  it('leaves signedInAtUtc unset for a token issued without an iat', async () => {
    const principal = await authenticator(undefined).authenticate('token')
    expect(principal).not.toBeNull()
    expect(principal?.signedInAtUtc).toBeUndefined()
  })
})
