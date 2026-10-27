// QA for an item's metric values (SPEC/contracts/metric-types.md, "GET/PUT /ideas/{ideaId}/metrics"):
// who may read and write, the check order, validation, whole-set replacement over active types,
// the no-op, and the IdeaMetricsChanged audit, driven through IdeaMetricsService over stateful fakes.

import { Priority, Role } from '@collega/domain/enums'
import { createIdea, type Idea } from '@collega/domain/ideas'
import { createMetricType, type MetricType } from '@collega/domain/metric-types'
import { describe, expect, it } from 'vitest'
import {
  type AuditEventInput,
  type CurrentUserContext,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  UnprocessableError,
  ValidationError,
} from '../../src/common/index.js'
import { IdeaMetricsService } from '../../src/metric-types/idea-metrics.service.js'
import type { IdeaMetric, IdeaMetricInput } from '../../src/metric-types/models.js'
import {
  anonymous,
  fixedClock,
  impersonating,
  member,
  NOW,
  ORG_A,
  ORG_B,
  orgAdmin,
  readOnly,
  siteAdmin,
} from '../support/fixtures.js'

const AUTHOR = 'author-1'
const SAVINGS = 'mt-savings'
const HOURS = 'mt-hours'
const OLD = 'mt-old'
const FOREIGN = 'mt-foreign'

function type(id: string, minute: number, overrides: Partial<MetricType> = {}): MetricType {
  return {
    ...createMetricType({
      id,
      organizationId: ORG_A,
      name: id.replace('mt-', ''),
      unit: null,
      nowUtc: new Date(Date.UTC(2026, 9, 1, 0, minute)),
      actorUserId: 'seed',
    }),
    ...overrides,
  }
}

const TYPES = [
  type(SAVINGS, 1),
  type(HOURS, 2),
  type(OLD, 3, { isArchived: true }),
  type(FOREIGN, 4, { organizationId: ORG_B }),
]

function idea(id: string, overrides: Partial<Idea> = {}): Idea {
  return {
    ...createIdea({
      id,
      organizationId: ORG_A,
      boardId: 'board-a',
      statusId: 'status-1',
      title: `Idea ${id}`,
      description: null,
      problem: 'p',
      proposedSolutions: ['s'],
      impactRationale: 'r',
      priority: Priority.Medium,
      ideaTypeId: 'type-a',
      businessImpactId: 'impact-a',
      dueDate: null,
      authorUserId: AUTHOR,
      assigneeUserIds: [],
      tagIds: [],
      mentionedUserIds: [],
      nowUtc: NOW,
    }),
    ...overrides,
  }
}

type Stored = { projected: number | null; realized: number | null }

function harness(
  currentUser: CurrentUserContext,
  options: {
    ideas?: readonly Idea[]
    stored?: Readonly<Record<string, Record<string, Stored>>>
  } = {},
) {
  const ideas = new Map((options.ideas ?? [idea('i1')]).map((i) => [i.id, i]))
  const values = new Map<string, Map<string, Stored>>(
    Object.entries(options.stored ?? {}).map(([ideaId, byType]) => [
      ideaId,
      new Map(Object.entries(byType)),
    ]),
  )
  const log: string[] = []
  const events: AuditEventInput[] = []
  const applied: { upserts: unknown; cleared: unknown }[] = []

  const listByIdea = async (ideaId: string): Promise<readonly IdeaMetric[]> =>
    TYPES.flatMap((t) => {
      const stored = values.get(ideaId)?.get(t.id)
      return stored
        ? [
            {
              metricTypeId: t.id,
              name: t.name,
              unit: t.unit,
              isArchived: t.isArchived,
              projected: stored.projected,
              realized: stored.realized,
            },
          ]
        : []
    })

  const service = new IdeaMetricsService(
    { getById: async (id) => ideas.get(id) ?? null },
    {
      async getById(id) {
        return TYPES.find((t) => t.id === id) ?? null
      },
      async listByOrganization(organizationId, includeArchived) {
        return TYPES.filter(
          (t) => t.organizationId === organizationId && (includeArchived || !t.isArchived),
        )
      },
      async add() {},
      async save() {},
    },
    {
      listByIdea,
      async apply(ideaId, upserts, cleared) {
        log.push('apply')
        applied.push({ upserts, cleared })
        const byType = values.get(ideaId) ?? new Map<string, Stored>()
        for (const typeId of cleared) byType.delete(typeId)
        for (const u of upserts) {
          byType.set(u.metricTypeId, { projected: u.projected, realized: u.realized })
        }
        values.set(ideaId, byType)
      },
    },
    {
      async saveChanges() {
        log.push('commit')
      },
    },
    {
      async write(event) {
        log.push('audit')
        events.push(event)
      },
    },
    currentUser,
    fixedClock(),
    { canSeeBoard: async () => true },
  )
  return { service, log, events, applied, listByIdea }
}

const entry = (
  metricTypeId: string,
  projected: number | null,
  realized: number | null = null,
): IdeaMetricInput => ({ metricTypeId, projected, realized })

async function failure(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('expected a refusal')
    },
    (error: unknown) => error,
  )
}

const failures = (error: unknown) => (error as ValidationError).failures

const stored = (projected: number | null, realized: number | null = null): Stored => ({
  projected,
  realized,
})

describe('GET /ideas/{id}/metrics: who may read', () => {
  const viewAs = (role: Role) =>
    impersonating({ targetUserId: 'target-1', targetRole: role, targetOrganizationId: ORG_A })

  it.each([
    ['the author', member(ORG_A, AUTHOR)],
    ['a User who is not the author', member(ORG_A, 'someone')],
    ['a Read Only user', readOnly(ORG_A)],
    ['an Org Admin', orgAdmin(ORG_A)],
    ['View As a Read Only user', viewAs(Role.ReadOnly)],
  ])('lets %s read', async (_label, ctx) => {
    const h = harness(ctx, { stored: { i1: { [SAVINGS]: stored(5, 6) } } })

    expect(await h.service.get('i1')).toHaveLength(1)
  })

  it('refuses a direct Site Admin with 403', async () => {
    const h = harness(siteAdmin())

    expect(await failure(h.service.get('i1'))).toBeInstanceOf(ForbiddenError)
  })

  it('answers 401 to an anonymous caller', async () => {
    expect(await failure(harness(anonymous).service.get('i1'))).toBeInstanceOf(UnauthorizedError)
  })

  it('answers 404 for a missing idea and for an idea of another organization', async () => {
    expect(await failure(harness(member(ORG_A)).service.get('nope'))).toBeInstanceOf(NotFoundError)
    expect(await failure(harness(member(ORG_B)).service.get('i1'))).toBeInstanceOf(NotFoundError)
  })
})

describe('GET /ideas/{id}/metrics: what is returned', () => {
  it('returns one entry per stored value with type name, unit and flags, in the types order', async () => {
    const h = harness(member(ORG_A), {
      // Stored in the reverse of the types' order on purpose.
      stored: { i1: { [HOURS]: stored(2, null), [SAVINGS]: stored(null, 7.5) } },
    })

    expect(await h.service.get('i1')).toEqual([
      {
        metricTypeId: SAVINGS,
        name: 'savings',
        unit: null,
        isArchived: false,
        projected: null,
        realized: 7.5,
      },
      {
        metricTypeId: HOURS,
        name: 'hours',
        unit: null,
        isArchived: false,
        projected: 2,
        realized: null,
      },
    ])
  })

  it('includes a value on an archived type, flagged', async () => {
    const h = harness(member(ORG_A), {
      stored: { i1: { [SAVINGS]: stored(1), [OLD]: stored(9, 9) } },
    })

    const result = await h.service.get('i1')

    expect(result.map((m) => [m.metricTypeId, m.isArchived])).toEqual([
      [SAVINGS, false],
      [OLD, true],
    ])
  })

  it('returns an empty array for an item with no values', async () => {
    expect(await harness(member(ORG_A)).service.get('i1')).toEqual([])
  })

  it('returns an empty array for a card with a parent even if values are stored on it', async () => {
    const h = harness(member(ORG_A), {
      ideas: [idea('task', { parentIdeaId: 'i1' })],
      stored: { task: { [SAVINGS]: stored(100, 100) } },
    })

    expect(await h.service.get('task')).toEqual([])
  })
})

describe('PUT /ideas/{id}/metrics: who may write', () => {
  const body = [entry(SAVINGS, 10, 4)]

  it.each([
    ['the author', member(ORG_A, AUTHOR)],
    ['an Org Admin who is not the author', orgAdmin(ORG_A)],
    [
      'View As an Org Admin',
      impersonating({
        targetUserId: 'adm',
        targetRole: Role.OrgAdmin,
        targetOrganizationId: ORG_A,
      }),
    ],
  ])('lets %s replace the values', async (_label, ctx) => {
    const h = harness(ctx)

    expect(await h.service.replace('i1', body)).toHaveLength(1)
  })

  it.each([
    ['a User who is not the author', member(ORG_A, 'someone')],
    ['a Read Only user', readOnly(ORG_A)],
    ['a Read Only user who authored the item', readOnly(ORG_A, AUTHOR)],
    [
      'View As a Read Only user',
      impersonating({ targetUserId: 'ro', targetRole: Role.ReadOnly, targetOrganizationId: ORG_A }),
    ],
  ])('refuses %s with 403 and writes nothing', async (_label, ctx) => {
    const h = harness(ctx)

    expect(await failure(h.service.replace('i1', body))).toBeInstanceOf(ForbiddenError)
    expect(h.log).toEqual([])
    expect(h.events).toEqual([])
  })

  it('refuses a direct Site Admin with 403', async () => {
    expect(await failure(harness(siteAdmin()).service.replace('i1', body))).toBeInstanceOf(
      ForbiddenError,
    )
  })

  it('answers 401 to an anonymous caller and 404 to another organization', async () => {
    expect(await failure(harness(anonymous).service.replace('i1', body))).toBeInstanceOf(
      UnauthorizedError,
    )
    expect(await failure(harness(orgAdmin(ORG_B)).service.replace('i1', body))).toBeInstanceOf(
      NotFoundError,
    )
  })
})

describe('PUT /ideas/{id}/metrics: check order', () => {
  const bad = [entry('unknown-type', 1)]

  it('answers 404 for a missing idea before judging a bad body', async () => {
    expect(await failure(harness(orgAdmin(ORG_A)).service.replace('nope', bad))).toBeInstanceOf(
      NotFoundError,
    )
  })

  it('answers 422 taskCannotCarryMetrics for a card with a parent, before judging a bad body', async () => {
    const h = harness(orgAdmin(ORG_A), { ideas: [idea('task', { parentIdeaId: 'i1' })] })

    const error = await failure(h.service.replace('task', bad))

    expect(error).toBeInstanceOf(UnprocessableError)
    expect((error as UnprocessableError).code).toBe('taskCannotCarryMetrics')
    expect(h.log).toEqual([])
  })

  it('answers 422 for a card with a parent even with a valid body, and stores nothing', async () => {
    const h = harness(orgAdmin(ORG_A), { ideas: [idea('task', { parentIdeaId: 'i1' })] })

    const error = await failure(h.service.replace('task', [entry(SAVINGS, 1)]))

    expect((error as UnprocessableError).code).toBe('taskCannotCarryMetrics')
    expect(h.applied).toEqual([])
  })

  it('answers 404 rather than 422 for a card with a parent in another organization', async () => {
    const h = harness(orgAdmin(ORG_B), { ideas: [idea('task', { parentIdeaId: 'i1' })] })

    expect(await failure(h.service.replace('task', bad))).toBeInstanceOf(NotFoundError)
  })

  it('answers 403 rather than 422 to a User who may not edit the card with a parent', async () => {
    const h = harness(member(ORG_A, 'someone'), {
      ideas: [idea('task', { parentIdeaId: 'i1' })],
    })

    expect(await failure(h.service.replace('task', bad))).toBeInstanceOf(ForbiddenError)
  })

  it('answers 400 for a bad body on an ordinary item', async () => {
    expect(await failure(harness(orgAdmin(ORG_A)).service.replace('i1', bad))).toBeInstanceOf(
      ValidationError,
    )
  })
})

describe('PUT /ideas/{id}/metrics: validation (400 keyed metrics)', () => {
  const admin = () => harness(orgAdmin(ORG_A))

  it.each([
    ['an unknown type', 'does-not-exist'],
    ['an archived type', OLD],
    ["another organization's type", FOREIGN],
  ])('refuses %s with "Metric type not found."', async (_label, metricTypeId) => {
    const h = admin()

    const error = await failure(h.service.replace('i1', [entry(metricTypeId, 1)]))

    expect(failures(error)).toEqual({ metrics: ['Metric type not found.'] })
    expect(h.log).toEqual([])
  })

  it('refuses a repeated type, keyed metrics, even when the repeat would clear', async () => {
    for (const body of [
      [entry(SAVINGS, 1), entry(SAVINGS, 2)],
      [entry(SAVINGS, 1), entry(SAVINGS, null, null)],
      [entry(SAVINGS, null, null), entry(SAVINGS, null, null)],
    ]) {
      const h = admin()

      const error = await failure(h.service.replace('i1', body))

      expect(Object.keys(failures(error))).toEqual(['metrics'])
      expect(h.log).toEqual([])
    }
  })

  it('refuses the whole body, writing none of it, when a later entry is invalid', async () => {
    const h = admin()

    await failure(h.service.replace('i1', [entry(SAVINGS, 1), entry(HOURS, 1.234)]))

    expect(h.applied).toEqual([])
    expect(h.events).toEqual([])
  })

  it.each([
    ['projected', 'Projected'],
    ['realized', 'Realized'],
  ] as const)('refuses %s of 10^15 with the range message naming %s', async (which, label) => {
    const projected = which === 'projected' ? 1e15 : 1
    const realized = which === 'realized' ? 1e15 : 1

    const error = await failure(
      admin().service.replace('i1', [entry(SAVINGS, projected, realized)]),
    )

    expect(failures(error)).toEqual({
      metrics: [`${label} must be between -999999999999999.99 and 999999999999999.99.`],
    })
  })

  it('refuses -10^15 too', async () => {
    const error = await failure(admin().service.replace('i1', [entry(SAVINGS, -1e15)]))

    expect(Object.keys(failures(error))).toEqual(['metrics'])
  })

  it('accepts a number just below 10^15, positive and negative', async () => {
    const h = admin()

    const result = await h.service.replace('i1', [
      entry(SAVINGS, 999999999999999, -999999999999999),
    ])

    expect(result[0]).toMatchObject({ projected: 999999999999999, realized: -999999999999999 })
  })

  it.each([
    ['projected', 'Projected'],
    ['realized', 'Realized'],
  ] as const)(
    'refuses three decimals in %s with the decimal-places message naming %s',
    async (which, label) => {
      const projected = which === 'projected' ? 1.005 : 1
      const realized = which === 'realized' ? 1.005 : 1

      const error = await failure(
        admin().service.replace('i1', [entry(SAVINGS, projected, realized)]),
      )

      expect(failures(error)).toEqual({ metrics: [`${label} must have at most 2 decimal places.`] })
    },
  )

  it('accepts two decimals and negatives', async () => {
    const result = await admin().service.replace('i1', [entry(SAVINGS, -0.25, 12.34)])

    expect(result[0]).toMatchObject({ projected: -0.25, realized: 12.34 })
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses %s (what a non-number becomes at the boundary)',
    async (value) => {
      const error = await failure(admin().service.replace('i1', [entry(SAVINGS, value)]))

      expect(Object.keys(failures(error))).toEqual(['metrics'])
    },
  )

  it('does not check a number that is null', async () => {
    const result = await admin().service.replace('i1', [entry(SAVINGS, null, 3)])

    expect(result[0]).toMatchObject({ projected: null, realized: 3 })
  })

  it('accepts an empty list', async () => {
    expect(await admin().service.replace('i1', [])).toEqual([])
  })
})

describe('PUT /ideas/{id}/metrics: whole-set replacement over active types', () => {
  it('stores projected and realized and returns the item values as the read returns them', async () => {
    const h = harness(orgAdmin(ORG_A))

    const result = await h.service.replace('i1', [entry(HOURS, 3, null), entry(SAVINGS, 100.5, 90)])

    expect(result).toEqual(await h.service.get('i1'))
    expect(result.map((m) => [m.metricTypeId, m.projected, m.realized])).toEqual([
      [SAVINGS, 100.5, 90],
      [HOURS, 3, null],
    ])
  })

  it('clears every active type omitted from the body', async () => {
    const h = harness(orgAdmin(ORG_A), {
      stored: { i1: { [SAVINGS]: stored(1, 1), [HOURS]: stored(2, 2) } },
    })

    const result = await h.service.replace('i1', [entry(HOURS, 2, 2)])

    expect(result.map((m) => m.metricTypeId)).toEqual([HOURS])
  })

  it('clears every active value when the body is empty', async () => {
    const h = harness(orgAdmin(ORG_A), {
      stored: { i1: { [SAVINGS]: stored(1, 1), [HOURS]: stored(2, 2) } },
    })

    expect(await h.service.replace('i1', [])).toEqual([])
  })

  it('clears a type whose entry has both numbers null', async () => {
    const h = harness(orgAdmin(ORG_A), {
      stored: { i1: { [SAVINGS]: stored(1, 1), [HOURS]: stored(2, 2) } },
    })

    const result = await h.service.replace('i1', [entry(SAVINGS, null, null), entry(HOURS, 2, 2)])

    expect(result.map((m) => m.metricTypeId)).toEqual([HOURS])
  })

  it('does not store an entry with both numbers null on a type that had no value', async () => {
    const h = harness(orgAdmin(ORG_A))

    expect(await h.service.replace('i1', [entry(SAVINGS, null, null)])).toEqual([])
    expect(h.log).toEqual([])
  })

  it('keeps one number when only the other changes, including setting it back to null', async () => {
    const h = harness(orgAdmin(ORG_A), { stored: { i1: { [SAVINGS]: stored(10, 5) } } })

    const result = await h.service.replace('i1', [entry(SAVINGS, 10, null)])

    expect(result[0]).toMatchObject({ projected: 10, realized: null })
  })

  it('stores 0 as a value, not as a clear', async () => {
    const result = await harness(orgAdmin(ORG_A)).service.replace('i1', [entry(SAVINGS, 0, 0)])

    expect(result[0]).toMatchObject({ projected: 0, realized: 0 })
  })

  it('leaves a value on an archived type untouched and returns it flagged', async () => {
    const h = harness(orgAdmin(ORG_A), {
      stored: { i1: { [SAVINGS]: stored(1, 1), [OLD]: stored(9, 8) } },
    })

    const afterReplace = await h.service.replace('i1', [])

    expect(afterReplace).toEqual([
      { metricTypeId: OLD, name: 'old', unit: null, isArchived: true, projected: 9, realized: 8 },
    ])
    expect(h.applied[0]?.cleared).toEqual([SAVINGS])
  })

  it('never writes to an archived type: it is neither upserted nor cleared', async () => {
    const h = harness(orgAdmin(ORG_A), { stored: { i1: { [OLD]: stored(9, 8) } } })

    await h.service.replace('i1', [entry(SAVINGS, 1)])

    expect(JSON.stringify(h.applied)).not.toContain(OLD)
  })

  it('sends only the changed entries as upserts, and only the vanished types as clears', async () => {
    const h = harness(orgAdmin(ORG_A), {
      stored: { i1: { [SAVINGS]: stored(1, 1), [HOURS]: stored(2, 2) } },
    })
    await h.service.replace('i1', [entry(SAVINGS, 1, 1), entry(HOURS, 3, 2)])

    expect(h.applied).toEqual([
      { upserts: [{ metricTypeId: HOURS, projected: 3, realized: 2 }], cleared: [] },
    ])
  })

  it('does not touch the values of another item', async () => {
    const h = harness(orgAdmin(ORG_A), {
      ideas: [idea('i1'), idea('i2')],
      stored: { i2: { [SAVINGS]: stored(77, 77) } },
    })

    await h.service.replace('i1', [entry(SAVINGS, 1)])

    expect(await h.service.get('i2')).toHaveLength(1)
  })
})

describe('PUT /ideas/{id}/metrics: no-op', () => {
  it('writes, commits and audits nothing when the body matches what is stored', async () => {
    const h = harness(orgAdmin(ORG_A), {
      stored: { i1: { [SAVINGS]: stored(1, 2), [OLD]: stored(9, 9) } },
    })

    const result = await h.service.replace('i1', [entry(SAVINGS, 1, 2)])

    expect(h.log).toEqual([])
    expect(h.events).toEqual([])
    expect(result.map((m) => m.metricTypeId)).toEqual([SAVINGS, OLD])
  })

  it('is a no-op for an empty body on an item with only archived values', async () => {
    const h = harness(orgAdmin(ORG_A), { stored: { i1: { [OLD]: stored(9, 9) } } })

    await h.service.replace('i1', [])

    expect(h.log).toEqual([])
  })

  it('is a no-op for an empty body on an item with no values', async () => {
    const h = harness(orgAdmin(ORG_A))

    expect(await h.service.replace('i1', [])).toEqual([])
    expect(h.log).toEqual([])
  })
})

describe('PUT /ideas/{id}/metrics: audit', () => {
  it('writes one IdeaMetricsChanged event after the commit with before and after', async () => {
    const h = harness(orgAdmin(ORG_A, 'admin-7'), {
      stored: { i1: { [SAVINGS]: stored(1, 1), [HOURS]: stored(2, null) } },
    })

    await h.service.replace('i1', [entry(SAVINGS, 5, 1)])

    expect(h.log).toEqual(['apply', 'commit', 'audit'])
    expect(h.events).toHaveLength(1)
    expect(h.events[0]).toMatchObject({
      eventType: 'IdeaMetricsChanged',
      entityType: 'Idea',
      entityId: 'i1',
      organizationId: ORG_A,
      occurredAtUtc: NOW,
      attribution: { actorUserId: 'admin-7' },
    })
    expect(JSON.parse(h.events[0]?.metadataJson ?? '{}')).toEqual({
      ideaId: 'i1',
      before: [
        { metricTypeId: SAVINGS, name: 'savings', projected: 1, realized: 1 },
        { metricTypeId: HOURS, name: 'hours', projected: 2, realized: null },
      ],
      after: [{ metricTypeId: SAVINGS, name: 'savings', projected: 5, realized: 1 }],
    })
  })

  it('records an empty before for the first values and leaves archived values out of both sides', async () => {
    const h = harness(orgAdmin(ORG_A), { stored: { i1: { [OLD]: stored(9, 9) } } })

    await h.service.replace('i1', [entry(SAVINGS, 1)])

    const metadata = JSON.parse(h.events[0]?.metadataJson ?? '{}')
    expect(metadata.before).toEqual([])
    expect(metadata.after.map((m: { metricTypeId: string }) => m.metricTypeId)).toEqual([SAVINGS])
  })

  it('is attributed to the real administrator under View As', async () => {
    const h = harness(
      impersonating({
        targetUserId: 'org-admin-1',
        targetRole: Role.OrgAdmin,
        targetOrganizationId: ORG_A,
        realUserId: 'site-admin-9',
      }),
    )

    await h.service.replace('i1', [entry(SAVINGS, 1)])

    expect(h.events[0]?.attribution).toMatchObject({ actorUserId: 'site-admin-9' })
  })

  it('writes no audit event when the replacement is refused', async () => {
    const h = harness(orgAdmin(ORG_A))

    await failure(h.service.replace('i1', [entry('unknown', 1)]))

    expect(h.events).toEqual([])
  })
})
