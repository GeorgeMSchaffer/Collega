// Live-database QA for sprints per board (SPEC/contracts/sprints.md "Sprints per board", plan
// Ruling 9): the sprint and board repositories, the done counts, and SprintService driven over the
// real repositories for create guards, completion carry-over and deletion, with a legacy
// (`board_id` null) sprint beside them to show its behaviour unchanged.
//
// Skipped unless `DATABASE_URL` is set. It builds its own organization and removes it afterwards.

import { randomUUID } from 'node:crypto'
import type { AuditEventInput, CurrentUserContext } from '@collega/application/common'
import { SprintService } from '@collega/application/sprints'
import { Role } from '@collega/domain/enums'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaUnitOfWork } from '../src/persistence/unit-of-work.js'
import { PrismaBoardRepository } from '../src/repositories/board.repository.js'
import { PrismaIdeaRepository } from '../src/repositories/idea.repository.js'
import { PrismaSprintRepository } from '../src/repositories/sprint.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const AT = new Date('2026-10-15T09:00:00.000Z')
const NOW = new Date('2026-10-16T09:00:00.000Z')

describe.skipIf(!DATABASE_URL)('Board sprints QA against a live database', () => {
  const prisma = new PrismaClient()
  const marker = randomUUID()
  const organizationId = randomUUID()
  const adminId = randomUUID()
  const ideaTypeId = randomUUID()
  const impactId = randomUUID()
  const [OPEN, MID, DONE, SHIPPED] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()]
  const boardId = randomUUID()
  const otherBoardId = randomUUID()
  const offBoardId = randomUUID()
  const archivedBoardId = randomUUID()
  const noFinalBoardId = randomUUID()
  const stamps = { created_at_utc: AT, updated_at_utc: AT }
  const events: AuditEventInput[] = []

  function service() {
    const unitOfWork = new PrismaUnitOfWork(prisma)
    const currentUser: CurrentUserContext = {
      isAuthenticated: true,
      userId: adminId,
      organizationId,
      role: Role.OrgAdmin,
      isImpersonating: false,
      realUserId: adminId,
    }
    const ideas = new PrismaIdeaRepository(prisma, unitOfWork)
    return new SprintService(
      new PrismaSprintRepository(prisma, unitOfWork),
      ideas,
      { listByIds: async () => [] },
      unitOfWork,
      {
        write: async (event: AuditEventInput) => {
          events.push(event)
        },
      },
      currentUser,
      { now: () => NOW },
      new PrismaBoardRepository(prisma, unitOfWork),
      new PrismaBoardRepository(prisma, unitOfWork),
    )
  }

  async function newSprint(board: string | null, state = 'Active'): Promise<string> {
    const id = randomUUID()
    await prisma.sprints.create({
      data: {
        id,
        organization_id: organizationId,
        board_id: board,
        name: `Probe sprint ${id.slice(0, 4)}`,
        start_date: new Date('2026-10-01T00:00:00.000Z'),
        end_date: new Date('2026-10-14T00:00:00.000Z'),
        state: state as never,
        is_deleted: false,
        ...stamps,
      },
    })
    return id
  }

  async function newIdea(
    board: string | null,
    statusId: string,
    sprintId: string | null,
    extra: {
      phase?: 'Discovery' | 'Delivery'
      delivery?: 'Complete' | 'Development' | 'Pending'
      deleted?: boolean
    } = {},
  ): Promise<string> {
    const id = randomUUID()
    await prisma.ideas.create({
      data: {
        id,
        organization_id: organizationId,
        board_id: board,
        status_id: statusId,
        sprint_id: sprintId,
        title: `Probe idea ${id}`,
        problem: 'Probe problem.',
        proposed_solutions: ['Probe solution.'],
        impact_rationale: 'Probe rationale.',
        priority: 'Medium',
        idea_type_id: ideaTypeId,
        business_impact_id: impactId,
        author_user_id: adminId,
        is_deleted: extra.deleted ?? false,
        phase: extra.phase ?? 'Discovery',
        delivery_status: extra.delivery ?? null,
        effort: extra.phase === 'Delivery' ? 'Medium' : null,
        ...stamps,
      },
    })
    return id
  }

  const sprintOf = async (ideaId: string) =>
    (await prisma.ideas.findUniqueOrThrow({ where: { id: ideaId } })).sprint_id

  beforeAll(async () => {
    await prisma.organizations.create({
      data: {
        id: organizationId,
        title: `probe-org-${marker}`,
        description: 'Board sprints QA probe.',
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
    for (const [order, id] of [OPEN, MID, DONE, SHIPPED].entries()) {
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
    const lane = (statusId: string, order: number, isFinal: boolean) => ({
      id: randomUUID(),
      status_id: statusId,
      display_order: order,
      is_final: isFinal,
    })
    const boardSpecs = [
      // Two final lanes on the main board.
      [
        boardId,
        true,
        false,
        [lane(OPEN, 0, false), lane(MID, 1, false), lane(DONE, 2, true), lane(SHIPPED, 3, true)],
      ],
      [otherBoardId, true, false, [lane(OPEN, 0, false), lane(DONE, 1, true)]],
      [offBoardId, false, false, [lane(OPEN, 0, false), lane(DONE, 1, true)]],
      [archivedBoardId, true, true, [lane(OPEN, 0, false), lane(DONE, 1, true)]],
      [noFinalBoardId, true, false, [lane(OPEN, 0, false), lane(MID, 1, false)]],
    ] as const
    for (const [id, sprintsEnabled, isArchived, lanes] of boardSpecs) {
      await prisma.boards.create({
        data: {
          id,
          organization_id: organizationId,
          name: `Board ${id}`,
          allow_user_status_update: true,
          sprints_enabled: sprintsEnabled,
          is_archived: isArchived,
          ...stamps,
          board_swimlanes: { create: [...lanes] },
        },
      })
    }
  })

  afterAll(async () => {
    await prisma.ideas.deleteMany({ where: { organization_id: organizationId } })
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

  describe('getSprintBoard', () => {
    it('reports every final lane, in the board sprint-enabled and archived flags', async () => {
      const boards = new PrismaBoardRepository(prisma, new PrismaUnitOfWork(prisma))

      const main = await boards.getSprintBoard(boardId)
      expect([...(main?.finalStatusIds ?? [])].sort()).toEqual([DONE, SHIPPED].sort())
      expect(main).toMatchObject({ sprintsEnabled: true, isArchived: false, organizationId })
      expect(await boards.getSprintBoard(offBoardId)).toMatchObject({ sprintsEnabled: false })
      expect(await boards.getSprintBoard(archivedBoardId)).toMatchObject({ isArchived: true })
      expect((await boards.getSprintBoard(noFinalBoardId))?.finalStatusIds).toEqual([])
    })

    it('answers null for an unknown board', async () => {
      const boards = new PrismaBoardRepository(prisma, new PrismaUnitOfWork(prisma))

      expect(await boards.getSprintBoard(randomUUID())).toBeNull()
    })
  })

  describe('sprint repository', () => {
    it('round-trips board_id, and a legacy sprint reads boardId null', async () => {
      const unitOfWork = new PrismaUnitOfWork(prisma)
      const sprints = new PrismaSprintRepository(prisma, unitOfWork)
      const boardSprint = await newSprint(boardId, 'Planned')
      const legacy = await newSprint(null, 'Planned')

      expect((await sprints.getById(boardSprint))?.boardId).toBe(boardId)
      expect((await sprints.getById(legacy))?.boardId).toBeNull()
    })

    it('lists by board without deleted, other-board or legacy sprints, and filters by state', async () => {
      const sprints = new PrismaSprintRepository(prisma, new PrismaUnitOfWork(prisma))
      const board = randomUUID()
      await prisma.boards.create({
        data: {
          id: board,
          organization_id: organizationId,
          name: 'Listing board',
          allow_user_status_update: true,
          sprints_enabled: true,
          ...stamps,
        },
      })
      const planned = await newSprint(board, 'Planned')
      const active = await newSprint(board, 'Active')
      const completed = await newSprint(board, 'Completed')
      const deleted = await newSprint(board, 'Planned')
      await prisma.sprints.update({ where: { id: deleted }, data: { is_deleted: true } })
      await newSprint(otherBoardId)
      await newSprint(null)

      const all = (await sprints.listByBoard(board, null)).map((s) => s.id)
      expect(all.sort()).toEqual([planned, active, completed].sort())
      expect((await sprints.listByBoard(board, 'Active' as never)).map((s) => s.id)).toEqual([
        active,
      ])
      expect(await sprints.listByBoard(randomUUID(), null)).toEqual([])
    })

    it('keeps the organization list returning legacy and board sprints alike', async () => {
      const sprints = new PrismaSprintRepository(prisma, new PrismaUnitOfWork(prisma))
      const board = await newSprint(boardId, 'Planned')
      const legacy = await newSprint(null, 'Planned')

      const ids = (await sprints.listByOrganization(organizationId, null)).map((s) => s.id)

      expect(ids).toEqual(expect.arrayContaining([board, legacy]))
    })
  })

  describe('SprintService.createForBoard over the real repositories', () => {
    it('stores a Planned sprint on the board and lists it back', async () => {
      const created = await service().createForBoard(boardId, {
        name: 'Created through the service',
        goal: null,
        startDate: '2026-11-02',
        endDate: '2026-11-15',
        ownerUserId: null,
      })

      expect(created).toMatchObject({ boardId, state: 'Planned', issueCount: 0, doneCount: 0 })
      const row = await prisma.sprints.findUniqueOrThrow({ where: { id: created.sprintId } })
      expect(row.board_id).toBe(boardId)
      expect((await service().listForBoard(boardId, null)).map((s) => s.sprintId)).toContain(
        created.sprintId,
      )
    })

    it('writes no row when sprints are off (422), the board is archived (409) or unknown (404)', async () => {
      const command = {
        name: 'Refused sprint',
        goal: null,
        startDate: '2026-11-02',
        endDate: '2026-11-15',
        ownerUserId: null,
      }

      await expect(service().createForBoard(offBoardId, command)).rejects.toMatchObject({
        code: 'sprintsNotEnabled',
      })
      await expect(service().createForBoard(archivedBoardId, command)).rejects.toMatchObject({
        kind: 'conflict',
      })
      await expect(service().createForBoard(randomUUID(), command)).rejects.toMatchObject({
        kind: 'notFound',
      })
      expect(await prisma.sprints.count({ where: { name: 'Refused sprint' } })).toBe(0)
    })
  })

  describe('countsBySprintIds', () => {
    it('counts done by the final lane of the item own board and ignores deleted items', async () => {
      const ideas = new PrismaIdeaRepository(prisma, new PrismaUnitOfWork(prisma))
      const sprint = await newSprint(boardId)
      await newIdea(boardId, OPEN, sprint)
      await newIdea(boardId, MID, sprint)
      await newIdea(boardId, DONE, sprint)
      await newIdea(boardId, SHIPPED, sprint)
      await newIdea(boardId, DONE, sprint, { deleted: true })
      // Delivery status Complete outside a final lane is not done on a board sprint.
      await newIdea(boardId, OPEN, sprint, { phase: 'Delivery', delivery: 'Complete' })
      // A status that is not a lane of the item's board is not done.
      await newIdea(noFinalBoardId, DONE, sprint)

      const counts = await ideas.countsBySprintIds([sprint])

      expect(counts.get(sprint)).toMatchObject({ issueCount: 6, doneCount: 2 })
    })

    it('reports a board with no final lane as nothing done', async () => {
      const ideas = new PrismaIdeaRepository(prisma, new PrismaUnitOfWork(prisma))
      const sprint = await newSprint(noFinalBoardId)
      await newIdea(noFinalBoardId, OPEN, sprint)
      await newIdea(noFinalBoardId, MID, sprint)

      expect((await ideas.countsBySprintIds([sprint])).get(sprint)).toMatchObject({
        issueCount: 2,
        doneCount: 0,
      })
    })

    it('leaves an empty sprint out of the map', async () => {
      const ideas = new PrismaIdeaRepository(prisma, new PrismaUnitOfWork(prisma))
      const sprint = await newSprint(boardId)

      expect((await ideas.countsBySprintIds([sprint])).has(sprint)).toBe(false)
      expect((await ideas.countsBySprintIds([])).size).toBe(0)
    })

    it('keeps the delivery-status rule on a legacy sprint, whatever lane the item sits in', async () => {
      const ideas = new PrismaIdeaRepository(prisma, new PrismaUnitOfWork(prisma))
      const sprint = await newSprint(null)
      // Complete counts as done even outside a final lane; a final lane alone does not.
      await newIdea(boardId, OPEN, sprint, { phase: 'Delivery', delivery: 'Complete' })
      await newIdea(boardId, DONE, sprint, { phase: 'Delivery', delivery: 'Development' })
      await newIdea(null, DONE, sprint, { phase: 'Delivery', delivery: 'Pending' })
      await newIdea(null, OPEN, sprint, { phase: 'Delivery', delivery: 'Complete' })

      expect((await ideas.countsBySprintIds([sprint])).get(sprint)).toMatchObject({
        issueCount: 4,
        doneCount: 2,
      })
    })

    it('counts several sprints of both kinds in one call', async () => {
      const ideas = new PrismaIdeaRepository(prisma, new PrismaUnitOfWork(prisma))
      const board = await newSprint(boardId)
      const legacy = await newSprint(null)
      await newIdea(boardId, DONE, board)
      await newIdea(null, OPEN, legacy, { phase: 'Delivery', delivery: 'Complete' })
      await newIdea(null, OPEN, legacy, { phase: 'Delivery', delivery: 'Development' })

      const counts = await ideas.countsBySprintIds([board, legacy])

      expect(counts.get(board)).toMatchObject({ issueCount: 1, doneCount: 1 })
      expect(counts.get(legacy)).toMatchObject({ issueCount: 2, doneCount: 1 })
    })
  })

  describe('completing and deleting through SprintService', () => {
    it('carries over the items outside a final lane, keeps the rest, and agrees with the counts', async () => {
      const sprint = await newSprint(boardId)
      const open = await newIdea(boardId, OPEN, sprint)
      const mid = await newIdea(boardId, MID, sprint)
      const done = await newIdea(boardId, DONE, sprint)
      const shipped = await newIdea(boardId, SHIPPED, sprint)
      // A Delivery-phase item Complete but not in a final lane: still carried over.
      const deliveryOpen = await newIdea(boardId, OPEN, sprint, {
        phase: 'Delivery',
        delivery: 'Complete',
      })
      const deletedItem = await newIdea(boardId, OPEN, sprint, { deleted: true })
      const ideas = new PrismaIdeaRepository(prisma, new PrismaUnitOfWork(prisma))
      const before = (await ideas.countsBySprintIds([sprint])).get(sprint)
      events.length = 0

      await service().complete(organizationId, sprint)

      expect(await sprintOf(open)).toBeNull()
      expect(await sprintOf(mid)).toBeNull()
      expect(await sprintOf(deliveryOpen)).toBeNull()
      expect(await sprintOf(done)).toBe(sprint)
      expect(await sprintOf(shipped)).toBe(sprint)
      // The soft-deleted item is not touched.
      expect(await sprintOf(deletedItem)).toBe(sprint)
      expect((await prisma.sprints.findUniqueOrThrow({ where: { id: sprint } })).state).toBe(
        'Completed',
      )
      // complete() and the counts agree: what stayed is exactly what was counted done.
      const after = (await ideas.countsBySprintIds([sprint])).get(sprint)
      expect(before).toMatchObject({ issueCount: 5, doneCount: 2 })
      expect(after).toMatchObject({ issueCount: 2, doneCount: 2 })
      expect(JSON.parse(events[0]?.metadataJson ?? '{}')).toMatchObject({
        carriedOverIssueCount: 3,
      })
    })

    it('carries over everything on a board with no final lane', async () => {
      const sprint = await newSprint(noFinalBoardId)
      const a = await newIdea(noFinalBoardId, OPEN, sprint)
      const b = await newIdea(noFinalBoardId, MID, sprint)

      await service().complete(organizationId, sprint)

      expect(await sprintOf(a)).toBeNull()
      expect(await sprintOf(b)).toBeNull()
    })

    it('leaves a legacy sprint on the delivery-status rule', async () => {
      const sprint = await newSprint(null)
      const complete = await newIdea(null, OPEN, sprint, {
        phase: 'Delivery',
        delivery: 'Complete',
      })
      const inFinalLane = await newIdea(boardId, DONE, sprint, {
        phase: 'Delivery',
        delivery: 'Development',
      })
      const development = await newIdea(null, OPEN, sprint, {
        phase: 'Delivery',
        delivery: 'Development',
      })

      await service().complete(organizationId, sprint)

      expect(await sprintOf(complete)).toBe(sprint)
      expect(await sprintOf(inFinalLane)).toBeNull()
      expect(await sprintOf(development)).toBeNull()
    })

    it('deleting a board sprint clears every live item, any phase and lane, and soft-deletes it', async () => {
      const sprint = await newSprint(boardId, 'Planned')
      const open = await newIdea(boardId, OPEN, sprint)
      const done = await newIdea(boardId, DONE, sprint)
      const delivery = await newIdea(boardId, OPEN, sprint, {
        phase: 'Delivery',
        delivery: 'Complete',
      })

      await service().delete(organizationId, sprint)

      expect(await sprintOf(open)).toBeNull()
      expect(await sprintOf(done)).toBeNull()
      expect(await sprintOf(delivery)).toBeNull()
      expect((await prisma.sprints.findUniqueOrThrow({ where: { id: sprint } })).is_deleted).toBe(
        true,
      )
    })

    it('deleting a legacy sprint unassigns its Issues and soft-deletes it', async () => {
      const sprint = await newSprint(null, 'Planned')
      const issue = await newIdea(null, OPEN, sprint, { phase: 'Delivery', delivery: 'Pending' })

      await service().delete(organizationId, sprint)

      expect(await sprintOf(issue)).toBeNull()
      expect((await prisma.sprints.findUniqueOrThrow({ where: { id: sprint } })).is_deleted).toBe(
        true,
      )
    })
  })
})
