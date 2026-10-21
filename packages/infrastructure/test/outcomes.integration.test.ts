// Live-database check of the Outcome reads and writes (SPEC/contracts/outcomes.md): rollups follow
// the final lane of each item's own board, the sprint span comes from the tasks' sprints, the
// ungrouped list leaves out cards with a parent, and a delete ungroups without deleting an item.
//
// Skipped unless `DATABASE_URL` is set. It builds its own organization and removes it afterwards.

import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaUnitOfWork } from '../src/persistence/unit-of-work.js'
import { PrismaMetricTypeRepository } from '../src/repositories/metric-type.repository.js'
import { PrismaOutcomeRepository } from '../src/repositories/outcome.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const AT = new Date('2026-10-15T09:00:00.000Z')

describe.skipIf(!DATABASE_URL)('Outcomes against a live database', () => {
  const prisma = new PrismaClient()
  const marker = randomUUID()
  const organizationId = randomUUID()
  const adminId = randomUUID()
  const ideaTypeId = randomUUID()
  const impactId = randomUUID()
  const [OPEN, DONE] = [randomUUID(), randomUUID()] as const
  const parentBoardId = randomUUID()
  const childBoardId = randomUUID()
  const sprintId = randomUUID()
  const outcomeId = randomUUID()
  const emptyOutcomeId = randomUUID()
  const [groupedId, standaloneId, openTaskId, doneTaskId, ungroupedId] = [
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
  ] as const
  const stamps = { created_at_utc: AT, updated_at_utc: AT }

  async function newIdea(
    id: string,
    board: string,
    statusId: string,
    extra: { parent?: string; outcome?: string; sprint?: string } = {},
  ): Promise<void> {
    await prisma.ideas.create({
      data: {
        id,
        organization_id: organizationId,
        board_id: board,
        status_id: statusId,
        parent_idea_id: extra.parent ?? null,
        outcome_id: extra.outcome ?? null,
        sprint_id: extra.sprint ?? null,
        title: `Probe ${id}`,
        problem: 'Probe problem.',
        proposed_solutions: ['Probe solution.'],
        impact_rationale: 'Probe rationale.',
        priority: 'Medium',
        idea_type_id: ideaTypeId,
        business_impact_id: impactId,
        author_user_id: adminId,
        is_deleted: false,
        phase: 'Discovery',
        ...stamps,
      },
    })
  }

  beforeAll(async () => {
    await prisma.organizations.create({
      data: {
        id: organizationId,
        title: `probe-org-${marker}`,
        description: 'Outcomes probe.',
        invite_code: `probe-${marker}`,
        is_archived: false,
        ...stamps,
      },
    })
    await prisma.users.create({
      data: {
        id: adminId,
        organization_id: organizationId,
        first_name: 'Probe',
        last_name: 'Admin',
        email: `probe-admin-${marker}@example.test`,
        normalized_email: `PROBE-ADMIN-${marker}@EXAMPLE.TEST`,
        password_hash: 'not-a-real-hash',
        role: 'OrgAdmin',
        status: 'Active',
        must_change_password: false,
        failed_login_count: 0,
        security_stamp: marker,
        ...stamps,
      },
    })
    for (const [order, id] of [OPEN, DONE].entries()) {
      await prisma.statuses.create({
        data: {
          id,
          organization_id: organizationId,
          name: `Lane ${order}`,
          color: '#123456',
          sort_order: order,
          is_deleted: false,
          ...stamps,
        },
      })
    }
    await prisma.idea_types.create({
      data: {
        id: ideaTypeId,
        organization_id: organizationId,
        name: 'Probe type',
        sort_order: 0,
        is_deleted: false,
        ...stamps,
      },
    })
    await prisma.business_impacts.create({
      data: {
        id: impactId,
        organization_id: organizationId,
        name: 'Probe impact',
        color: '#123456',
        sort_order: 0,
        is_deleted: false,
        ...stamps,
      },
    })
    for (const id of [parentBoardId, childBoardId]) {
      await prisma.boards.create({
        data: {
          id,
          organization_id: organizationId,
          name: `Board ${id}`,
          allow_user_status_update: true,
          sprints_enabled: true,
          ...stamps,
          board_swimlanes: {
            create: [
              { id: randomUUID(), status_id: OPEN, display_order: 0, is_final: false },
              // Only the child board treats DONE as final: a parent in DONE is not done.
              {
                id: randomUUID(),
                status_id: DONE,
                display_order: 1,
                is_final: id === childBoardId,
              },
            ],
          },
        },
      })
    }
    await prisma.sprints.create({
      data: {
        id: sprintId,
        organization_id: organizationId,
        board_id: childBoardId,
        name: 'Probe sprint',
        start_date: new Date('2026-10-01T00:00:00.000Z'),
        end_date: new Date('2026-10-14T00:00:00.000Z'),
        state: 'Planned',
        is_deleted: false,
        ...stamps,
      },
    })
    for (const [id, order] of [
      [outcomeId, 0],
      [emptyOutcomeId, 1],
    ] as const) {
      await prisma.outcomes.create({
        data: {
          id,
          organization_id: organizationId,
          name: `Outcome ${order}`,
          target_start_date: new Date('2026-10-01T00:00:00.000Z'),
          target_end_date: new Date('2026-12-31T00:00:00.000Z'),
          sort_order: order,
          color: '#112233',
          is_deleted: false,
          ...stamps,
        },
      })
    }
    await newIdea(groupedId, parentBoardId, DONE, { outcome: outcomeId })
    await newIdea(standaloneId, childBoardId, DONE, { outcome: outcomeId })
    await newIdea(openTaskId, childBoardId, OPEN, { parent: groupedId })
    await newIdea(doneTaskId, childBoardId, DONE, { parent: groupedId, sprint: sprintId })
    await newIdea(ungroupedId, parentBoardId, OPEN)
  })

  afterAll(async () => {
    await prisma.ideas.deleteMany({
      where: { organization_id: organizationId, parent_idea_id: { not: null } },
    })
    await prisma.ideas.deleteMany({ where: { organization_id: organizationId } })
    await prisma.metric_types.deleteMany({ where: { organization_id: organizationId } })
    await prisma.outcomes.deleteMany({ where: { organization_id: organizationId } })
    await prisma.sprints.deleteMany({ where: { organization_id: organizationId } })
    await prisma.board_swimlanes.deleteMany({
      where: { boards: { organization_id: organizationId } },
    })
    await prisma.boards.deleteMany({ where: { organization_id: organizationId } })
    await prisma.idea_types.deleteMany({ where: { organization_id: organizationId } })
    await prisma.business_impacts.deleteMany({ where: { organization_id: organizationId } })
    await prisma.statuses.deleteMany({ where: { organization_id: organizationId } })
    await prisma.users.deleteMany({ where: { organization_id: organizationId } })
    await prisma.organizations.deleteMany({ where: { id: organizationId } })
    await prisma.$disconnect()
  })

  const repository = () => new PrismaOutcomeRepository(prisma, new PrismaUnitOfWork(prisma))

  it('totals metric values per active type over top-level items, as exact decimals', async () => {
    const [savings, archived] = [randomUUID(), randomUUID()]
    await prisma.metric_types.createMany({
      data: [
        {
          metric_type_id: savings,
          organization_id: organizationId,
          name: 'Savings',
          unit: '$',
          is_archived: false,
          created_at_utc: AT,
          updated_at_utc: AT,
        },
        {
          metric_type_id: archived,
          organization_id: organizationId,
          name: 'Old',
          unit: null,
          is_archived: true,
          // A second later, so the types' order (created first) is not left to a tie.
          created_at_utc: new Date(AT.getTime() + 1000),
          updated_at_utc: AT,
        },
      ],
    })
    const metrics = new PrismaMetricTypeRepository(prisma, new PrismaUnitOfWork(prisma))
    const unitOfWork = new PrismaUnitOfWork(prisma)
    const writer = new PrismaMetricTypeRepository(prisma, unitOfWork)
    await writer.apply(
      groupedId,
      [
        { metricTypeId: savings, projected: 0.1, realized: null },
        { metricTypeId: archived, projected: 5, realized: 5 },
      ],
      [],
    )
    await unitOfWork.saveChanges()
    const second = new PrismaUnitOfWork(prisma)
    await new PrismaMetricTypeRepository(prisma, second).apply(
      standaloneId,
      [{ metricTypeId: savings, projected: 0.2, realized: -3.25 }],
      [],
    )
    await second.saveChanges()
    // A value left on a card that has a parent is kept but never counted.
    const third = new PrismaUnitOfWork(prisma)
    await new PrismaMetricTypeRepository(prisma, third).apply(
      openTaskId,
      [{ metricTypeId: savings, projected: 100, realized: 100 }],
      [],
    )
    await third.saveChanges()

    expect(await metrics.listByIdea(groupedId)).toEqual([
      expect.objectContaining({ metricTypeId: savings, projected: 0.1, realized: null }),
      expect.objectContaining({ metricTypeId: archived, isArchived: true }),
    ])
    const rollups = await repository().rollupsByOutcomeIds([outcomeId, emptyOutcomeId])
    expect(rollups.get(outcomeId)?.metricTotals).toEqual([
      { metricTypeId: savings, name: 'Savings', unit: '$', projected: 0.3, realized: -3.25 },
    ])
    expect(rollups.get(emptyOutcomeId)?.metricTotals).toEqual([])

    const clear = new PrismaUnitOfWork(prisma)
    await new PrismaMetricTypeRepository(prisma, clear).apply(standaloneId, [], [savings])
    await clear.saveChanges()
    expect(await metrics.listByIdea(standaloneId)).toEqual([])
    // Leave the fixture as the other rollup tests expect it.
    await prisma.idea_metric_values.deleteMany({
      where: { ideas: { organization_id: organizationId } },
    })
  })

  it('rolls up items and tasks by the final lane of each own board, with the sprint span', async () => {
    const rollups = await repository().rollupsByOutcomeIds([outcomeId, emptyOutcomeId])

    expect(rollups.get(outcomeId)).toEqual({
      ideaCount: 2,
      doneIdeaCount: 1,
      taskCount: 2,
      doneTaskCount: 1,
      sprintStart: '2026-10-01',
      sprintEnd: '2026-10-14',
      metricTotals: [],
    })
    expect(rollups.get(emptyOutcomeId)).toEqual({
      ideaCount: 0,
      doneIdeaCount: 0,
      taskCount: 0,
      doneTaskCount: 0,
      sprintStart: null,
      sprintEnd: null,
      metricTotals: [],
    })
  })

  it('lists grouped items per Outcome and the ungrouped top-level items only', async () => {
    const grouped = await repository().ideasByOutcomeIds([outcomeId])
    const ungrouped = await repository().listUngroupedIdeas(organizationId)

    expect(
      grouped
        .get(outcomeId)
        ?.map((i) => i.ideaId)
        .sort(),
    ).toEqual([groupedId, standaloneId].sort())
    expect(grouped.get(outcomeId)?.[0]).toMatchObject({ assigneeUserIds: [], sprintId: null })
    expect(ungrouped.map((i) => i.ideaId)).toEqual([ungroupedId])
  })

  it('ungroups the items on delete without deleting any', async () => {
    const outcomes = repository()
    const uow = new PrismaUnitOfWork(prisma)
    const repo = new PrismaOutcomeRepository(prisma, uow)

    await repo.ungroupIdeas(outcomeId)
    await uow.saveChanges()

    expect(await outcomes.ideasByOutcomeIds([outcomeId])).toEqual(new Map())
    const remaining = await prisma.ideas.count({
      where: { organization_id: organizationId, is_deleted: false },
    })
    expect(remaining).toBe(5)
  })
})
