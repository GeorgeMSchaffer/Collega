// QA for Outcomes (SPEC/contracts/outcomes.md, "Decided 2026-10-15"): every rule and default,
// driven through OutcomeService over a stateful fake store so sequences (delete then read, create
// then append) are observable. Rollup arithmetic is the repository's, tested against the live DB.

import { Priority, Role, UserStatus } from '@collega/domain/enums'
import { createIdea, type Idea } from '@collega/domain/ideas'
import { createOutcome, type Outcome } from '@collega/domain/outcomes'
import { TAG_COLOR_PALETTE } from '@collega/domain/tags'
import { describe, expect, it } from 'vitest'
import type { CurrentUserContext, RandomSource } from '../../src/common/index.js'
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  UnprocessableError,
  ValidationError,
} from '../../src/common/index.js'
import type { OutcomeIdea, OutcomeRollup } from '../../src/outcomes/models.js'
import { OutcomeService } from '../../src/outcomes/outcome.service.js'
import {
  anonymous,
  countingUnitOfWork,
  fixedClock,
  impersonating,
  member,
  NOW,
  ORG_A,
  ORG_B,
  orgAdmin,
  readOnly,
  recordingAudit,
  siteAdmin,
} from '../support/fixtures.js'

const CREATE = {
  name: 'Launch',
  description: null,
  targetStartDate: '2026-10-01',
  targetEndDate: '2026-12-31',
  ownerUserId: null,
  color: null,
}
const SAME = {
  name: 'Outcome o1',
  description: null,
  targetStartDate: '2026-10-01',
  targetEndDate: '2026-12-31',
  ownerUserId: null,
}

function outcome(id: string, sortOrder: number, overrides: Partial<Outcome> = {}): Outcome {
  return {
    ...createOutcome({
      id,
      organizationId: ORG_A,
      name: `Outcome ${id}`,
      description: null,
      targetStartDate: '2026-10-01',
      targetEndDate: '2026-12-31',
      ownerUserId: null,
      sortOrder,
      color: '#112233',
      nowUtc: NOW,
      actorUserId: 'seed',
    }),
    ...overrides,
  }
}

function idea(id: string, overrides: Partial<Idea> = {}): Idea {
  return {
    ...createIdea({
      id,
      organizationId: ORG_A,
      boardId: 'board-a',
      statusId: 'status-1',
      title: `Idea ${id}`,
      description: 'Body',
      problem: 'A problem',
      proposedSolutions: ['A solution'],
      impactRationale: 'A rationale',
      priority: Priority.Medium,
      ideaTypeId: 'type-a',
      businessImpactId: 'impact-a',
      dueDate: null,
      authorUserId: 'author-1',
      assigneeUserIds: [],
      tagIds: [],
      mentionedUserIds: [],
      nowUtc: NOW,
    }),
    ...overrides,
  }
}

const rollup = (overrides: Partial<OutcomeRollup> = {}): OutcomeRollup => ({
  ideaCount: 0,
  doneIdeaCount: 0,
  taskCount: 0,
  doneTaskCount: 0,
  sprintStart: null,
  sprintEnd: null,
  metricTotals: [],
  ...overrides,
})

const card = (ideaId: string): OutcomeIdea => ({
  ideaId,
  title: ideaId,
  statusId: 's',
  effort: null,
  metrics: [],
  assigneeUserIds: [],
  sprintId: null,
  sprintStart: null,
  sprintEnd: null,
})

function harness(options: {
  currentUser: CurrentUserContext
  outcomes?: readonly Outcome[]
  ideas?: readonly Idea[]
  rollups?: Record<string, OutcomeRollup>
  grouped?: Record<string, readonly OutcomeIdea[]>
  ungroupedIdeas?: readonly OutcomeIdea[]
  users?: { id: string; organizationId: string | null; status: UserStatus }[]
  randomIndex?: number
}) {
  const store = new Map((options.outcomes ?? []).map((o) => [o.id, o]))
  const ideaStore = new Map((options.ideas ?? []).map((i) => [i.id, i]))
  const ungrouped: string[] = []
  const rollupRequests: (readonly string[])[] = []
  const unitOfWork = countingUnitOfWork()
  const audit = recordingAudit()
  const random: RandomSource = { nextInt: () => options.randomIndex ?? 0 }

  const service = new OutcomeService(
    {
      async getById(id) {
        return store.get(id) ?? null
      },
      async listByOrganization(organizationId) {
        return [...store.values()]
          .filter((o) => o.organizationId === organizationId && !o.isDeleted)
          .sort((a, b) => a.sortOrder - b.sortOrder)
      },
      async add(o) {
        store.set(o.id, o)
      },
      async save(o) {
        store.set(o.id, o)
      },
      async ungroupIdeas(id) {
        ungrouped.push(id)
        for (const [key, value] of ideaStore) {
          if (value.outcomeId === id) ideaStore.set(key, { ...value, outcomeId: null })
        }
      },
    },
    {
      async rollupsByOutcomeIds(ids) {
        rollupRequests.push(ids)
        return new Map(ids.map((id) => [id, options.rollups?.[id] ?? rollup()]))
      },
      async ideasByOutcomeIds(ids) {
        return new Map(ids.map((id) => [id, options.grouped?.[id] ?? []]))
      },
      async listUngroupedIdeas() {
        return options.ungroupedIdeas ?? []
      },
    },
    {
      async getById(id) {
        return ideaStore.get(id) ?? null
      },
      async update(i) {
        ideaStore.set(i.id, i)
      },
    },
    {
      async listByIds(ids) {
        return (options.users ?? []).filter((u) => ids.includes(u.id))
      },
    },
    unitOfWork,
    audit,
    options.currentUser,
    fixedClock(),
    random,
  )
  return { service, store, ideaStore, ungrouped, rollupRequests, audit, unitOfWork }
}

const thrown = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (e: unknown) => e,
  )
const metadata = (event: { metadataJson?: string | null } | undefined) =>
  JSON.parse(event?.metadataJson ?? '{}') as Record<string, unknown>

describe('role matrix', () => {
  const calls: [string, (s: OutcomeService) => Promise<unknown>][] = [
    ['create', (s) => s.create(ORG_A, CREATE)],
    ['update', (s) => s.update(ORG_A, 'o1', { ...SAME, color: undefined })],
    ['reorder', (s) => s.reorder(ORG_A, ['o1'])],
    ['delete', (s) => s.delete(ORG_A, 'o1')],
    ['group', (s) => s.setIdeaOutcome('i1', 'o1')],
  ]
  const reads: [string, (s: OutcomeService) => Promise<unknown>][] = [
    ['list', (s) => s.list(ORG_A, undefined)],
    ['get', (s) => s.get(ORG_A, 'o1')],
    ['roadmap', (s) => s.roadmap(ORG_A)],
  ]
  const fixture = () => ({
    outcomes: [outcome('o1', 0)],
    ideas: [idea('i1')],
  })

  it.each(calls)('Org Admin may %s', async (_n, call) => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A), ...fixture() })
    expect(await thrown(call(service))).toBeNull()
  })

  it.each(calls)('a User is refused %s with 403', async (_n, call) => {
    const { service } = harness({ currentUser: member(ORG_A), ...fixture() })
    expect(await thrown(call(service))).toBeInstanceOf(ForbiddenError)
  })

  it.each(calls)('Read Only is refused %s with 403', async (_n, call) => {
    const { service } = harness({ currentUser: readOnly(ORG_A), ...fixture() })
    expect(await thrown(call(service))).toBeInstanceOf(ForbiddenError)
  })

  it.each([...calls, ...reads])('a direct Site Admin is refused %s with 403', async (_n, call) => {
    const { service } = harness({ currentUser: siteAdmin(), ...fixture() })
    expect(await thrown(call(service))).toBeInstanceOf(ForbiddenError)
  })

  it.each(reads)('a User and Read Only may %s', async (_n, call) => {
    for (const user of [member(ORG_A), readOnly(ORG_A)]) {
      const { service } = harness({ currentUser: user, ...fixture() })
      expect(await thrown(call(service))).toBeNull()
    }
  })

  it.each([...calls, ...reads])('a Site Admin in View As an Org Admin may %s', async (_n, call) => {
    const viewAs = impersonating({
      targetUserId: 'org-admin-1',
      targetRole: Role.OrgAdmin,
      targetOrganizationId: ORG_A,
    })
    const { service } = harness({ currentUser: viewAs, ...fixture() })
    expect(await thrown(call(service))).toBeNull()
  })

  it.each([...calls, ...reads])('an anonymous caller gets 401 on %s', async (_n, call) => {
    const { service } = harness({ currentUser: anonymous, ...fixture() })
    expect(await thrown(call(service))).toBeInstanceOf(UnauthorizedError)
  })

  it.each([
    ['list', (s: OutcomeService) => s.list(ORG_B, undefined)],
    ['get', (s: OutcomeService) => s.get(ORG_B, 'o1')],
    ['roadmap', (s: OutcomeService) => s.roadmap(ORG_B)],
    ['create', (s: OutcomeService) => s.create(ORG_B, CREATE)],
    ['update', (s: OutcomeService) => s.update(ORG_B, 'o1', { ...SAME, color: undefined })],
    ['reorder', (s: OutcomeService) => s.reorder(ORG_B, ['o1'])],
    ['delete', (s: OutcomeService) => s.delete(ORG_B, 'o1')],
  ])('an organization outside caller scope is 404 on %s', async (_n, call) => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A), ...fixture() })
    expect(await thrown(call(service))).toBeInstanceOf(NotFoundError)
  })

  it('an idea in another organization is 404 for grouping', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      outcomes: [outcome('o1', 0)],
      ideas: [idea('foreign', { organizationId: ORG_B })],
    })
    expect(await thrown(service.setIdeaOutcome('foreign', 'o1'))).toBeInstanceOf(NotFoundError)
  })
})

describe('list', () => {
  const many = Array.from({ length: 25 }, (_, n) => outcome(`o${String(n).padStart(2, '0')}`, n))

  it('defaults to page 1 of 20 in sortOrder with the envelope fields', async () => {
    const { service } = harness({ currentUser: readOnly(ORG_A), outcomes: many.toReversed() })

    const page = await service.list(ORG_A, undefined)

    expect(page).toMatchObject({
      page: 1,
      pageSize: 20,
      totalCount: 25,
      sortBy: 'sortOrder',
      sortDirection: 'asc',
    })
    expect(page.items).toHaveLength(20)
    expect(page.items.map((i) => i.sortOrder)).toEqual(Array.from({ length: 20 }, (_, n) => n))
  })

  it('serves the second page and clamps pageSize to 1..100', async () => {
    const { service } = harness({ currentUser: readOnly(ORG_A), outcomes: many })

    const second = await service.list(ORG_A, { page: 2, pageSize: 20 })
    expect(second.items.map((i) => i.outcomeId)).toEqual(['o20', 'o21', 'o22', 'o23', 'o24'])

    expect((await service.list(ORG_A, { page: 1, pageSize: 0 })).pageSize).toBe(1)
    expect((await service.list(ORG_A, { page: 1, pageSize: 5000 })).pageSize).toBe(100)
  })

  it('leaves out soft-deleted and other-organization Outcomes and carries the rollup flat', async () => {
    const { service } = harness({
      currentUser: readOnly(ORG_A),
      outcomes: [
        outcome('live', 0),
        outcome('gone', 1, { isDeleted: true }),
        outcome('other', 2, { organizationId: ORG_B }),
      ],
      rollups: {
        live: rollup({ ideaCount: 3, sprintStart: '2026-10-01', sprintEnd: '2026-10-14' }),
      },
    })

    const page = await service.list(ORG_A, undefined)

    expect(page.totalCount).toBe(1)
    expect(page.items[0]).toMatchObject({
      outcomeId: 'live',
      ideaCount: 3,
      sprintStart: '2026-10-01',
      sprintEnd: '2026-10-14',
    })
    expect(page.items[0]).not.toHaveProperty('ownerDisplayName')
    expect(page.items[0]).not.toHaveProperty('ideas')
  })
})

describe('create', () => {
  it('returns the item with a zero rollup and null sprint span', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A) })

    const created = await service.create(ORG_A, CREATE)

    expect(created).toMatchObject({
      organizationId: ORG_A,
      name: 'Launch',
      ideaCount: 0,
      doneIdeaCount: 0,
      taskCount: 0,
      doneTaskCount: 0,
      sprintStart: null,
      sprintEnd: null,
    })
    expect(created).not.toHaveProperty('ownerDisplayName')
  })

  it('places the first Outcome at 0 and then max+1 among non-deleted ones', async () => {
    const empty = harness({ currentUser: orgAdmin(ORG_A) })
    expect((await empty.service.create(ORG_A, CREATE)).sortOrder).toBe(0)

    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      outcomes: [outcome('a', 0), outcome('b', 3), outcome('deleted', 9, { isDeleted: true })],
    })
    expect((await service.create(ORG_A, CREATE)).sortOrder).toBe(4)
  })

  it('takes the colour from the injected random source when absent, and upper-cases a given one', async () => {
    const pick = 3
    const { service } = harness({ currentUser: orgAdmin(ORG_A), randomIndex: pick })

    const absent = await service.create(ORG_A, CREATE)
    const given = await service.create(ORG_A, { ...CREATE, color: '#aabbcc' })

    expect(absent.color).toBe(TAG_COLOR_PALETTE[pick]?.toUpperCase())
    expect(given.color).toBe('#AABBCC')
  })

  it('allows duplicate names', async () => {
    const { service, store } = harness({ currentUser: orgAdmin(ORG_A) })

    await service.create(ORG_A, CREATE)
    await service.create(ORG_A, CREATE)

    expect([...store.values()].map((o) => o.name)).toEqual(['Launch', 'Launch'])
  })

  it('writes OutcomeCreated carrying the fields, after saving', async () => {
    const { service, audit, unitOfWork } = harness({ currentUser: orgAdmin(ORG_A) })

    await service.create(ORG_A, { ...CREATE, color: '#abcdef', description: 'Why' })

    expect(unitOfWork.saves).toBe(1)
    expect(audit.events.map((e) => e.eventType)).toEqual(['OutcomeCreated'])
    expect(audit.events[0]).toMatchObject({ entityType: 'Outcome', organizationId: ORG_A })
    expect(metadata(audit.events[0])).toMatchObject({
      name: 'Launch',
      description: 'Why',
      targetStartDate: '2026-10-01',
      targetEndDate: '2026-12-31',
      color: '#ABCDEF',
    })
  })

  it.each([
    ['blank name', { name: '  ' }, 'name', 'Name is required.'],
    ['long name', { name: 'x'.repeat(121) }, 'name', 'Name must be 120 characters or fewer.'],
    [
      'long description',
      { description: 'x'.repeat(1001) },
      'description',
      'Description must be 1000 characters or fewer.',
    ],
    ['missing start', { targetStartDate: '' }, 'targetStartDate', 'Target Start Date is required.'],
    ['missing end', { targetEndDate: '' }, 'targetEndDate', 'Target End Date is required.'],
    [
      'bad start',
      { targetStartDate: '2026-13-40' },
      'targetStartDate',
      'Target Start Date must be a valid date.',
    ],
    [
      'bad end',
      { targetEndDate: 'soon' },
      'targetEndDate',
      'Target End Date must be a valid date.',
    ],
    [
      'end before start',
      { targetEndDate: '2026-09-30' },
      'targetEndDate',
      'End date must be on or after start date.',
    ],
    ['bad colour', { color: 'red' }, 'color', 'Color must be a valid #RRGGBB color.'],
    ['short colour', { color: '#abc' }, 'color', 'Color must be a valid #RRGGBB color.'],
  ])('refuses %s with a 400 keyed %s', async (_label, patch, key, message) => {
    const { service, store, audit } = harness({ currentUser: orgAdmin(ORG_A) })

    const error = await thrown(service.create(ORG_A, { ...CREATE, ...patch }))

    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).failures).toEqual({ [key]: [message] })
    expect(store.size).toBe(0)
    expect(audit.events).toHaveLength(0)
  })

  it('accepts a name of exactly 120 characters and a same-day window', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A) })
    await expect(
      service.create(ORG_A, {
        ...CREATE,
        name: 'x'.repeat(120),
        targetEndDate: CREATE.targetStartDate,
      }),
    ).resolves.toBeDefined()
  })

  it.each([
    ['another organization', { organizationId: ORG_B, status: UserStatus.Active }],
    ['an inactive user', { organizationId: ORG_A, status: UserStatus.Inactive }],
  ])('refuses an owner who is %s, and an unknown owner, keyed ownerUserId', async (_l, owner) => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      users: [{ id: 'u1', ...owner }],
    })

    for (const id of ['u1', 'ghost']) {
      const error = await thrown(service.create(ORG_A, { ...CREATE, ownerUserId: id }))
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).failures).toHaveProperty('ownerUserId')
    }
  })

  it('accepts an active owner of the organization', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      users: [{ id: 'u1', organizationId: ORG_A, status: UserStatus.Active }],
    })
    await expect(service.create(ORG_A, { ...CREATE, ownerUserId: 'u1' })).resolves.toMatchObject({
      ownerUserId: 'u1',
    })
  })
})

describe('update', () => {
  const existing = () => outcome('o1', 2, { description: 'old', color: '#112233' })

  it('is a full replacement: a null description clears it', async () => {
    const { service, store } = harness({ currentUser: orgAdmin(ORG_A), outcomes: [existing()] })

    const updated = await service.update(ORG_A, 'o1', {
      ...SAME,
      description: null,
      color: undefined,
    })

    expect(updated.description).toBeNull()
    expect(store.get('o1')?.description).toBeNull()
  })

  it('keeps colour and sortOrder when colour is absent, and never touches an idea', async () => {
    const { service, ideaStore } = harness({
      currentUser: orgAdmin(ORG_A),
      outcomes: [existing()],
      ideas: [idea('i1', { outcomeId: 'o1' })],
    })

    const updated = await service.update(ORG_A, 'o1', {
      ...SAME,
      name: 'Renamed',
      color: undefined,
    })

    expect(updated).toMatchObject({ name: 'Renamed', color: '#112233', sortOrder: 2 })
    expect(ideaStore.get('i1')?.outcomeId).toBe('o1')
  })

  it('refuses a null colour with 400 keyed color and saves nothing', async () => {
    const { service, audit } = harness({ currentUser: orgAdmin(ORG_A), outcomes: [existing()] })

    const error = await thrown(service.update(ORG_A, 'o1', { ...SAME, color: null }))

    expect((error as ValidationError).failures).toEqual({
      color: ['Color must be a valid #RRGGBB color.'],
    })
    expect(audit.events).toHaveLength(0)
  })

  it('validates and upper-cases a supplied colour', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A), outcomes: [existing()] })

    expect(await service.update(ORG_A, 'o1', { ...SAME, color: '#abcdef' })).toMatchObject({
      color: '#ABCDEF',
    })
    const error = await thrown(service.update(ORG_A, 'o1', { ...SAME, color: 'blue' }))
    expect((error as ValidationError).failures).toHaveProperty('color')
  })

  it.each([
    ['name', { name: '' }],
    ['targetEndDate', { targetEndDate: '2026-01-01' }],
    ['targetStartDate', { targetStartDate: 'x' }],
    ['description', { description: 'x'.repeat(1001) }],
  ])('applies the create field rules: bad %s is a 400', async (key, patch) => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A), outcomes: [existing()] })

    const error = await thrown(service.update(ORG_A, 'o1', { ...SAME, ...patch, color: undefined }))

    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).failures).toHaveProperty(key)
  })

  it('writes nothing and no audit when the replacement equals the stored values', async () => {
    const { service, audit, unitOfWork } = harness({
      currentUser: orgAdmin(ORG_A),
      outcomes: [outcome('o1', 0)],
    })

    const result = await service.update(ORG_A, 'o1', { ...SAME, color: undefined })

    expect(result.outcomeId).toBe('o1')
    expect(audit.events).toHaveLength(0)
    expect(unitOfWork.saves).toBe(0)
  })

  it('audits OutcomeUpdated once with from and to for every changed field only', async () => {
    const { service, audit } = harness({
      currentUser: orgAdmin(ORG_A),
      outcomes: [outcome('o1', 0)],
    })

    await service.update(ORG_A, 'o1', {
      ...SAME,
      name: 'New',
      description: 'Why',
      targetEndDate: '2027-01-31',
      color: '#ABCDEF',
    })

    expect(audit.events.map((e) => e.eventType)).toEqual(['OutcomeUpdated'])
    expect(metadata(audit.events[0])).toEqual({
      changes: {
        name: { from: 'Outcome o1', to: 'New' },
        description: { from: null, to: 'Why' },
        targetEndDate: { from: '2026-12-31', to: '2027-01-31' },
        color: { from: '#112233', to: '#ABCDEF' },
      },
    })
  })

  it('records an owner change with from and to', async () => {
    const { service, audit } = harness({
      currentUser: orgAdmin(ORG_A),
      outcomes: [outcome('o1', 0)],
      users: [{ id: 'u1', organizationId: ORG_A, status: UserStatus.Active }],
    })

    await service.update(ORG_A, 'o1', { ...SAME, ownerUserId: 'u1', color: undefined })

    expect(metadata(audit.events[0])).toEqual({
      changes: { ownerUserId: { from: null, to: 'u1' } },
    })
  })

  it('returns the rollup with the updated item', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      outcomes: [outcome('o1', 0)],
      rollups: { o1: rollup({ ideaCount: 4, doneIdeaCount: 1 }) },
    })

    expect(
      await service.update(ORG_A, 'o1', { ...SAME, name: 'N', color: undefined }),
    ).toMatchObject({ ideaCount: 4, doneIdeaCount: 1 })
  })

  it.each([
    ['soft-deleted', outcome('o1', 0, { isDeleted: true })],
    ['another organization', outcome('o1', 0, { organizationId: ORG_B })],
  ])('answers 404 for an Outcome that is %s, and for an unknown id', async (_l, stored) => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A), outcomes: [stored] })

    expect(await thrown(service.update(ORG_A, 'o1', { ...SAME, color: undefined }))).toBeInstanceOf(
      NotFoundError,
    )
    expect(
      await thrown(service.update(ORG_A, 'missing', { ...SAME, color: undefined })),
    ).toBeInstanceOf(NotFoundError)
  })
})

describe('reorder', () => {
  const four = () => [outcome('a', 0), outcome('b', 1), outcome('c', 2), outcome('d', 3)]
  const order = (store: Map<string, Outcome>) =>
    [...store.values()].sort((x, y) => x.sortOrder - y.sortOrder).map((o) => [o.id, o.sortOrder])

  it('is a full reorder when every id is listed', async () => {
    const { service, store } = harness({ currentUser: orgAdmin(ORG_A), outcomes: four() })

    await expect(service.reorder(ORG_A, ['d', 'c', 'b', 'a'])).resolves.toBeUndefined()

    expect(order(store)).toEqual([
      ['d', 0],
      ['c', 1],
      ['b', 2],
      ['a', 3],
    ])
  })

  it('puts a partial list first and keeps the rest in relative order, renumbered 0..n-1', async () => {
    const { service, store } = harness({ currentUser: orgAdmin(ORG_A), outcomes: four() })

    await service.reorder(ORG_A, ['c', 'a'])

    expect(order(store)).toEqual([
      ['c', 0],
      ['a', 1],
      ['b', 2],
      ['d', 3],
    ])
  })

  it('renumbers over non-deleted Outcomes even when stored numbers have gaps', async () => {
    const { service, store } = harness({
      currentUser: orgAdmin(ORG_A),
      outcomes: [outcome('a', 5), outcome('gone', 6, { isDeleted: true }), outcome('b', 9)],
    })

    await service.reorder(ORG_A, ['b'])

    expect(store.get('b')?.sortOrder).toBe(0)
    expect(store.get('a')?.sortOrder).toBe(1)
    expect(store.get('gone')?.sortOrder).toBe(6)
  })

  it('writes no audit event and one unit-of-work save', async () => {
    const { service, audit, unitOfWork } = harness({
      currentUser: orgAdmin(ORG_A),
      outcomes: four(),
    })

    await service.reorder(ORG_A, ['b'])

    expect(audit.events).toHaveLength(0)
    expect(unitOfWork.saves).toBe(1)
  })

  it.each([
    ['an absent list', null, 'Ordered Ids is required.'],
    ['an empty list', [], 'Ordered Ids is required.'],
    ['a duplicated id', ['a', 'a'], 'Ordered Ids must not repeat an Outcome.'],
    ['an unknown id', ['a', 'nope'], 'Ordered Ids must name Outcomes of this organization.'],
    ['a soft-deleted id', ['gone'], 'Ordered Ids must name Outcomes of this organization.'],
    [
      'another organization id',
      ['foreign'],
      'Ordered Ids must name Outcomes of this organization.',
    ],
  ])('refuses %s with 400 keyed orderedIds and changes nothing', async (_l, ids, message) => {
    const { service, store } = harness({
      currentUser: orgAdmin(ORG_A),
      outcomes: [
        ...four(),
        outcome('gone', 7, { isDeleted: true }),
        outcome('foreign', 8, { organizationId: ORG_B }),
      ],
    })
    const before = JSON.stringify([...store.values()])

    const error = await thrown(service.reorder(ORG_A, ids))

    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).failures).toEqual({ orderedIds: [message] })
    expect(JSON.stringify([...store.values()])).toBe(before)
  })
})

describe('delete', () => {
  it('soft-deletes, ungroups its items without deleting them, and audits OutcomeDeleted with its fields', async () => {
    const { service, store, ideaStore, ungrouped, audit } = harness({
      currentUser: orgAdmin(ORG_A),
      outcomes: [outcome('o1', 0)],
      ideas: [idea('i1', { outcomeId: 'o1' }), idea('i2', { outcomeId: 'o1' })],
    })

    await expect(service.delete(ORG_A, 'o1')).resolves.toBeUndefined()

    expect(store.get('o1')?.isDeleted).toBe(true)
    expect(ungrouped).toEqual(['o1'])
    expect([...ideaStore.values()].map((i) => [i.outcomeId, i.isDeleted])).toEqual([
      [null, false],
      [null, false],
    ])
    expect(audit.events.map((e) => e.eventType)).toEqual(['OutcomeDeleted'])
    expect(metadata(audit.events[0])).toMatchObject({ name: 'Outcome o1', color: '#112233' })
  })

  it('answers a repeat delete as success with no second audit and no second ungroup', async () => {
    const { service, audit, ungrouped } = harness({
      currentUser: orgAdmin(ORG_A),
      outcomes: [outcome('o1', 0, { isDeleted: true })],
    })

    await expect(service.delete(ORG_A, 'o1')).resolves.toBeUndefined()

    expect(audit.events).toHaveLength(0)
    expect(ungrouped).toHaveLength(0)
  })

  it('answers 404 for a never-existing id and for another organization, even a deleted one', async () => {
    const { service, store } = harness({
      currentUser: orgAdmin(ORG_A),
      outcomes: [
        outcome('other', 0, { organizationId: ORG_B }),
        outcome('other-gone', 1, { organizationId: ORG_B, isDeleted: true }),
      ],
    })

    for (const id of ['missing', 'other', 'other-gone']) {
      expect(await thrown(service.delete(ORG_A, id))).toBeInstanceOf(NotFoundError)
    }
    expect(store.get('other')?.isDeleted).toBe(false)
  })

  it('removes the Outcome from reads and refuses GET and PUT afterwards, but not another delete', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      outcomes: [outcome('o1', 0), outcome('o2', 1)],
    })

    await service.delete(ORG_A, 'o1')

    expect((await service.list(ORG_A, undefined)).items.map((i) => i.outcomeId)).toEqual(['o2'])
    expect((await service.roadmap(ORG_A)).outcomes.map((i) => i.outcomeId)).toEqual(['o2'])
    expect(await thrown(service.get(ORG_A, 'o1'))).toBeInstanceOf(NotFoundError)
    expect(await thrown(service.update(ORG_A, 'o1', { ...SAME, color: undefined }))).toBeInstanceOf(
      NotFoundError,
    )
    await expect(service.delete(ORG_A, 'o1')).resolves.toBeUndefined()
  })

  it('does not count a deleted Outcome toward the next sortOrder', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      outcomes: [outcome('o1', 0), outcome('o2', 1)],
    })

    await service.delete(ORG_A, 'o2')

    expect((await service.create(ORG_A, CREATE)).sortOrder).toBe(1)
  })
})

describe('get', () => {
  it('returns the item, flat rollup and its grouped items', async () => {
    const { service } = harness({
      currentUser: readOnly(ORG_A),
      outcomes: [outcome('o1', 0)],
      rollups: { o1: rollup({ ideaCount: 2, taskCount: 5, doneTaskCount: 1 }) },
      grouped: { o1: [card('i1'), card('i2')] },
    })

    const detail = await service.get(ORG_A, 'o1')

    expect(detail).toMatchObject({ outcomeId: 'o1', ideaCount: 2, taskCount: 5, doneTaskCount: 1 })
    expect(detail.ideas.map((i) => i.ideaId)).toEqual(['i1', 'i2'])
  })

  it.each([
    ['soft-deleted', outcome('o1', 0, { isDeleted: true })],
    ['another organization', outcome('o1', 0, { organizationId: ORG_B })],
  ])('answers 404 for a %s Outcome', async (_l, stored) => {
    const { service } = harness({ currentUser: readOnly(ORG_A), outcomes: [stored] })
    expect(await thrown(service.get(ORG_A, 'o1'))).toBeInstanceOf(NotFoundError)
    expect(await thrown(service.get(ORG_A, 'missing'))).toBeInstanceOf(NotFoundError)
  })
})

describe('roadmap', () => {
  it('returns {outcomes, ungrouped} unpaged, in sortOrder, each Outcome with rollup and ideas', async () => {
    const outcomes = Array.from({ length: 30 }, (_, n) => outcome(`o${n}`, 30 - n))
    const { service, rollupRequests } = harness({
      currentUser: readOnly(ORG_A),
      outcomes,
      rollups: { o29: rollup({ ideaCount: 1 }) },
      grouped: { o29: [card('i1')] },
      ungroupedIdeas: [card('free')],
    })

    const roadmap = await service.roadmap(ORG_A)

    expect(Object.keys(roadmap).sort()).toEqual(['outcomes', 'ungrouped'])
    expect(roadmap.outcomes).toHaveLength(30)
    expect(roadmap.outcomes[0]).toMatchObject({ outcomeId: 'o29', ideaCount: 1 })
    expect(roadmap.outcomes[0]?.ideas.map((i) => i.ideaId)).toEqual(['i1'])
    expect(roadmap.outcomes[1]?.ideas).toEqual([])
    expect(roadmap.ungrouped.map((i) => i.ideaId)).toEqual(['free'])
    expect(rollupRequests).toHaveLength(1)
  })

  it('is empty, not an error, for an organization with no Outcomes', async () => {
    const { service } = harness({ currentUser: readOnly(ORG_A) })
    expect(await service.roadmap(ORG_A)).toEqual({ outcomes: [], ungrouped: [] })
  })

  it('excludes soft-deleted Outcomes', async () => {
    const { service } = harness({
      currentUser: readOnly(ORG_A),
      outcomes: [outcome('o1', 0), outcome('gone', 1, { isDeleted: true })],
    })
    expect((await service.roadmap(ORG_A)).outcomes.map((o) => o.outcomeId)).toEqual(['o1'])
  })
})

describe('grouping', () => {
  const base = () => ({
    currentUser: orgAdmin(ORG_A),
    outcomes: [
      outcome('o1', 0),
      outcome('o2', 1),
      outcome('gone', 2, { isDeleted: true }),
      outcome('foreign', 3, { organizationId: ORG_B }),
    ],
  })

  it('refuses a task with 422 taskCannotBeGrouped, grouping or ungrouping, and changes nothing', async () => {
    const { service, ideaStore, audit } = harness({
      ...base(),
      ideas: [idea('task', { parentIdeaId: 'parent', outcomeId: null })],
    })

    for (const target of ['o1', null]) {
      const error = await thrown(service.setIdeaOutcome('task', target))
      expect(error).toBeInstanceOf(UnprocessableError)
      expect((error as UnprocessableError).code).toBe('taskCannotBeGrouped')
    }
    expect(ideaStore.get('task')?.outcomeId).toBeNull()
    expect(audit.events).toHaveLength(0)
  })

  it.each([
    ['on a child board', { boardId: 'child-board' }],
    ['with no board', { boardId: null }],
    ['in any status', { statusId: 'another-status' }],
  ])('groups a top-level card %s', async (_l, patch) => {
    const { service, ideaStore } = harness({ ...base(), ideas: [idea('i1', patch)] })

    await expect(service.setIdeaOutcome('i1', 'o1')).resolves.toEqual({
      ideaId: 'i1',
      outcomeId: 'o1',
    })
    expect(ideaStore.get('i1')?.outcomeId).toBe('o1')
  })

  it('moves between Outcomes, replacing the old grouping, and records from and to with names', async () => {
    const { service, ideaStore, audit } = harness({
      ...base(),
      ideas: [idea('i1', { outcomeId: 'o1' })],
    })

    await service.setIdeaOutcome('i1', 'o2')

    expect(ideaStore.get('i1')?.outcomeId).toBe('o2')
    expect(audit.events).toHaveLength(1)
    expect(audit.events[0]).toMatchObject({ eventType: 'IssueOutcomeGroupingChanged' })
    expect(metadata(audit.events[0])).toEqual({
      ideaId: 'i1',
      fromOutcomeId: 'o1',
      fromOutcomeName: 'Outcome o1',
      toOutcomeId: 'o2',
      toOutcomeName: 'Outcome o2',
    })
  })

  it('ungroups with null and records the old Outcome', async () => {
    const { service, ideaStore, audit } = harness({
      ...base(),
      ideas: [idea('i1', { outcomeId: 'o1' })],
    })

    await expect(service.setIdeaOutcome('i1', null)).resolves.toEqual({
      ideaId: 'i1',
      outcomeId: null,
    })
    expect(ideaStore.get('i1')?.outcomeId).toBeNull()
    expect(metadata(audit.events[0])).toMatchObject({
      fromOutcomeId: 'o1',
      toOutcomeId: null,
      toOutcomeName: null,
    })
  })

  it('treats grouping to the current Outcome and ungrouping an ungrouped item as no-ops', async () => {
    const { service, audit, unitOfWork } = harness({
      ...base(),
      ideas: [idea('grouped', { outcomeId: 'o1' }), idea('free')],
    })

    await expect(service.setIdeaOutcome('grouped', 'o1')).resolves.toEqual({
      ideaId: 'grouped',
      outcomeId: 'o1',
    })
    await expect(service.setIdeaOutcome('free', null)).resolves.toEqual({
      ideaId: 'free',
      outcomeId: null,
    })
    expect(audit.events).toHaveLength(0)
    expect(unitOfWork.saves).toBe(0)
  })

  it.each(['gone', 'foreign', 'never-existed'])(
    'answers 400 keyed outcomeId for Outcome %s',
    async (target) => {
      const { service, ideaStore } = harness({
        ...base(),
        ideas: [idea('i1', { outcomeId: 'o1' })],
      })

      const error = await thrown(service.setIdeaOutcome('i1', target))

      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).failures).toEqual({ outcomeId: ['Outcome not found.'] })
      expect(ideaStore.get('i1')?.outcomeId).toBe('o1')
    },
  )

  it('answers 404 for an unknown idea before it looks at the Outcome', async () => {
    const { service } = harness(base())
    for (const target of ['o1', 'gone', 'nope', null]) {
      expect(await thrown(service.setIdeaOutcome('missing', target))).toBeInstanceOf(NotFoundError)
    }
  })

  it('does not change the idea sprint', async () => {
    const { service, ideaStore } = harness({
      ...base(),
      ideas: [idea('i1', { sprintId: 'sp-1' })],
    })
    await service.setIdeaOutcome('i1', 'o1')
    expect(ideaStore.get('i1')?.sprintId).toBe('sp-1')
  })

  it('after an Outcome delete the items are ungrouped and grouping into it is a 400', async () => {
    const { service, ideaStore } = harness({
      ...base(),
      ideas: [idea('i1', { outcomeId: 'o1' }), idea('i2')],
    })

    await service.delete(ORG_A, 'o1')

    expect(ideaStore.get('i1')?.outcomeId).toBeNull()
    const error = await thrown(service.setIdeaOutcome('i2', 'o1'))
    expect((error as ValidationError).failures).toHaveProperty('outcomeId')
  })
})
