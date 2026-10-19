// Live-database QA for Outcomes (SPEC/contracts/outcomes.md): rollup counts against a two-board
// fixture (each item is done by the final lane of its OWN board), the sprint span, soft-delete
// exclusion on every read, the roadmap's ungrouped list, OutcomeService driven over the real
// repositories (paging, append order, partial reorder, delete ungroups, grouping rules), the
// ON DELETE SET NULL foreign key, and that saving an idea never nulls `outcome_id`.
//
// Skipped unless `DATABASE_URL` is set. It builds its own organizations and removes them afterwards.

import { randomUUID } from 'node:crypto'
import type { AuditEventInput, CurrentUserContext } from '@collega/application/common'
import { OutcomeService } from '@collega/application/outcomes'
import { Role } from '@collega/domain/enums'
import { changeIdeaStatus, replaceIdeaAssignees, updateIdeaContent } from '@collega/domain/ideas'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaUnitOfWork } from '../src/persistence/unit-of-work.js'
import { PrismaIdeaRepository } from '../src/repositories/idea.repository.js'
import { PrismaOutcomeRepository } from '../src/repositories/outcome.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const AT = new Date('2026-10-15T09:00:00.000Z')
const NOW = new Date('2026-10-16T09:00:00.000Z')

describe.skipIf(!DATABASE_URL)('Outcomes QA against a live database', () => {
  const prisma = new PrismaClient()
  const marker = randomUUID()
  const orgId = randomUUID()
  const otherOrgId = randomUUID()
  const adminId = randomUUID()
  const ideaTypeId = randomUUID()
  const impactId = randomUUID()
  // Each board has its own final lane: a status final on one board means nothing on the other.
  const [OPEN, FIN_P, FIN_C] = [randomUUID(), randomUUID(), randomUUID()] as const
  const boardP = randomUUID()
  const boardC = randomUUID()
  const sprint1 = randomUUID()
  const sprint2 = randomUUID()
  const sprintGone = randomUUID()
  const stamps = { created_at_utc: AT, updated_at_utc: AT }
  const events: AuditEventInput[] = []

  const ids = {
    outcomeX: randomUUID(),
    outcomeY: randomUUID(),
    outcomeZ: randomUUID(),
    outcomeGone: randomUUID(),
    outcomeForeign: randomUUID(),
    parentDone: randomUUID(),
    parentOpen: randomUUID(),
    parentDeleted: randomUUID(),
    standaloneDone: randomUUID(),
    noLaneOnC: randomUUID(),
    taskDoneS1: randomUUID(),
    taskOpenS2: randomUUID(),
    taskDeleted: randomUUID(),
    taskOpenGoneSprint: randomUUID(),
    taskOfOpen: randomUUID(),
    taskOfDeletedParent: randomUUID(),
    zParent: randomUUID(),
    zTask: randomUUID(),
    freeNoBoard: randomUUID(),
    freeOnP: randomUUID(),
    freeDeleted: randomUUID(),
    freeForeign: randomUUID(),
    goneParented: randomUUID(),
  }

  async function newIdea(
    id: string,
    board: string | null,
    statusId: string,
    extra: {
      parent?: string
      outcome?: string
      sprint?: string
      deleted?: boolean
      org?: string
    } = {},
  ): Promise<void> {
    await prisma.ideas.create({
      data: {
        id,
        organization_id: extra.org ?? orgId,
        board_id: board,
        status_id: statusId,
        parent_idea_id: extra.parent ?? null,
        outcome_id: extra.outcome ?? null,
        sprint_id: extra.sprint ?? null,
        title: `Probe ${id.slice(0, 8)}`,
        problem: 'Probe problem.',
        proposed_solutions: ['Probe solution.'],
        impact_rationale: 'Probe rationale.',
        priority: 'Medium',
        idea_type_id: ideaTypeId,
        business_impact_id: impactId,
        author_user_id: adminId,
        is_deleted: extra.deleted ?? false,
        phase: 'Discovery',
        ...stamps,
      },
    })
  }

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

  function service(currentUser: CurrentUserContext = admin()) {
    const unitOfWork = new PrismaUnitOfWork(prisma)
    const outcomes = new PrismaOutcomeRepository(prisma, unitOfWork)
    return new OutcomeService(
      outcomes,
      outcomes,
      new PrismaIdeaRepository(prisma, unitOfWork),
      { listByIds: async () => [] },
      unitOfWork,
      {
        write: async (event: AuditEventInput) => {
          events.push(event)
        },
      },
      currentUser,
      { now: () => NOW },
      { nextInt: () => 0 },
    )
  }

  const repo = () => new PrismaOutcomeRepository(prisma, new PrismaUnitOfWork(prisma))
  const outcomeOf = async (ideaId: string) =>
    (await prisma.ideas.findUniqueOrThrow({ where: { id: ideaId } })).outcome_id

  beforeAll(async () => {
    for (const [id, title] of [
      [orgId, 'main'],
      [otherOrgId, 'other'],
    ] as const) {
      await prisma.organizations.create({
        data: {
          id,
          title: `probe-org-${title}-${marker}`,
          description: 'Outcomes QA probe.',
          invite_code: `probe-${title}-${marker}`,
          is_archived: false,
          ...stamps,
        },
      })
    }
    await prisma.users.create({
      data: {
        id: adminId,
        organization_id: orgId,
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
    for (const [order, id] of [OPEN, FIN_P, FIN_C].entries()) {
      await prisma.statuses.create({
        data: {
          id,
          organization_id: orgId,
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
    const lanes = (final: string) => [
      { id: randomUUID(), status_id: OPEN, display_order: 0, is_final: false },
      { id: randomUUID(), status_id: final, display_order: 1, is_final: true },
    ]
    for (const [id, final] of [
      [boardP, FIN_P],
      [boardC, FIN_C],
    ] as const) {
      await prisma.boards.create({
        data: {
          id,
          organization_id: orgId,
          name: `Board ${id.slice(0, 8)}`,
          allow_user_status_update: true,
          sprints_enabled: true,
          ...stamps,
          board_swimlanes: { create: lanes(final) },
        },
      })
    }
    const sprint = (id: string, start: string, end: string, isDeleted = false) =>
      prisma.sprints.create({
        data: {
          id,
          organization_id: orgId,
          board_id: boardC,
          name: `Sprint ${id.slice(0, 4)}`,
          start_date: new Date(`${start}T00:00:00.000Z`),
          end_date: new Date(`${end}T00:00:00.000Z`),
          state: 'Planned',
          is_deleted: isDeleted,
          ...stamps,
        },
      })
    await sprint(sprint1, '2026-10-01', '2026-10-14')
    await sprint(sprint2, '2026-10-10', '2026-10-28')
    await sprint(sprintGone, '2026-01-01', '2026-12-31', true)

    const outcome = (id: string, order: number, extra: { org?: string; deleted?: boolean } = {}) =>
      prisma.outcomes.create({
        data: {
          id,
          organization_id: extra.org ?? orgId,
          name: `Outcome ${order}`,
          target_start_date: new Date('2026-10-01T00:00:00.000Z'),
          target_end_date: new Date('2026-12-31T00:00:00.000Z'),
          sort_order: order,
          color: '#112233',
          is_deleted: extra.deleted ?? false,
          ...stamps,
        },
      })
    await outcome(ids.outcomeX, 0)
    await outcome(ids.outcomeY, 1)
    await outcome(ids.outcomeZ, 2)
    await outcome(ids.outcomeGone, 3, { deleted: true })
    await outcome(ids.outcomeForeign, 0, { org: otherOrgId })

    // Outcome X: three live top-level items, one of them done on its own board's final lane.
    await newIdea(ids.parentDone, boardP, FIN_P, { outcome: ids.outcomeX })
    await newIdea(ids.parentOpen, boardP, OPEN, { outcome: ids.outcomeX })
    await newIdea(ids.standaloneDone, boardC, FIN_C, { outcome: ids.outcomeX })
    // FIN_P is a lane of board P only: on board C this card has no lane, so it is not done.
    await newIdea(ids.noLaneOnC, boardC, FIN_P, { outcome: ids.outcomeX })
    // A soft-deleted grouped item is not counted or listed.
    await newIdea(ids.parentDeleted, boardP, FIN_P, { outcome: ids.outcomeX, deleted: true })
    // Tasks of X's parents.
    await newIdea(ids.taskDoneS1, boardC, FIN_C, { parent: ids.parentDone, sprint: sprint1 })
    await newIdea(ids.taskOpenS2, boardC, OPEN, { parent: ids.parentDone, sprint: sprint2 })
    await newIdea(ids.taskDeleted, boardC, FIN_C, {
      parent: ids.parentDone,
      sprint: sprint1,
      deleted: true,
    })
    await newIdea(ids.taskOpenGoneSprint, boardC, OPEN, {
      parent: ids.parentOpen,
      sprint: sprintGone,
    })
    await newIdea(ids.taskOfOpen, boardC, FIN_C, { parent: ids.parentOpen })
    // A task whose parent is soft-deleted is not X's.
    await newIdea(ids.taskOfDeletedParent, boardC, FIN_C, { parent: ids.parentDeleted })
    // Outcome Z: tasks but no sprint anywhere -> counts with a null span.
    await newIdea(ids.zParent, boardP, OPEN, { outcome: ids.outcomeZ })
    await newIdea(ids.zTask, boardC, FIN_C, { parent: ids.zParent })
    // An item grouped under a soft-deleted Outcome (only by raw insert) never shows on a read.
    await newIdea(ids.goneParented, boardP, OPEN, { outcome: ids.outcomeGone })
    // Ungrouped candidates.
    await newIdea(ids.freeNoBoard, null, OPEN)
    await newIdea(ids.freeOnP, boardP, OPEN)
    await newIdea(ids.freeDeleted, boardP, OPEN, { deleted: true })
    await newIdea(ids.freeForeign, null, OPEN, { org: otherOrgId })
    await prisma.idea_assignees.create({
      data: { id: randomUUID(), idea_id: ids.parentOpen, user_id: adminId },
    })
  })

  afterAll(async () => {
    const mine = { organization_id: { in: [orgId, otherOrgId] } }
    await prisma.idea_assignees.deleteMany({ where: { ideas: mine } })
    await prisma.ideas.deleteMany({ where: { ...mine, parent_idea_id: { not: null } } })
    await prisma.ideas.deleteMany({ where: mine })
    await prisma.outcomes.deleteMany({ where: mine })
    await prisma.sprints.deleteMany({ where: mine })
    await prisma.board_swimlanes.deleteMany({ where: { boards: mine } })
    await prisma.boards.deleteMany({ where: mine })
    await prisma.idea_types.deleteMany({ where: mine })
    await prisma.business_impacts.deleteMany({ where: mine })
    await prisma.statuses.deleteMany({ where: mine })
    await prisma.users.deleteMany({ where: mine })
    await prisma.organizations.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } })
    await prisma.$disconnect()
  })

  describe('rollups over two boards', () => {
    it('counts items and tasks by the final lane of each own board and spans the live sprints', async () => {
      const rollups = await repo().rollupsByOutcomeIds([ids.outcomeX])

      expect(rollups.get(ids.outcomeX)).toEqual({
        ideaCount: 4, // parentDone, parentOpen, standaloneDone, noLaneOnC; parentDeleted excluded
        doneIdeaCount: 2, // parentDone (P final) and standaloneDone (C final) - not noLaneOnC
        taskCount: 4, // taskDoneS1, taskOpenS2, taskOpenGoneSprint, taskOfOpen; the deleted task and the deleted parent's task are out
        doneTaskCount: 2,
        sprintStart: '2026-10-01',
        sprintEnd: '2026-10-28',
        metricTotals: [],
      })
    })

    it('reports null sprint start and end, with counts, when no task has a live sprint', async () => {
      const rollups = await repo().rollupsByOutcomeIds([ids.outcomeZ, ids.outcomeY])

      expect(rollups.get(ids.outcomeZ)).toEqual({
        ideaCount: 1,
        doneIdeaCount: 0,
        taskCount: 1,
        doneTaskCount: 1,
        sprintStart: null,
        sprintEnd: null,
        metricTotals: [],
      })
      expect(rollups.get(ids.outcomeY)).toEqual({
        ideaCount: 0,
        doneIdeaCount: 0,
        taskCount: 0,
        doneTaskCount: 0,
        sprintStart: null,
        sprintEnd: null,
        metricTotals: [],
      })
    })

    it('ignores a soft-deleted sprint in the span', async () => {
      const x = (await repo().rollupsByOutcomeIds([ids.outcomeX])).get(ids.outcomeX)
      expect(x?.sprintStart).not.toBe('2026-01-01')
      expect(x?.sprintEnd).not.toBe('2026-12-31')
    })

    it('returns an empty map for no ids', async () => {
      expect((await repo().rollupsByOutcomeIds([])).size).toBe(0)
    })
  })

  describe('soft-delete exclusion on every read', () => {
    it('leaves soft-deleted ideas out of the grouped list and the ungrouped list', async () => {
      const grouped = await repo().ideasByOutcomeIds([ids.outcomeX])
      const ungrouped = await repo().listUngroupedIdeas(orgId)

      expect(grouped.get(ids.outcomeX)?.map((i) => i.ideaId)).not.toContain(ids.parentDeleted)
      expect(ungrouped.map((i) => i.ideaId)).not.toContain(ids.freeDeleted)
    })

    it('lists only live Outcomes of the organization', async () => {
      const listed = await repo().listByOrganization(orgId)

      expect(listed.map((o) => o.id)).toEqual([ids.outcomeX, ids.outcomeY, ids.outcomeZ])
    })

    it('still returns a soft-deleted Outcome from getById so the service can decide', async () => {
      expect((await repo().getById(ids.outcomeGone))?.isDeleted).toBe(true)
    })

    it('answers 404 through the service for the deleted Outcome on get/update, and lists/roadmaps without it', async () => {
      const s = service()

      await expect(s.get(orgId, ids.outcomeGone)).rejects.toMatchObject({
        message: 'Outcome not found.',
      })
      expect((await s.list(orgId, undefined)).items.map((i) => i.outcomeId)).not.toContain(
        ids.outcomeGone,
      )
      expect((await s.roadmap(orgId)).outcomes.map((o) => o.outcomeId)).not.toContain(
        ids.outcomeGone,
      )
    })
  })

  describe('grouped and ungrouped reads', () => {
    it('lists each grouped top-level item with assignees, effort and sprint fields', async () => {
      const grouped = await repo().ideasByOutcomeIds([ids.outcomeX, ids.outcomeY])

      expect(
        grouped
          .get(ids.outcomeX)
          ?.map((i) => i.ideaId)
          .sort(),
      ).toEqual([ids.parentDone, ids.parentOpen, ids.standaloneDone, ids.noLaneOnC].sort())
      expect(grouped.get(ids.outcomeY)).toBeUndefined()
      const open = grouped.get(ids.outcomeX)?.find((i) => i.ideaId === ids.parentOpen)
      expect(open).toMatchObject({
        assigneeUserIds: [adminId],
        effort: null,
        sprintId: null,
        sprintStart: null,
        sprintEnd: null,
      })
      expect(Object.keys(open ?? {}).sort()).toEqual(
        [
          'assigneeUserIds',
          'effort',
          'ideaId',
          'metrics',
          'sprintEnd',
          'sprintId',
          'sprintStart',
          'statusId',
          'title',
        ].sort(),
      )
    })

    it('does not list a task, an item under a deleted Outcome, or another organization item as ungrouped', async () => {
      const ungrouped = (await repo().listUngroupedIdeas(orgId)).map((i) => i.ideaId)

      expect(ungrouped.sort()).toEqual([ids.freeNoBoard, ids.freeOnP].sort())
      for (const task of [ids.taskDoneS1, ids.taskOpenS2, ids.taskOfOpen, ids.zTask]) {
        expect(ungrouped).not.toContain(task)
      }
      expect(ungrouped).not.toContain(ids.freeForeign)
      expect(ungrouped).not.toContain(ids.goneParented)
    })

    it('roadmap carries {outcomes, ungrouped}: live Outcomes in order with rollups, children excluded from ungrouped', async () => {
      const roadmap = await service().roadmap(orgId)

      expect(roadmap.outcomes.map((o) => o.outcomeId)).toEqual([
        ids.outcomeX,
        ids.outcomeY,
        ids.outcomeZ,
      ])
      expect(roadmap.outcomes[0]).toMatchObject({ ideaCount: 4, taskCount: 4 })
      expect(roadmap.outcomes[0]?.ideas).toHaveLength(4)
      expect(roadmap.outcomes[1]?.ideas).toEqual([])
      expect(roadmap.ungrouped.map((i) => i.ideaId).sort()).toEqual(
        [ids.freeNoBoard, ids.freeOnP].sort(),
      )
    })

    it('a Read Only member reads the same roadmap', async () => {
      const readOnly = { ...admin(), role: Role.ReadOnly }
      expect((await service(readOnly).roadmap(orgId)).outcomes).toHaveLength(3)
    })

    it('scopes to the organization: the other organization sees only its own', async () => {
      const otherAdmin = { ...admin(), organizationId: otherOrgId }
      const roadmap = await service(otherAdmin).roadmap(otherOrgId)

      expect(roadmap.outcomes.map((o) => o.outcomeId)).toEqual([ids.outcomeForeign])
      expect(roadmap.ungrouped.map((i) => i.ideaId)).toEqual([ids.freeForeign])
    })
  })

  describe('OutcomeService over the real repositories', () => {
    it('creates at the end, pages the list, reorders partially, and deletes with ungrouping', async () => {
      const s = service()
      const created: string[] = []
      for (let n = 0; n < 22; n++) {
        const made = await s.create(orgId, {
          name: `Bulk ${n}`,
          description: null,
          targetStartDate: '2026-10-01',
          targetEndDate: '2026-10-31',
          ownerUserId: null,
          color: null,
        })
        created.push(made.outcomeId)
        expect(made.sortOrder).toBe(3 + n) // X, Y, Z occupy 0..2; the deleted one does not count
        expect(made.color).toMatch(/^#[0-9A-F]{6}$/)
        expect(made).toMatchObject({ ideaCount: 0, sprintStart: null })
      }

      const first = await s.list(orgId, undefined)
      const second = await s.list(orgId, { page: 2, pageSize: 20 })
      expect(first).toMatchObject({ page: 1, pageSize: 20, totalCount: 25, sortBy: 'sortOrder' })
      expect(first.items.map((i) => i.sortOrder)).toEqual(Array.from({ length: 20 }, (_, n) => n))
      expect(second.items.map((i) => i.outcomeId)).toEqual(created.slice(17))

      // Partial reorder: move the last two to the front, the rest keep their relative order.
      const [lastA, lastB] = created.slice(-2) as [string, string]
      await s.reorder(orgId, [lastB, lastA])
      const reordered = (await s.list(orgId, { page: 1, pageSize: 100 })).items
      expect(reordered.map((i) => i.sortOrder)).toEqual(Array.from({ length: 25 }, (_, n) => n))
      expect(reordered.slice(0, 5).map((i) => i.outcomeId)).toEqual([
        lastB,
        lastA,
        ids.outcomeX,
        ids.outcomeY,
        ids.outcomeZ,
      ])

      for (const id of created) {
        await s.delete(orgId, id)
      }
      expect((await s.list(orgId, undefined)).totalCount).toBe(3)
    })

    it('groups a standalone child-board card, moves it, refuses a task, ungroups, and writes no audit for a no-op', async () => {
      const s = service()
      events.length = 0

      await expect(s.setIdeaOutcome(ids.freeOnP, ids.outcomeY)).resolves.toEqual({
        ideaId: ids.freeOnP,
        outcomeId: ids.outcomeY,
      })
      expect(await outcomeOf(ids.freeOnP)).toBe(ids.outcomeY)
      await s.setIdeaOutcome(ids.freeOnP, ids.outcomeY)
      expect(events.map((e) => e.eventType)).toEqual(['IssueOutcomeGroupingChanged'])

      await s.setIdeaOutcome(ids.freeOnP, ids.outcomeZ)
      expect(await outcomeOf(ids.freeOnP)).toBe(ids.outcomeZ)

      await expect(s.setIdeaOutcome(ids.taskOpenS2, ids.outcomeY)).rejects.toMatchObject({
        code: 'taskCannotBeGrouped',
      })
      expect(await outcomeOf(ids.taskOpenS2)).toBeNull()

      await expect(s.setIdeaOutcome(ids.standaloneDone, ids.outcomeGone)).rejects.toMatchObject({
        failures: { outcomeId: ['Outcome not found.'] },
      })
      await expect(s.setIdeaOutcome(ids.standaloneDone, ids.outcomeForeign)).rejects.toMatchObject({
        failures: { outcomeId: ['Outcome not found.'] },
      })
      expect(await outcomeOf(ids.standaloneDone)).toBe(ids.outcomeX)

      await s.setIdeaOutcome(ids.freeOnP, null)
      expect(await outcomeOf(ids.freeOnP)).toBeNull()
    })

    it('a delete ungroups every item and deletes none, and a repeat delete is silent', async () => {
      const s = service()
      const doomed = await s.create(orgId, {
        name: 'Doomed',
        description: null,
        targetStartDate: '2026-10-01',
        targetEndDate: '2026-10-31',
        ownerUserId: null,
        color: null,
      })
      await s.setIdeaOutcome(ids.freeNoBoard, doomed.outcomeId)
      await s.setIdeaOutcome(ids.freeOnP, doomed.outcomeId)
      events.length = 0

      await s.delete(orgId, doomed.outcomeId)
      await s.delete(orgId, doomed.outcomeId)

      expect(await outcomeOf(ids.freeNoBoard)).toBeNull()
      expect(await outcomeOf(ids.freeOnP)).toBeNull()
      const stillThere = await prisma.ideas.count({
        where: { id: { in: [ids.freeNoBoard, ids.freeOnP] }, is_deleted: false },
      })
      expect(stillThere).toBe(2)
      expect(events.map((e) => e.eventType)).toEqual(['OutcomeDeleted'])
      const row = await prisma.outcomes.findUniqueOrThrow({ where: { id: doomed.outcomeId } })
      expect(row.is_deleted).toBe(true)
      await expect(s.get(orgId, doomed.outcomeId)).rejects.toMatchObject({
        message: 'Outcome not found.',
      })
      await expect(s.delete(orgId, randomUUID())).rejects.toMatchObject({
        message: 'Outcome not found.',
      })
    })

    it('update persists a full replacement, keeps the colour when absent, and writes one audit per real change', async () => {
      const s = service()
      const made = await s.create(orgId, {
        name: 'Before',
        description: 'old',
        targetStartDate: '2026-10-01',
        targetEndDate: '2026-10-31',
        ownerUserId: null,
        color: '#abcdef',
      })
      events.length = 0

      const same = {
        name: 'Before',
        description: 'old',
        targetStartDate: '2026-10-01',
        targetEndDate: '2026-10-31',
        ownerUserId: null,
      }
      await s.update(orgId, made.outcomeId, { ...same, color: undefined })
      expect(events).toHaveLength(0)

      const updated = await s.update(orgId, made.outcomeId, {
        ...same,
        name: 'After',
        description: null,
        targetEndDate: '2026-11-30',
        color: undefined,
      })
      expect(updated).toMatchObject({
        name: 'After',
        description: null,
        targetEndDate: '2026-11-30',
        color: '#ABCDEF',
        sortOrder: made.sortOrder,
      })
      expect(events.map((e) => e.eventType)).toEqual(['OutcomeUpdated'])
      expect(JSON.parse(events[0]?.metadataJson ?? '{}').changes).toEqual({
        name: { from: 'Before', to: 'After' },
        description: { from: 'old', to: null },
        targetEndDate: { from: '2026-10-31', to: '2026-11-30' },
      })
      await s.delete(orgId, made.outcomeId)
    })
  })

  describe('persistence invariants', () => {
    it('ON DELETE SET NULL: removing an Outcome row ungroups its items and deletes none', async () => {
      const tempOutcome = randomUUID()
      const tempIdea = randomUUID()
      await prisma.outcomes.create({
        data: {
          id: tempOutcome,
          organization_id: orgId,
          name: 'Temp',
          target_start_date: new Date('2026-10-01T00:00:00.000Z'),
          target_end_date: new Date('2026-10-02T00:00:00.000Z'),
          sort_order: 99,
          color: '#112233',
          is_deleted: false,
          ...stamps,
        },
      })
      await newIdea(tempIdea, boardP, OPEN, { outcome: tempOutcome })

      await prisma.outcomes.delete({ where: { id: tempOutcome } })

      const row = await prisma.ideas.findUniqueOrThrow({ where: { id: tempIdea } })
      expect(row.outcome_id).toBeNull()
      expect(row.is_deleted).toBe(false)
    })

    it('saving an idea through the repository never nulls outcome_id', async () => {
      const unitOfWork = new PrismaUnitOfWork(prisma)
      const ideas = new PrismaIdeaRepository(prisma, unitOfWork)
      const target = ids.parentOpen
      const before = await ideas.getById(target)
      expect(before?.outcomeId).toBe(ids.outcomeX)
      if (!before) throw new Error('fixture idea missing')

      const edits = [
        (i: typeof before) =>
          updateIdeaContent(
            i,
            {
              title: 'Edited title',
              description: i.description,
              problem: i.problem,
              proposedSolutions: i.proposedSolutions,
              impactRationale: i.impactRationale,
              priority: i.priority,
              businessImpactId: i.businessImpactId,
              dueDate: i.dueDate,
            },
            NOW,
            adminId,
          ),
        (i: typeof before) => changeIdeaStatus(i, FIN_P, NOW, adminId),
        (i: typeof before) => replaceIdeaAssignees(i, [], NOW, adminId),
      ]
      for (const edit of edits) {
        const current = await ideas.getById(target)
        if (!current) throw new Error('fixture idea missing')
        await ideas.update(edit(current))
        await unitOfWork.saveChanges()
        expect(await outcomeOf(target)).toBe(ids.outcomeX)
      }
      // The first edit must have actually saved, or the loop proved nothing.
      expect((await ideas.getById(target))?.title).toBe('Edited title')
    })
  })
})
