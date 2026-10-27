// Live-database QA for metric types (SPEC/contracts/metric-types.md, SPEC/contracts/outcomes.md
// "metricTotals"): the Outcome rollup of values per active type (soft-deleted items, cards with a
// parent and archived types left out, decimals summed exactly, the types' order, `[]` when empty),
// the numeric(17,2) round trip, the repository's ordering and isolation, and both services driven
// over the real repositories (whole-set replacement, archived values untouched, the no-op, 404 for
// a deleted item, the audit written only once the rows are committed).
//
// Skipped unless `DATABASE_URL` is set. It builds its own organizations and removes them afterwards.

import { randomUUID } from 'node:crypto'
import type { AuditEventInput, CurrentUserContext } from '@collega/application/common'
import { IdeaMetricsService, MetricTypeService } from '@collega/application/metric-types'
import { Role } from '@collega/domain/enums'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaUnitOfWork } from '../src/persistence/unit-of-work.js'
import { PrismaIdeaRepository } from '../src/repositories/idea.repository.js'
import { PrismaMetricTypeRepository } from '../src/repositories/metric-type.repository.js'
import { PrismaOutcomeRepository } from '../src/repositories/outcome.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const AT = new Date('2026-10-15T09:00:00.000Z')
const NOW = new Date('2026-10-16T09:00:00.000Z')
const minute = (m: number) => new Date(Date.UTC(2026, 9, 1, 0, m))

describe.skipIf(!DATABASE_URL)('Metric types QA against a live database', () => {
  const prisma = new PrismaClient()
  const marker = randomUUID()
  const orgId = randomUUID()
  const otherOrgId = randomUUID()
  const adminId = randomUUID()
  const authorId = randomUUID()
  const statusId = randomUUID()
  const ideaTypeId = randomUUID()
  const impactId = randomUUID()
  const stamps = { created_at_utc: AT, updated_at_utc: AT }
  const events: AuditEventInput[] = []
  // Set by a test to observe what the database holds the moment an audit event is written.
  let onAudit: ((event: AuditEventInput) => Promise<void>) | null = null

  // Two types created in the same instant: they order by id, whatever order they were inserted in.
  const [tieFirst, tieSecond] = [randomUUID(), randomUUID()].sort() as [string, string]
  const types = {
    savings: randomUUID(),
    hours: randomUUID(),
    tieFirst,
    tieSecond,
    archived: randomUUID(),
    foreign: randomUUID(),
  }
  const ids = {
    outcomeX: randomUUID(),
    outcomeY: randomUUID(),
    outcomeZ: randomUUID(),
    i1: randomUUID(),
    i2: randomUUID(),
    i3: randomUUID(),
    iDeleted: randomUUID(),
    task: randomUUID(),
    iTies: randomUUID(),
    i4: randomUUID(),
    iZ: randomUUID(),
    editable: randomUUID(),
    editableTask: randomUUID(),
    deleted: randomUUID(),
    foreignIdea: randomUUID(),
  }

  async function newIdea(
    id: string,
    extra: { parent?: string; outcome?: string; deleted?: boolean; org?: string } = {},
  ): Promise<void> {
    await prisma.ideas.create({
      data: {
        id,
        organization_id: extra.org ?? orgId,
        board_id: null,
        status_id: statusId,
        parent_idea_id: extra.parent ?? null,
        outcome_id: extra.outcome ?? null,
        title: `Probe ${id.slice(0, 8)}`,
        problem: 'Probe problem.',
        proposed_solutions: ['Probe solution.'],
        impact_rationale: 'Probe rationale.',
        priority: 'Medium',
        idea_type_id: ideaTypeId,
        business_impact_id: impactId,
        author_user_id: authorId,
        is_deleted: extra.deleted ?? false,
        phase: 'Discovery',
        ...stamps,
      },
    })
  }

  // Decimals go in as text so the fixture itself never passes through a float.
  async function setValue(
    ideaId: string,
    metricTypeId: string,
    projected: string | null,
    realized: string | null,
  ): Promise<void> {
    await prisma.idea_metric_values.create({
      data: { idea_id: ideaId, metric_type_id: metricTypeId, projected, realized },
    })
  }

  function actor(
    role: Role,
    userId = adminId,
    organizationId: string | null = orgId,
  ): CurrentUserContext {
    return {
      isAuthenticated: true,
      userId,
      organizationId,
      role,
      isImpersonating: false,
      realUserId: userId,
    }
  }

  const auditWriter = {
    write: async (event: AuditEventInput) => {
      if (onAudit) await onAudit(event)
      events.push(event)
    },
  }

  function typeService(currentUser: CurrentUserContext = actor(Role.OrgAdmin)) {
    const unitOfWork = new PrismaUnitOfWork(prisma)
    return new MetricTypeService(
      new PrismaMetricTypeRepository(prisma, unitOfWork),
      unitOfWork,
      auditWriter,
      currentUser,
      { now: () => NOW },
    )
  }

  function valueService(currentUser: CurrentUserContext = actor(Role.OrgAdmin)) {
    const unitOfWork = new PrismaUnitOfWork(prisma)
    const metrics = new PrismaMetricTypeRepository(prisma, unitOfWork)
    return new IdeaMetricsService(
      new PrismaIdeaRepository(prisma, unitOfWork),
      metrics,
      metrics,
      unitOfWork,
      auditWriter,
      currentUser,
      { now: () => NOW },
      { canSeeBoard: async () => true },
    )
  }

  const metricsRepo = () => new PrismaMetricTypeRepository(prisma, new PrismaUnitOfWork(prisma))
  const outcomeRepo = () => new PrismaOutcomeRepository(prisma, new PrismaUnitOfWork(prisma))
  const totalsOf = async (outcomeId: string) =>
    (await outcomeRepo().rollupsByOutcomeIds([outcomeId])).get(outcomeId)?.metricTotals

  beforeAll(async () => {
    for (const [id, title] of [
      [orgId, 'main'],
      [otherOrgId, 'other'],
    ] as const) {
      await prisma.organizations.create({
        data: {
          id,
          title: `probe-org-${title}-${marker}`,
          description: 'Metric types QA probe.',
          invite_code: `probe-${title}-${marker}`,
          is_archived: false,
          ...stamps,
        },
      })
    }
    for (const [id, role, label] of [
      [adminId, 'OrgAdmin', 'admin'],
      [authorId, 'User', 'author'],
    ] as const) {
      await prisma.users.create({
        data: {
          id,
          organization_id: orgId,
          first_name: 'Probe',
          last_name: label,
          email: `probe-${label}-${marker}@example.test`,
          normalized_email: `PROBE-${label.toUpperCase()}-${marker}@EXAMPLE.TEST`,
          password_hash: 'not-a-real-hash',
          role,
          status: 'Active',
          must_change_password: false,
          failed_login_count: 0,
          security_stamp: marker,
          ...stamps,
        },
      })
    }
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

    const metricType = (
      id: string,
      name: string,
      createdAt: Date,
      extra: { unit?: string | null; archived?: boolean; org?: string } = {},
    ) =>
      prisma.metric_types.create({
        data: {
          metric_type_id: id,
          organization_id: extra.org ?? orgId,
          name,
          unit: extra.unit ?? null,
          is_archived: extra.archived ?? false,
          created_at_utc: createdAt,
          updated_at_utc: createdAt,
        },
      })
    // Inserted out of order on purpose: the order a read returns is the repository's, not the table's.
    await metricType(types.tieSecond, 'Tie second', minute(3))
    await metricType(types.hours, 'Hours', minute(2), { unit: 'hours' })
    await metricType(types.tieFirst, 'Tie first', minute(3))
    await metricType(types.savings, 'Savings', minute(1), { unit: '$' })
    await metricType(types.archived, 'Archived', minute(0), { archived: true })
    await metricType(types.foreign, 'Foreign', minute(1), { org: otherOrgId })

    const outcome = (id: string, order: number) =>
      prisma.outcomes.create({
        data: {
          id,
          organization_id: orgId,
          name: `Outcome ${order}`,
          target_start_date: new Date('2026-10-01T00:00:00.000Z'),
          target_end_date: new Date('2026-12-31T00:00:00.000Z'),
          sort_order: order,
          color: '#112233',
          is_deleted: false,
          ...stamps,
        },
      })
    await outcome(ids.outcomeX, 0)
    await outcome(ids.outcomeY, 1)
    await outcome(ids.outcomeZ, 2)

    await newIdea(ids.i1, { outcome: ids.outcomeX })
    await newIdea(ids.i2, { outcome: ids.outcomeX })
    await newIdea(ids.i3, { outcome: ids.outcomeX })
    await newIdea(ids.iDeleted, { outcome: ids.outcomeX, deleted: true })
    await newIdea(ids.task, { outcome: ids.outcomeX, parent: ids.i1 })
    await newIdea(ids.iTies, { outcome: ids.outcomeX })
    await newIdea(ids.i4, { outcome: ids.outcomeY })
    await newIdea(ids.iZ, { outcome: ids.outcomeZ })
    await newIdea(ids.editable)
    await newIdea(ids.editableTask, { parent: ids.editable })
    await newIdea(ids.deleted, { deleted: true })
    await newIdea(ids.foreignIdea, { org: otherOrgId })

    // Outcome X: 0.1 + 0.2 + 0.3 is 0.6000000000000001 in a float and exactly 0.6 here.
    await setValue(ids.i1, types.savings, '0.1', '10')
    await setValue(ids.i1, types.hours, '1', null)
    await setValue(ids.i1, types.archived, '5', '5')
    await setValue(ids.i2, types.savings, '0.2', '20')
    await setValue(ids.i3, types.savings, '0.3', null)
    await setValue(ids.iDeleted, types.savings, '1000', '1000')
    await setValue(ids.task, types.savings, '500', '500')
    await setValue(ids.iTies, types.tieFirst, '1.5', null)
    await setValue(ids.iTies, types.tieSecond, null, '-2.5')
    await setValue(ids.i4, types.savings, '7', '7')
  })

  afterAll(async () => {
    const mine = { organization_id: { in: [orgId, otherOrgId] } }
    await prisma.ideas.deleteMany({ where: { ...mine, parent_idea_id: { not: null } } })
    await prisma.ideas.deleteMany({ where: mine })
    await prisma.metric_types.deleteMany({ where: mine })
    await prisma.outcomes.deleteMany({ where: mine })
    await prisma.idea_types.deleteMany({ where: mine })
    await prisma.business_impacts.deleteMany({ where: mine })
    await prisma.statuses.deleteMany({ where: mine })
    await prisma.users.deleteMany({ where: mine })
    await prisma.organizations.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } })
    await prisma.$disconnect()
  })

  describe('Outcome metricTotals', () => {
    it('sums per active type over live top-level items, in the types order, with exact decimals', async () => {
      expect(await totalsOf(ids.outcomeX)).toEqual([
        { metricTypeId: types.savings, name: 'Savings', unit: '$', projected: 0.6, realized: 30 },
        { metricTypeId: types.hours, name: 'Hours', unit: 'hours', projected: 1, realized: null },
        {
          metricTypeId: types.tieFirst,
          name: 'Tie first',
          unit: null,
          projected: 1.5,
          realized: null,
        },
        {
          metricTypeId: types.tieSecond,
          name: 'Tie second',
          unit: null,
          projected: null,
          realized: -2.5,
        },
      ])
    })

    it('leaves out a soft-deleted item, a card with a parent and an archived type', async () => {
      const totals = await totalsOf(ids.outcomeX)

      // 1000 (deleted item) and 500 (task) would show in the savings sums; the archived type is absent.
      expect(totals?.find((t) => t.metricTypeId === types.savings)).toMatchObject({
        projected: 0.6,
        realized: 30,
      })
      expect(totals?.map((t) => t.metricTypeId)).not.toContain(types.archived)
    })

    it('orders two types created in the same instant by their id', async () => {
      const order = (await totalsOf(ids.outcomeX))?.map((t) => t.metricTypeId)

      expect(order?.indexOf(types.tieFirst)).toBeLessThan(order?.indexOf(types.tieSecond) ?? -1)
    })

    it('reports a sum with no non-null number as null, not 0', async () => {
      const hours = (await totalsOf(ids.outcomeX))?.find((t) => t.metricTypeId === types.hours)

      expect(hours?.realized).toBeNull()
    })

    it('keeps each Outcome to its own items', async () => {
      expect(await totalsOf(ids.outcomeY)).toEqual([
        { metricTypeId: types.savings, name: 'Savings', unit: '$', projected: 7, realized: 7 },
      ])
    })

    it('returns an empty array for an Outcome whose items carry no values, and for one with no items', async () => {
      const empty = randomUUID()
      await prisma.outcomes.create({
        data: {
          id: empty,
          organization_id: orgId,
          name: 'Empty',
          target_start_date: new Date('2026-10-01T00:00:00.000Z'),
          target_end_date: new Date('2026-12-31T00:00:00.000Z'),
          sort_order: 9,
          color: '#112233',
          is_deleted: false,
          ...stamps,
        },
      })

      expect(await totalsOf(ids.outcomeZ)).toEqual([])
      expect(await totalsOf(empty)).toEqual([])
    })

    it('drops an archived type from the totals and brings it back when restored', async () => {
      const setArchived = (isArchived: boolean) =>
        prisma.metric_types.update({
          where: { metric_type_id: types.savings },
          data: { is_archived: isArchived },
        })
      try {
        await setArchived(true)
        expect((await totalsOf(ids.outcomeX))?.map((t) => t.metricTypeId)).not.toContain(
          types.savings,
        )
      } finally {
        await setArchived(false)
      }

      expect((await totalsOf(ids.outcomeX))?.[0]).toMatchObject({
        metricTypeId: types.savings,
        projected: 0.6,
      })
    })

    it('stops counting a value once its item has a parent, while keeping the value', async () => {
      const setParent = (parent: string | null) =>
        prisma.ideas.update({ where: { id: ids.i3 }, data: { parent_idea_id: parent } })
      try {
        await setParent(ids.i1)
        expect((await totalsOf(ids.outcomeX))?.[0]).toMatchObject({ projected: 0.3, realized: 30 })
        expect(await prisma.idea_metric_values.count({ where: { idea_id: ids.i3 } })).toBe(1)
      } finally {
        await setParent(null)
      }

      expect((await totalsOf(ids.outcomeX))?.[0]).toMatchObject({ projected: 0.6 })
    })

    it('stops counting an item once it is soft-deleted', async () => {
      const setDeleted = (isDeleted: boolean) =>
        prisma.ideas.update({ where: { id: ids.i2 }, data: { is_deleted: isDeleted } })
      try {
        await setDeleted(true)
        expect((await totalsOf(ids.outcomeX))?.[0]).toMatchObject({ projected: 0.4, realized: 10 })
      } finally {
        await setDeleted(false)
      }

      expect((await totalsOf(ids.outcomeX))?.[0]).toMatchObject({ projected: 0.6, realized: 30 })
    })

    it('returns the totals for several Outcomes in one call', async () => {
      const rollups = await outcomeRepo().rollupsByOutcomeIds([
        ids.outcomeX,
        ids.outcomeY,
        ids.outcomeZ,
      ])

      expect([...rollups.values()].map((r) => r.metricTotals.length)).toEqual([4, 1, 0])
    })
  })

  describe('PrismaMetricTypeRepository', () => {
    it('lists an organization active types by createdAt then id, and archived ones on request', async () => {
      const active = await metricsRepo().listByOrganization(orgId, false)
      const all = await metricsRepo().listByOrganization(orgId, true)

      expect(active.map((t) => t.id)).toEqual([
        types.savings,
        types.hours,
        types.tieFirst,
        types.tieSecond,
      ])
      expect(all.map((t) => t.id)).toEqual([
        types.archived,
        types.savings,
        types.hours,
        types.tieFirst,
        types.tieSecond,
      ])
    })

    it("never lists another organization's types", async () => {
      const mine = await metricsRepo().listByOrganization(orgId, true)
      const theirs = await metricsRepo().listByOrganization(otherOrgId, true)

      expect(mine.map((t) => t.id)).not.toContain(types.foreign)
      expect(theirs.map((t) => t.id)).toEqual([types.foreign])
    })

    it('finds a type by id whatever its organization, so the service can answer 404', async () => {
      expect((await metricsRepo().getById(types.foreign))?.organizationId).toBe(otherOrgId)
      expect(await metricsRepo().getById(randomUUID())).toBeNull()
    })

    it('round-trips numeric(17,2) values exactly, zero and negatives and the largest allowed included', async () => {
      const idea = randomUUID()
      await newIdea(idea)
      const unitOfWork = new PrismaUnitOfWork(prisma)
      await new PrismaMetricTypeRepository(prisma, unitOfWork).apply(
        idea,
        [
          { metricTypeId: types.savings, projected: 0.1, realized: -3.25 },
          { metricTypeId: types.hours, projected: 0, realized: 999999999999999 },
          { metricTypeId: types.tieFirst, projected: -999999999999999, realized: null },
        ],
        [],
      )
      await unitOfWork.saveChanges()

      expect(
        (await metricsRepo().listByIdea(idea)).map((m) => [
          m.metricTypeId,
          m.projected,
          m.realized,
        ]),
      ).toEqual([
        [types.savings, 0.1, -3.25],
        [types.hours, 0, 999999999999999],
        [types.tieFirst, -999999999999999, null],
      ])
    })

    it('lists an item values in the types order with the type name, unit and archived flag', async () => {
      const idea = randomUUID()
      await newIdea(idea)
      await setValue(idea, types.tieSecond, '1', null)
      await setValue(idea, types.archived, '2', null)
      await setValue(idea, types.savings, '3', null)

      expect(await metricsRepo().listByIdea(idea)).toEqual([
        {
          metricTypeId: types.archived,
          name: 'Archived',
          unit: null,
          isArchived: true,
          projected: 2,
          realized: null,
        },
        {
          metricTypeId: types.savings,
          name: 'Savings',
          unit: '$',
          isArchived: false,
          projected: 3,
          realized: null,
        },
        {
          metricTypeId: types.tieSecond,
          name: 'Tie second',
          unit: null,
          isArchived: false,
          projected: 1,
          realized: null,
        },
      ])
    })

    it('replaces a value in place and clears the types it is told to, touching nothing else', async () => {
      const idea = randomUUID()
      await newIdea(idea)
      await setValue(idea, types.savings, '1', '1')
      await setValue(idea, types.hours, '2', '2')
      await setValue(idea, types.archived, '9', '9')
      const unitOfWork = new PrismaUnitOfWork(prisma)

      await new PrismaMetricTypeRepository(prisma, unitOfWork).apply(
        idea,
        [{ metricTypeId: types.savings, projected: 5, realized: null }],
        [types.hours],
      )
      await unitOfWork.saveChanges()

      expect(
        (await metricsRepo().listByIdea(idea)).map((m) => [
          m.metricTypeId,
          m.projected,
          m.realized,
        ]),
      ).toEqual([
        [types.archived, 9, 9],
        [types.savings, 5, null],
      ])
    })

    it('stages nothing until the unit of work saves', async () => {
      const idea = randomUUID()
      await newIdea(idea)
      const unitOfWork = new PrismaUnitOfWork(prisma)

      await new PrismaMetricTypeRepository(prisma, unitOfWork).apply(
        idea,
        [{ metricTypeId: types.savings, projected: 1, realized: 1 }],
        [],
      )

      expect(await metricsRepo().listByIdea(idea)).toEqual([])
    })

    it('removes an item values with the item', async () => {
      const idea = randomUUID()
      await newIdea(idea)
      await setValue(idea, types.savings, '1', null)

      await prisma.ideas.delete({ where: { id: idea } })

      expect(await prisma.idea_metric_values.count({ where: { idea_id: idea } })).toBe(0)
    })

    it('refuses to delete a type that holds values: types are archived, not deleted', async () => {
      await expect(
        prisma.metric_types.delete({ where: { metric_type_id: types.savings } }),
      ).rejects.toThrow()
    })
  })

  describe('MetricTypeService over the real repository', () => {
    it('creates a trimmed, active type with a null blank unit, readable by a member', async () => {
      const created = await typeService().create(orgId, { name: '  Cost avoided  ', unit: '  ' })

      expect(created).toMatchObject({ name: 'Cost avoided', unit: null, isArchived: false })
      const listed = await typeService(actor(Role.ReadOnly, authorId)).list(orgId, false)
      expect(listed.at(-1)).toMatchObject({
        metricTypeId: created.metricTypeId,
        name: 'Cost avoided',
      })
    })

    it('allows a second type with the same name', async () => {
      const first = await typeService().create(orgId, { name: 'Twin', unit: null })
      const second = await typeService().create(orgId, { name: 'Twin', unit: null })

      expect(second.metricTypeId).not.toBe(first.metricTypeId)
    })

    it('archives and restores, keeping the values and changing the totals', async () => {
      const idea = randomUUID()
      const created = await typeService().create(orgId, { name: 'Round trip', unit: 'x' })
      await newIdea(idea, { outcome: ids.outcomeZ })
      await setValue(idea, created.metricTypeId, '4.5', '1')
      const before = events.length

      await typeService().update(orgId, created.metricTypeId, {
        name: 'Round trip',
        unit: 'x',
        isArchived: true,
      })
      expect(await totalsOf(ids.outcomeZ)).toEqual([])
      expect((await metricsRepo().listByIdea(idea))[0]).toMatchObject({
        isArchived: true,
        projected: 4.5,
      })

      await typeService().update(orgId, created.metricTypeId, {
        name: 'Round trip',
        unit: 'x',
        isArchived: false,
      })
      expect(await totalsOf(ids.outcomeZ)).toEqual([
        {
          metricTypeId: created.metricTypeId,
          name: 'Round trip',
          unit: 'x',
          projected: 4.5,
          realized: 1,
        },
      ])
      expect(events.slice(before).map((e) => e.eventType)).toEqual([
        'MetricTypeArchived',
        'MetricTypeRestored',
      ])
      // Keep Outcome Z empty for the tests that follow.
      await prisma.ideas.delete({ where: { id: idea } })
    })

    it('saves nothing and audits nothing when an update changes nothing', async () => {
      const created = await typeService().create(orgId, { name: 'Steady', unit: '$' })
      const stamp = (await metricsRepo().getById(created.metricTypeId))?.updatedAtUtc
      const before = events.length

      await typeService().update(orgId, created.metricTypeId, {
        name: ' Steady ',
        unit: '$',
        isArchived: false,
      })

      expect((await metricsRepo().getById(created.metricTypeId))?.updatedAtUtc).toEqual(stamp)
      expect(events.length).toBe(before)
    })

    it('answers 404 for a type of another organization and leaves it alone', async () => {
      await expect(
        typeService().update(orgId, types.foreign, {
          name: 'Hijacked',
          unit: null,
          isArchived: true,
        }),
      ).rejects.toMatchObject({ kind: 'notFound' })
      expect((await metricsRepo().getById(types.foreign))?.name).toBe('Foreign')
    })

    it('writes the audit event only after the type is committed', async () => {
      let seen: number | null = null
      onAudit = async (event) => {
        seen = await prisma.metric_types.count({ where: { metric_type_id: event.entityId ?? '' } })
      }
      try {
        await typeService().create(orgId, { name: 'Committed first', unit: null })
      } finally {
        onAudit = null
      }

      expect(seen).toBe(1)
    })

    it('refuses a direct Site Admin and a User, writing nothing', async () => {
      const before = await prisma.metric_types.count({ where: { organization_id: orgId } })

      await expect(
        typeService(actor(Role.SiteAdmin, adminId, null)).create(orgId, { name: 'x', unit: null }),
      ).rejects.toMatchObject({ kind: 'forbidden' })
      await expect(
        typeService(actor(Role.User, authorId)).create(orgId, { name: 'x', unit: null }),
      ).rejects.toMatchObject({ kind: 'forbidden' })

      expect(await prisma.metric_types.count({ where: { organization_id: orgId } })).toBe(before)
    })
  })

  describe('IdeaMetricsService over the real repositories', () => {
    const entry = (
      metricTypeId: string,
      projected: number | null,
      realized: number | null = null,
    ) => ({
      metricTypeId,
      projected,
      realized,
    })
    const rows = async (ideaId: string) =>
      (await metricsRepo().listByIdea(ideaId)).map((m) => [m.metricTypeId, m.projected, m.realized])

    it('replaces the whole set over active types, leaving an archived type value alone', async () => {
      await setValue(ids.editable, types.archived, '9', '8')
      const service = valueService()

      await service.replace(ids.editable, [entry(types.savings, 10, 2), entry(types.hours, 3)])
      expect(await rows(ids.editable)).toEqual([
        [types.archived, 9, 8],
        [types.savings, 10, 2],
        [types.hours, 3, null],
      ])

      const result = await service.replace(ids.editable, [entry(types.hours, null, null)])
      expect(result).toEqual([
        expect.objectContaining({ metricTypeId: types.archived, isArchived: true, projected: 9 }),
      ])
      expect(await rows(ids.editable)).toEqual([[types.archived, 9, 8]])
      await prisma.idea_metric_values.deleteMany({ where: { idea_id: ids.editable } })
    })

    it('stores and returns the largest allowed number and two decimals exactly', async () => {
      const result = await valueService().replace(ids.editable, [
        entry(types.savings, 999999999999999, -0.01),
      ])

      expect(result.find((m) => m.metricTypeId === types.savings)).toMatchObject({
        projected: 999999999999999,
        realized: -0.01,
      })
      await valueService().replace(ids.editable, [])
    })

    it('audits before and after once, and only after the rows are committed', async () => {
      await valueService().replace(ids.editable, [entry(types.savings, 1)])
      const before = events.length
      let committed: unknown = null
      onAudit = async () => {
        committed = await rows(ids.editable)
      }
      try {
        await valueService().replace(ids.editable, [entry(types.savings, 2, 3)])
      } finally {
        onAudit = null
      }

      expect(committed).toEqual([[types.savings, 2, 3]])
      expect(events.slice(before)).toHaveLength(1)
      const event = events[before]
      expect(event).toMatchObject({ eventType: 'IdeaMetricsChanged', entityId: ids.editable })
      expect(JSON.parse(event?.metadataJson ?? '{}')).toMatchObject({
        before: [{ metricTypeId: types.savings, projected: 1, realized: null }],
        after: [{ metricTypeId: types.savings, projected: 2, realized: 3 }],
      })
      await valueService().replace(ids.editable, [])
    })

    it('writes no audit event when the replacement changes nothing', async () => {
      await valueService().replace(ids.editable, [entry(types.hours, 4, 5)])
      const before = events.length

      await valueService().replace(ids.editable, [entry(types.hours, 4, 5)])

      expect(events.length).toBe(before)
      await valueService().replace(ids.editable, [])
    })

    it('rolls an accepted replacement into the Outcome totals', async () => {
      await prisma.ideas.update({ where: { id: ids.editable }, data: { outcome_id: ids.outcomeZ } })
      try {
        await valueService().replace(ids.editable, [entry(types.hours, 2.5, 1.25)])

        expect(await totalsOf(ids.outcomeZ)).toEqual([
          {
            metricTypeId: types.hours,
            name: 'Hours',
            unit: 'hours',
            projected: 2.5,
            realized: 1.25,
          },
        ])
      } finally {
        await valueService().replace(ids.editable, [])
        await prisma.ideas.update({ where: { id: ids.editable }, data: { outcome_id: null } })
      }
    })

    it('answers 404 for a soft-deleted item, an item of another organization and a missing item', async () => {
      for (const ideaId of [ids.deleted, ids.foreignIdea, randomUUID()]) {
        await expect(valueService().get(ideaId)).rejects.toMatchObject({ kind: 'notFound' })
        await expect(valueService().replace(ideaId, [])).rejects.toMatchObject({ kind: 'notFound' })
      }
    })

    it('answers 422 taskCannotCarryMetrics for a card with a parent, and reads it as empty', async () => {
      await setValue(ids.editableTask, types.savings, '99', null)
      try {
        await expect(
          valueService().replace(ids.editableTask, [entry(types.savings, 1)]),
        ).rejects.toMatchObject({ kind: 'unprocessable', code: 'taskCannotCarryMetrics' })
        expect(await valueService().get(ids.editableTask)).toEqual([])
        expect(await rows(ids.editableTask)).toEqual([[types.savings, 99, null]])
      } finally {
        await prisma.idea_metric_values.deleteMany({ where: { idea_id: ids.editableTask } })
      }
    })

    it('refuses an archived type, another organization type and a repeat as 400, writing nothing', async () => {
      for (const body of [
        [entry(types.archived, 1)],
        [entry(types.foreign, 1)],
        [entry(types.savings, 1), entry(types.savings, 2)],
      ]) {
        await expect(valueService().replace(ids.editable, body)).rejects.toMatchObject({
          kind: 'validation',
          failures: { metrics: expect.any(Array) },
        })
      }
      expect(await rows(ids.editable)).toEqual([])
    })

    it('refuses a Read Only user and a User who is not the author, but lets the author write', async () => {
      await expect(
        valueService(actor(Role.ReadOnly, authorId)).replace(ids.editable, [
          entry(types.savings, 1),
        ]),
      ).rejects.toMatchObject({ kind: 'forbidden' })
      await expect(
        valueService(actor(Role.User, randomUUID())).replace(ids.editable, [
          entry(types.savings, 1),
        ]),
      ).rejects.toMatchObject({ kind: 'forbidden' })

      await valueService(actor(Role.User, authorId)).replace(ids.editable, [
        entry(types.savings, 1),
      ])
      expect(await rows(ids.editable)).toEqual([[types.savings, 1, null]])
      await valueService().replace(ids.editable, [])
    })

    it('lets any member of the organization read the values', async () => {
      await setValue(ids.editable, types.savings, '6', null)
      try {
        const read = await valueService(actor(Role.ReadOnly, randomUUID())).get(ids.editable)

        expect(read).toHaveLength(1)
      } finally {
        await prisma.idea_metric_values.deleteMany({ where: { idea_id: ids.editable } })
      }
    })
  })
})
