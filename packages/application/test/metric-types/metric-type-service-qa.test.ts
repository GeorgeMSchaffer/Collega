// QA for metric types (SPEC/contracts/metric-types.md, "Metric Type Contracts"): the role matrix on
// every type route, validation and trimming, the no-op update, archive and restore, and the audit
// trail, driven through MetricTypeService over a stateful in-memory repository.

import { Role } from '@collega/domain/enums'
import { createMetricType, type MetricType } from '@collega/domain/metric-types'
import { describe, expect, it } from 'vitest'
import type { CurrentUserContext } from '../../src/common/index.js'
import {
  type AuditEventInput,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../src/common/index.js'
import { MetricTypeService } from '../../src/metric-types/metric-type.service.js'
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

const T1 = new Date('2026-10-01T00:00:00.000Z')
const T2 = new Date('2026-10-02T00:00:00.000Z')

function type(id: string, overrides: Partial<MetricType> = {}): MetricType {
  return {
    ...createMetricType({
      id,
      organizationId: ORG_A,
      name: `Type ${id}`,
      unit: '$',
      nowUtc: T1,
      actorUserId: 'seed',
    }),
    ...overrides,
  }
}

function harness(currentUser: CurrentUserContext, seed: readonly MetricType[] = []) {
  const store = new Map(seed.map((t) => [t.id, t]))
  // One ordered log, so "audit after commit" is observable.
  const log: string[] = []
  const events: AuditEventInput[] = []
  let saves = 0
  const service = new MetricTypeService(
    {
      async getById(id) {
        return store.get(id) ?? null
      },
      async listByOrganization(organizationId, includeArchived) {
        return [...store.values()]
          .filter((t) => t.organizationId === organizationId && (includeArchived || !t.isArchived))
          .sort(
            (a, b) =>
              a.createdAtUtc.getTime() - b.createdAtUtc.getTime() || a.id.localeCompare(b.id),
          )
      },
      async add(t) {
        log.push('add')
        store.set(t.id, t)
      },
      async save(t) {
        log.push('save')
        store.set(t.id, t)
      },
    },
    {
      async saveChanges() {
        saves++
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
  )
  return { service, store, log, events, saves: () => saves }
}

const CREATE = { name: 'Annual savings', unit: '$' }
const UPDATE = { name: 'Annual savings', unit: '$', isArchived: false }

async function failure(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('expected a refusal')
    },
    (error: unknown) => error,
  )
}

describe('metric type routes: the role matrix', () => {
  const asViewAs = (role: Role) =>
    impersonating({ targetUserId: 'target-1', targetRole: role, targetOrganizationId: ORG_A })

  const writes = [
    ['create', (h: ReturnType<typeof harness>) => h.service.create(ORG_A, CREATE)],
    ['update', (h: ReturnType<typeof harness>) => h.service.update(ORG_A, 'mt-1', UPDATE)],
  ] as const

  it.each(writes)('%s: an Org Admin may, and View As an Org Admin may', async (_name, call) => {
    for (const ctx of [orgAdmin(ORG_A), asViewAs(Role.OrgAdmin)]) {
      await expect(call(harness(ctx, [type('mt-1')]))).resolves.toBeDefined()
    }
  })

  it.each(writes)(
    '%s: a User and a Read Only user get 403 and nothing is saved',
    async (_name, call) => {
      for (const ctx of [
        member(ORG_A),
        readOnly(ORG_A),
        asViewAs(Role.User),
        asViewAs(Role.ReadOnly),
      ]) {
        const h = harness(ctx, [type('mt-1')])

        expect(await failure(call(h))).toBeInstanceOf(ForbiddenError)
        expect(h.log).toEqual([])
        expect(h.events).toEqual([])
      }
    },
  )

  it.each(writes)('%s: a direct Site Admin gets 403', async (_name, call) => {
    expect(await failure(call(harness(siteAdmin(), [type('mt-1')])))).toBeInstanceOf(ForbiddenError)
  })

  it.each(writes)('%s: an anonymous caller gets 401', async (_name, call) => {
    expect(await failure(call(harness(anonymous, [type('mt-1')])))).toBeInstanceOf(
      UnauthorizedError,
    )
  })

  it.each(writes)('%s: an Org Admin of another organization gets 404', async (_name, call) => {
    const h = harness(orgAdmin(ORG_B), [type('mt-1')])

    expect(await failure(call(h))).toBeInstanceOf(NotFoundError)
    expect(h.log).toEqual([])
  })

  it.each([
    ['an Org Admin', orgAdmin(ORG_A)],
    ['a User', member(ORG_A)],
    ['a Read Only user', readOnly(ORG_A)],
    ['View As a Read Only user', asViewAs(Role.ReadOnly)],
  ])('list: %s may read', async (_label, ctx) => {
    const { service } = harness(ctx, [type('mt-1')])

    expect(await service.list(ORG_A, false)).toHaveLength(1)
  })

  it('list: a direct Site Admin gets 403, reads included', async () => {
    const { service } = harness(siteAdmin(), [type('mt-1')])

    expect(await failure(service.list(ORG_A, false))).toBeInstanceOf(ForbiddenError)
  })

  it('list: an anonymous caller gets 401 and another organization gets 404', async () => {
    expect(await failure(harness(anonymous).service.list(ORG_A, false))).toBeInstanceOf(
      UnauthorizedError,
    )
    expect(await failure(harness(member(ORG_B)).service.list(ORG_A, false))).toBeInstanceOf(
      NotFoundError,
    )
  })
})

describe('MetricTypeService.list', () => {
  it('hides archived types by default and returns them when asked', async () => {
    const { service } = harness(member(ORG_A), [
      type('a', { createdAtUtc: T1 }),
      type('b', { isArchived: true, createdAtUtc: T2 }),
    ])

    expect((await service.list(ORG_A, false)).map((t) => t.metricTypeId)).toEqual(['a'])
    expect((await service.list(ORG_A, true)).map((t) => t.metricTypeId)).toEqual(['a', 'b'])
  })

  it('returns the contract item fields and never another organizations types', async () => {
    const { service } = harness(member(ORG_A), [
      type('a', { name: 'Hours saved', unit: null }),
      type('x', { organizationId: ORG_B }),
    ])

    expect(await service.list(ORG_A, true)).toEqual([
      {
        metricTypeId: 'a',
        organizationId: ORG_A,
        name: 'Hours saved',
        unit: null,
        isArchived: false,
        createdAt: T1,
        updatedAt: T1,
      },
    ])
  })

  it('returns an empty list for an organization with no types', async () => {
    expect(await harness(member(ORG_A)).service.list(ORG_A, true)).toEqual([])
  })
})

describe('MetricTypeService.create', () => {
  it('stores a trimmed name and a blank unit as null, and returns an active item', async () => {
    const h = harness(orgAdmin(ORG_A))

    const created = await h.service.create(ORG_A, { name: '  Hours saved  ', unit: '   ' })

    expect(created).toMatchObject({
      organizationId: ORG_A,
      name: 'Hours saved',
      unit: null,
      isArchived: false,
      createdAt: NOW,
      updatedAt: NOW,
    })
    expect(h.store.get(created.metricTypeId)).toMatchObject({ name: 'Hours saved', unit: null })
  })

  it('allows a second type with the same name', async () => {
    const h = harness(orgAdmin(ORG_A), [type('a', { name: 'Savings' })])

    const created = await h.service.create(ORG_A, { name: 'Savings', unit: '$' })

    expect(created.metricTypeId).not.toBe('a')
    expect(h.store.size).toBe(2)
  })

  it.each([
    ['a blank name', { name: '   ', unit: null }, { name: ['Name is required.'] }],
    [
      'an 81-character name',
      { name: 'n'.repeat(81), unit: null },
      { name: ['Name must be 80 characters or fewer.'] },
    ],
    [
      'a 21-character unit',
      { name: 'x', unit: 'u'.repeat(21) },
      { unit: ['Unit must be 20 characters or fewer.'] },
    ],
  ])(
    'refuses %s with a 400 keyed by the field, saving nothing',
    async (_label, command, failures) => {
      const h = harness(orgAdmin(ORG_A))

      const error = await failure(h.service.create(ORG_A, command))

      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).failures).toEqual(failures)
      expect(h.log).toEqual([])
    },
  )

  it('accepts an 80-character name and a 20-character unit', async () => {
    const created = await harness(orgAdmin(ORG_A)).service.create(ORG_A, {
      name: 'n'.repeat(80),
      unit: 'u'.repeat(20),
    })

    expect(created.name).toHaveLength(80)
    expect(created.unit).toHaveLength(20)
  })

  it('audits MetricTypeCreated once, after the commit, in the organization', async () => {
    const h = harness(orgAdmin(ORG_A, 'admin-7'))

    const created = await h.service.create(ORG_A, CREATE)

    expect(h.log).toEqual(['add', 'commit', 'audit'])
    expect(h.events).toHaveLength(1)
    expect(h.events[0]).toMatchObject({
      eventType: 'MetricTypeCreated',
      entityType: 'MetricType',
      entityId: created.metricTypeId,
      organizationId: ORG_A,
      occurredAtUtc: NOW,
      attribution: { actorUserId: 'admin-7' },
    })
  })

  it('audits a View As create under the real administrator', async () => {
    const h = harness(
      impersonating({
        targetUserId: 'target-1',
        targetRole: Role.OrgAdmin,
        targetOrganizationId: ORG_A,
        realUserId: 'site-admin-9',
      }),
    )

    await h.service.create(ORG_A, CREATE)

    expect(h.events[0]?.attribution).toMatchObject({
      actorUserId: 'site-admin-9',
      onBehalfOfUserId: 'target-1',
    })
  })
})

describe('MetricTypeService.update', () => {
  it('renames and changes the unit, auditing MetricTypeUpdated with the changed fields', async () => {
    const h = harness(orgAdmin(ORG_A), [type('mt-1', { name: 'Old', unit: '$' })])

    const updated = await h.service.update(ORG_A, 'mt-1', {
      name: ' New ',
      unit: 'hours',
      isArchived: false,
    })

    expect(updated).toMatchObject({ name: 'New', unit: 'hours', isArchived: false, updatedAt: NOW })
    expect(h.log).toEqual(['save', 'commit', 'audit'])
    expect(h.events).toHaveLength(1)
    expect(h.events[0]).toMatchObject({
      eventType: 'MetricTypeUpdated',
      entityType: 'MetricType',
      entityId: 'mt-1',
      organizationId: ORG_A,
    })
    expect(JSON.parse(h.events[0]?.metadataJson ?? '{}')).toEqual({
      changes: { name: { from: 'Old', to: 'New' }, unit: { from: '$', to: 'hours' } },
    })
  })

  it('clears the unit when a blank one is sent', async () => {
    const h = harness(orgAdmin(ORG_A), [type('mt-1', { unit: '$' })])

    expect(
      (await h.service.update(ORG_A, 'mt-1', { ...UPDATE, name: 'Type mt-1', unit: ' ' })).unit,
    ).toBeNull()
  })

  it('audits MetricTypeArchived when isArchived turns true, and keeps the type', async () => {
    const h = harness(orgAdmin(ORG_A), [type('mt-1', { name: 'Same' })])

    const updated = await h.service.update(ORG_A, 'mt-1', {
      name: 'Same',
      unit: '$',
      isArchived: true,
    })

    expect(updated.isArchived).toBe(true)
    expect(h.store.get('mt-1')?.isArchived).toBe(true)
    expect(h.events.map((e) => e.eventType)).toEqual(['MetricTypeArchived'])
  })

  it('audits MetricTypeRestored when isArchived turns false', async () => {
    const h = harness(orgAdmin(ORG_A), [type('mt-1', { name: 'Same', isArchived: true })])

    const updated = await h.service.update(ORG_A, 'mt-1', {
      name: 'Same',
      unit: '$',
      isArchived: false,
    })

    expect(updated.isArchived).toBe(false)
    expect(h.events.map((e) => e.eventType)).toEqual(['MetricTypeRestored'])
  })

  it('audits one Archived event, not an Updated one, when a rename comes with the archive', async () => {
    const h = harness(orgAdmin(ORG_A), [type('mt-1', { name: 'Old' })])

    await h.service.update(ORG_A, 'mt-1', { name: 'New', unit: '$', isArchived: true })

    expect(h.events.map((e) => e.eventType)).toEqual(['MetricTypeArchived'])
  })

  it('is a no-op saving the same values: no save, no commit, no audit, same updatedAt', async () => {
    const h = harness(orgAdmin(ORG_A), [type('mt-1', { name: 'Same', unit: '$' })])

    const result = await h.service.update(ORG_A, 'mt-1', {
      name: 'Same',
      unit: '$',
      isArchived: false,
    })

    expect(result.updatedAt).toEqual(T1)
    expect(h.log).toEqual([])
    expect(h.events).toEqual([])
  })

  it('treats a name that only differs by padding, and a blank unit over a null one, as no change', async () => {
    const h = harness(orgAdmin(ORG_A), [type('mt-1', { name: 'Same', unit: null })])

    await h.service.update(ORG_A, 'mt-1', { name: '  Same  ', unit: '  ', isArchived: false })

    expect(h.log).toEqual([])
    expect(h.events).toEqual([])
  })

  it('answers 404 for a missing type and for a type of another organization, saving nothing', async () => {
    const h = harness(orgAdmin(ORG_A), [type('foreign', { organizationId: ORG_B })])

    expect(await failure(h.service.update(ORG_A, 'nope', UPDATE))).toBeInstanceOf(NotFoundError)
    expect(await failure(h.service.update(ORG_A, 'foreign', UPDATE))).toBeInstanceOf(NotFoundError)
    expect(h.log).toEqual([])
    expect(h.store.get('foreign')?.name).toBe('Type foreign')
  })

  it.each([
    ['a blank name', { ...UPDATE, name: ' ' }, { name: ['Name is required.'] }],
    [
      'an 81-character name',
      { ...UPDATE, name: 'n'.repeat(81) },
      { name: ['Name must be 80 characters or fewer.'] },
    ],
    [
      'a 21-character unit',
      { ...UPDATE, unit: 'u'.repeat(21) },
      { unit: ['Unit must be 20 characters or fewer.'] },
    ],
  ])(
    'refuses %s with a 400 keyed by the field, leaving the type alone',
    async (_label, command, failures) => {
      const h = harness(orgAdmin(ORG_A), [type('mt-1')])

      const error = await failure(h.service.update(ORG_A, 'mt-1', command))

      expect((error as ValidationError).failures).toEqual(failures)
      expect(h.log).toEqual([])
    },
  )

  it('checks the type exists (404) before validating the body (400)', async () => {
    const h = harness(orgAdmin(ORG_A))

    expect(await failure(h.service.update(ORG_A, 'nope', { ...UPDATE, name: '' }))).toBeInstanceOf(
      NotFoundError,
    )
  })
})
