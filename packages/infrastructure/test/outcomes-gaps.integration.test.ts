// Live-database QA for the Outcome rules the other two Outcome suites leave open
// (SPEC/contracts/outcomes.md, SPEC/contracts/metric-types.md "Outcome totals"): the per-idea
// `metrics` on detail, roadmap and ungrouped reads, metric totals that skip nulls and never count
// deleted items or archived types, the stored total order, and owner validation against the real
// user repository.
//
// Skipped unless `DATABASE_URL` is set. It builds its own organizations and removes them afterwards.

import { randomUUID } from 'node:crypto'
import type { AuditEventInput, CurrentUserContext } from '@collega/application/common'
import { OutcomeService } from '@collega/application/outcomes'
import { Role } from '@collega/domain/enums'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaUnitOfWork } from '../src/persistence/unit-of-work.js'
import { PrismaBoardRepository } from '../src/repositories/board.repository.js'
import { PrismaIdeaRepository } from '../src/repositories/idea.repository.js'
import { PrismaOutcomeRepository } from '../src/repositories/outcome.repository.js'
import { PrismaUserRepository } from '../src/repositories/user.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const T0 = new Date('2026-10-15T09:00:00.000Z')
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000)
const NOW = new Date('2026-10-16T09:00:00.000Z')
const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'

describe.skipIf(!DATABASE_URL)('Outcome gaps against a live database', () => {
  const prisma = new PrismaClient()
  const marker = randomUUID()
  const orgId = randomUUID()
  const otherOrgId = randomUUID()
  const adminId = randomUUID()
  const inactiveId = randomUUID()
  const foreignUserId = randomUUID()
  const statusId = randomUUID()
  const ideaTypeId = randomUUID()
  const impactId = randomUUID()
  // Created in this order: Alpha first, then Beta, then Archived.
  const [alpha, beta, archived] = [randomUUID(), randomUUID(), randomUUID()] as const
  const ids = {
    outcomeOne: randomUUID(),
    outcomeTwo: randomUUID(),
    outcomeNulls: randomUUID(),
    withValues: randomUUID(),
    noValues: randomUUID(),
    onlyArchived: randomUUID(),
    twoValues: randomUUID(),
    deletedWithValue: randomUUID(),
    task: randomUUID(),
    nullsIdea: randomUUID(),
    freeWithValue: randomUUID(),
    freeArchivedOnly: randomUUID(),
    freeNone: randomUUID(),
  }
  const stamps = { created_at_utc: T0, updated_at_utc: T0 }
  const events: AuditEventInput[] = []

  const repo = () => new PrismaOutcomeRepository(prisma, new PrismaUnitOfWork(prisma))

  function admin(): CurrentUserContext {
    return {
      isAuthenticated: true,
      userId: adminId,
      organizationId: orgId,
      role: Role.OrgAdmin,
      isImpersonating: false,
      realUserId: adminId,
    }
  }

  function service() {
    const unitOfWork = new PrismaUnitOfWork(prisma)
    const outcomes = new PrismaOutcomeRepository(prisma, unitOfWork)
    return new OutcomeService(
      outcomes,
      outcomes,
      new PrismaIdeaRepository(prisma, unitOfWork),
      new PrismaUserRepository(prisma, unitOfWork),
      unitOfWork,
      {
        write: async (event: AuditEventInput) => {
          events.push(event)
        },
      },
      admin(),
      { now: () => NOW },
      { nextInt: () => 0 },
      new PrismaBoardRepository(prisma, unitOfWork),
    )
  }

  async function newIdea(
    id: string,
    title: string,
    extra: {
      outcome?: string
      parent?: string
      deleted?: boolean
      createdAt?: Date
      org?: string
    } = {},
  ): Promise<void> {
    await prisma.ideas.create({
      data: {
        id,
        organization_id: extra.org ?? orgId,
        board_id: null,
        status_id: statusId,
        parent_idea_id: extra.parent ?? null,
        outcome_id: extra.outcome ?? null,
        title,
        problem: 'Probe problem.',
        proposed_solutions: ['Probe solution.'],
        impact_rationale: 'Probe rationale.',
        priority: 'Medium',
        idea_type_id: ideaTypeId,
        business_impact_id: impactId,
        author_user_id: adminId,
        is_deleted: extra.deleted ?? false,
        phase: 'Discovery',
        created_at_utc: extra.createdAt ?? T0,
        updated_at_utc: T0,
      },
    })
  }

  const value = (
    ideaId: string,
    typeId: string,
    projected: string | null,
    realized: string | null,
  ) =>
    prisma.idea_metric_values.create({
      data: { idea_id: ideaId, metric_type_id: typeId, projected, realized },
    })

  async function newOutcome(
    id: string,
    name: string,
    sortOrder: number,
    createdAt: Date = T0,
    org: string = orgId,
  ): Promise<void> {
    await prisma.outcomes.create({
      data: {
        id,
        organization_id: org,
        name,
        target_start_date: new Date('2026-10-01T00:00:00.000Z'),
        target_end_date: new Date('2026-12-31T00:00:00.000Z'),
        sort_order: sortOrder,
        color: '#112233',
        is_deleted: false,
        created_at_utc: createdAt,
        updated_at_utc: T0,
      },
    })
  }

  beforeAll(async () => {
    for (const [id, label] of [
      [orgId, 'main'],
      [otherOrgId, 'other'],
    ] as const) {
      await prisma.organizations.create({
        data: {
          id,
          title: `probe-org-gaps-${label}-${marker}`,
          description: 'Outcome gaps probe.',
          invite_code: `gaps-${label}-${marker}`,
          is_archived: false,
          ...stamps,
        },
      })
    }
    const user = (
      id: string,
      org: string,
      status: 'Active' | 'Inactive',
      role: 'OrgAdmin' | 'User',
    ) =>
      prisma.users.create({
        data: {
          id,
          organization_id: org,
          first_name: 'Probe',
          last_name: status,
          email: `probe-${id}@example.test`,
          normalized_email: `PROBE-${id}@EXAMPLE.TEST`.toUpperCase(),
          password_hash: 'not-a-real-hash',
          role,
          status,
          must_change_password: false,
          failed_login_count: 0,
          security_stamp: marker,
          ...stamps,
        },
      })
    await user(adminId, orgId, 'Active', 'OrgAdmin')
    await user(inactiveId, orgId, 'Inactive', 'User')
    await user(foreignUserId, otherOrgId, 'Active', 'User')

    await prisma.statuses.create({
      data: {
        id: statusId,
        organization_id: orgId,
        name: 'Open',
        color: '#123456',
        sort_order: 0,
        is_deleted: false,
        ...stamps,
      },
    })
    await prisma.idea_types.create({
      data: {
        id: ideaTypeId,
        organization_id: orgId,
        name: 'Probe type',
        sort_order: 0,
        is_deleted: false,
        ...stamps,
      },
    })
    await prisma.business_impacts.create({
      data: {
        id: impactId,
        organization_id: orgId,
        name: 'Probe impact',
        color: '#123456',
        sort_order: 0,
        is_deleted: false,
        ...stamps,
      },
    })
    // Inserted newest first so the types' order is the creation time, not the insert order.
    for (const [id, name, unit, isArchived, seconds] of [
      [archived, 'Archived', null, true, 20],
      [beta, 'Beta', 'h', false, 10],
      [alpha, 'Alpha', '$', false, 0],
    ] as const) {
      await prisma.metric_types.create({
        data: {
          metric_type_id: id,
          organization_id: orgId,
          name,
          unit,
          is_archived: isArchived,
          created_at_utc: at(seconds),
          updated_at_utc: T0,
        },
      })
    }

    await newOutcome(ids.outcomeOne, 'One', 0)
    await newOutcome(ids.outcomeTwo, 'Two', 1)
    await newOutcome(ids.outcomeNulls, 'Nulls', 2)

    // Outcome One.
    await newIdea(ids.withValues, 'With values', { outcome: ids.outcomeOne, createdAt: at(1) })
    await newIdea(ids.noValues, 'No values', { outcome: ids.outcomeOne, createdAt: at(2) })
    await newIdea(ids.onlyArchived, 'Only archived', { outcome: ids.outcomeOne, createdAt: at(3) })
    await newIdea(ids.twoValues, 'Two values', { outcome: ids.outcomeOne, createdAt: at(4) })
    await newIdea(ids.deletedWithValue, 'Deleted', {
      outcome: ids.outcomeOne,
      deleted: true,
      createdAt: at(5),
    })
    await newIdea(ids.task, 'Task', { parent: ids.withValues, createdAt: at(6) })
    // Beta first, Alpha second: the read must answer Alpha, Beta (creation order of the types).
    await value(ids.withValues, beta, '2.50', null)
    await value(ids.withValues, alpha, null, '1.25')
    await value(ids.withValues, archived, '9.00', '9.00')
    await value(ids.onlyArchived, archived, '4.00', '4.00')
    await value(ids.twoValues, alpha, '1.10', '0.10')
    await value(ids.twoValues, beta, '3.00', '3.00')
    await value(ids.deletedWithValue, alpha, '1000.00', '1000.00')
    await value(ids.task, alpha, '500.00', '500.00')

    // Outcome Two: only Alpha, to show the totals do not leak between Outcomes.
    await newIdea(ids.nullsIdea, 'Null values', { outcome: ids.outcomeNulls, createdAt: at(1) })
    await value(ids.nullsIdea, alpha, null, null)
    await value(ids.nullsIdea, beta, '7.00', null)

    // Ungrouped reads.
    await newIdea(ids.freeWithValue, 'Free with value', { createdAt: at(1) })
    await newIdea(ids.freeArchivedOnly, 'Free archived only', { createdAt: at(2) })
    await newIdea(ids.freeNone, 'Free none', { createdAt: at(3) })
    await value(ids.freeWithValue, beta, '8.00', '0.50')
    await value(ids.freeArchivedOnly, archived, '1.00', '1.00')
  })

  afterAll(async () => {
    const mine = { organization_id: { in: [orgId, otherOrgId] } }
    await prisma.idea_metric_values.deleteMany({ where: { ideas: mine } })
    await prisma.ideas.deleteMany({ where: { ...mine, parent_idea_id: { not: null } } })
    await prisma.ideas.deleteMany({ where: mine })
    await prisma.outcomes.deleteMany({ where: mine })
    await prisma.metric_types.deleteMany({ where: mine })
    await prisma.idea_types.deleteMany({ where: mine })
    await prisma.business_impacts.deleteMany({ where: mine })
    await prisma.statuses.deleteMany({ where: mine })
    await prisma.users.deleteMany({ where: mine })
    await prisma.organizations.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } })
    await prisma.$disconnect()
  })

  describe('per-idea metrics', () => {
    it('carries stored values over active types in the types order, nulls kept, archived left out', async () => {
      const grouped = await repo().ideasByOutcomeIds([ids.outcomeOne])
      const byId = new Map(grouped.get(ids.outcomeOne)?.map((i) => [i.ideaId, i]))

      expect(byId.get(ids.withValues)?.metrics).toEqual([
        { metricTypeId: alpha, projected: null, realized: 1.25 },
        { metricTypeId: beta, projected: 2.5, realized: null },
      ])
      expect(byId.get(ids.twoValues)?.metrics).toEqual([
        { metricTypeId: alpha, projected: 1.1, realized: 0.1 },
        { metricTypeId: beta, projected: 3, realized: 3 },
      ])
    })

    it('is an empty list for an item with no values or only archived ones', async () => {
      const grouped = await repo().ideasByOutcomeIds([ids.outcomeOne])
      const byId = new Map(grouped.get(ids.outcomeOne)?.map((i) => [i.ideaId, i]))

      expect(byId.get(ids.noValues)?.metrics).toEqual([])
      expect(byId.get(ids.onlyArchived)?.metrics).toEqual([])
    })

    it('lists grouped items without the deleted item and without the task', async () => {
      const grouped = await repo().ideasByOutcomeIds([ids.outcomeOne])

      expect(grouped.get(ids.outcomeOne)?.map((i) => i.ideaId)).toEqual([
        ids.withValues,
        ids.noValues,
        ids.onlyArchived,
        ids.twoValues,
      ])
    })

    it('puts the same field on the ungrouped list', async () => {
      const ungrouped = await repo().listUngroupedIdeas(orgId)
      const byId = new Map(ungrouped.map((i) => [i.ideaId, i]))

      expect(ungrouped.map((i) => i.ideaId)).toEqual([
        ids.freeWithValue,
        ids.freeArchivedOnly,
        ids.freeNone,
      ])
      expect(byId.get(ids.freeWithValue)?.metrics).toEqual([
        { metricTypeId: beta, projected: 8, realized: 0.5 },
      ])
      expect(byId.get(ids.freeArchivedOnly)?.metrics).toEqual([])
      expect(byId.get(ids.freeNone)?.metrics).toEqual([])
    })

    it('returns the same field through the service on detail and roadmap', async () => {
      const s = service()

      const detail = await s.get(orgId, ids.outcomeOne)
      const roadmap = await s.roadmap(orgId)

      const first = detail.ideas.find((i) => i.ideaId === ids.withValues)
      expect(first?.metrics).toHaveLength(2)
      expect(roadmap.outcomes.find((o) => o.outcomeId === ids.outcomeOne)?.ideas).toEqual(
        detail.ideas,
      )
      expect(roadmap.ungrouped.find((i) => i.ideaId === ids.freeWithValue)?.metrics).toHaveLength(1)
    })
  })

  describe('metric totals', () => {
    it('sum active types over live top-level items, skipping nulls, in the types order', async () => {
      const rollups = await repo().rollupsByOutcomeIds([ids.outcomeOne])

      expect(rollups.get(ids.outcomeOne)?.metricTotals).toEqual([
        // 1.25 + 0.10 realized, projected 1.10 only: the null projected on one item is skipped.
        { metricTypeId: alpha, name: 'Alpha', unit: '$', projected: 1.1, realized: 1.35 },
        // 2.50 + 3.00 projected, realized 3.00 only. Deleted item and task contribute nothing.
        { metricTypeId: beta, name: 'Beta', unit: 'h', projected: 5.5, realized: 3 },
      ])
    })

    it('leave out an archived type even when values exist on it', async () => {
      const rollups = await repo().rollupsByOutcomeIds([ids.outcomeOne])

      expect(rollups.get(ids.outcomeOne)?.metricTotals.map((t) => t.metricTypeId)).not.toContain(
        archived,
      )
    })

    it('are null, not zero, for a sum with no non-null number, and do not leak between Outcomes', async () => {
      const rollups = await repo().rollupsByOutcomeIds([ids.outcomeOne, ids.outcomeNulls])

      expect(rollups.get(ids.outcomeNulls)?.metricTotals).toEqual([
        { metricTypeId: alpha, name: 'Alpha', unit: '$', projected: null, realized: null },
        { metricTypeId: beta, name: 'Beta', unit: 'h', projected: 7, realized: null },
      ])
      expect(rollups.get(ids.outcomeOne)?.metricTotals).toHaveLength(2)
    })

    it('are an empty list for an Outcome with no items', async () => {
      const empty = randomUUID()
      await newOutcome(empty, 'Empty', 9)

      const rollups = await repo().rollupsByOutcomeIds([empty])

      expect(rollups.get(empty)?.metricTotals).toEqual([])
    })

    it('leave out a value left on a card that has a parent, even one still grouped under the Outcome', async () => {
      const [outcome, top, card] = [randomUUID(), randomUUID(), randomUUID()]
      await newOutcome(outcome, 'Reparented', 8)
      await newIdea(top, 'Top', { outcome })
      await newIdea(card, 'Card', { outcome, parent: top })
      await value(top, alpha, '1.00', '1.00')
      await value(card, alpha, '600.00', '600.00')

      const rollups = await repo().rollupsByOutcomeIds([outcome])

      expect(rollups.get(outcome)?.metricTotals).toEqual([
        { metricTypeId: alpha, name: 'Alpha', unit: '$', projected: 1, realized: 1 },
      ])
    })

    it('stop counting an item once it is soft-deleted', async () => {
      const probe = randomUUID()
      await newIdea(probe, 'Probe', { outcome: ids.outcomeNulls })
      await value(probe, alpha, '2.00', '2.00')
      const before = await repo().rollupsByOutcomeIds([ids.outcomeNulls])
      expect(before.get(ids.outcomeNulls)?.metricTotals[0]).toMatchObject({
        projected: 2,
        realized: 2,
      })

      await prisma.ideas.update({ where: { id: probe }, data: { is_deleted: true } })
      const after = await repo().rollupsByOutcomeIds([ids.outcomeNulls])

      expect(after.get(ids.outcomeNulls)?.metricTotals[0]).toMatchObject({
        projected: null,
        realized: null,
      })
    })
  })

  describe('stored total order', () => {
    it('breaks sortOrder ties by creation time, then name', async () => {
      const [late, earlyB, earlyA] = [randomUUID(), randomUUID(), randomUUID()]
      await newOutcome(late, 'A late', 50, at(300))
      await newOutcome(earlyB, 'B early', 50, at(200))
      await newOutcome(earlyA, 'A early', 50, at(200))
      await newOutcome(randomUUID(), 'Elsewhere', 50, at(100), otherOrgId)

      const listed = (await repo().listByOrganization(orgId)).filter((o) => o.sortOrder === 50)

      expect(listed.map((o) => o.id)).toEqual([earlyA, earlyB, late])
    })

    it('lists lower sortOrder first whatever the creation time', async () => {
      const listed = await repo().listByOrganization(orgId)

      expect(listed.slice(0, 3).map((o) => o.id)).toEqual([
        ids.outcomeOne,
        ids.outcomeTwo,
        ids.outcomeNulls,
      ])
    })

    it('pages a tied list without a repeat or a gap', async () => {
      const s = service()

      const first = await s.list(orgId, { page: 1, pageSize: 3 })
      const second = await s.list(orgId, { page: 2, pageSize: 3 })

      const seen = [...first.items, ...second.items].map((o) => o.outcomeId)
      expect(new Set(seen).size).toBe(seen.length)
      expect(first.totalCount).toBeGreaterThan(3)
      expect(first.sortBy).toBe('sortOrder')
    })

    it('lists grouped items oldest first, then by title', async () => {
      const [b, a] = [randomUUID(), randomUUID()]
      await newIdea(b, 'Tie B', { outcome: ids.outcomeTwo, createdAt: at(40) })
      await newIdea(a, 'Tie A', { outcome: ids.outcomeTwo, createdAt: at(40) })

      const grouped = await repo().ideasByOutcomeIds([ids.outcomeTwo])

      expect(grouped.get(ids.outcomeTwo)?.map((i) => i.ideaId)).toEqual([a, b])
    })
  })

  describe('owner validation against the real user repository', () => {
    const body = {
      name: 'Owned',
      description: null,
      targetStartDate: '2026-10-01',
      targetEndDate: '2026-12-31',
      color: null,
    }

    async function failure(promise: Promise<unknown>): Promise<unknown> {
      return promise.then(
        () => null,
        (error: unknown) => error,
      )
    }

    it('accepts an active user of the organization and stores the id', async () => {
      const created = await service().create(orgId, { ...body, ownerUserId: adminId })

      expect(created.ownerUserId).toBe(adminId)
      expect(created).not.toHaveProperty('ownerDisplayName')
    })

    it.each([
      ['an inactive user', () => inactiveId],
      ['a user of another organization', () => foreignUserId],
      ['an unknown user', () => randomUUID()],
      ['the empty GUID a non-GUID becomes at the boundary', () => EMPTY_GUID],
    ])('refuses %s with a 400 keyed ownerUserId', async (_label, owner) => {
      const error = await failure(service().create(orgId, { ...body, ownerUserId: owner() }))

      expect(error).toMatchObject({ failures: { ownerUserId: expect.any(Array) } })
    })

    it('applies the same rule on update and leaves the Outcome untouched when refused', async () => {
      const before = await prisma.outcomes.findUniqueOrThrow({ where: { id: ids.outcomeTwo } })

      const error = await failure(
        service().update(orgId, ids.outcomeTwo, {
          ...body,
          name: 'Two renamed',
          ownerUserId: inactiveId,
          color: undefined,
        }),
      )

      expect(error).toMatchObject({ failures: { ownerUserId: expect.any(Array) } })
      const after = await prisma.outcomes.findUniqueOrThrow({ where: { id: ids.outcomeTwo } })
      expect(after.name).toBe(before.name)
    })
  })
})
