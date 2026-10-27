// Live-database QA for sprint create-with-tasks and bulk assignment (SPEC/contracts/sprints.md
// "Backlog and sprint planning"): the real IdeaService and SprintService over the Prisma
// repositories. What the unit suites fake is proved here: the sprint and its assignments commit as
// one transaction or not at all (a trigger makes the commit itself fail), the audit rows, a lane
// drop moving several items into an autoCreateTask reference lane in one request with item
// numbers that do not collide, and two such requests racing.
//
// Skipped unless `DATABASE_URL` is set; builds its own organization and removes it afterwards. The
// poison trigger it installs matches one title prefix and is dropped in `afterAll`.
//
// Each call builds a FRESH set of services: the unit of work is a command buffer.

import { randomUUID } from 'node:crypto'
import { type CurrentUserContext, ForbiddenError } from '@collega/application/common'
import { IdeaService } from '@collega/application/ideas'
import { SprintService } from '@collega/application/sprints'
import { Role } from '@collega/domain/enums'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaUnitOfWork } from '../src/persistence/unit-of-work.js'
import { PrismaAuditEventWriter } from '../src/repositories/audit-event.repository.js'
import { PrismaBoardRepository } from '../src/repositories/board.repository.js'
import { IdeaCommentsLookupRepository } from '../src/repositories/comment.repository.js'
import { PrismaIdeaRepository } from '../src/repositories/idea.repository.js'
import { IdeaClassificationRepository } from '../src/repositories/idea-classification.repository.js'
import { PrismaIdeaDependencyRepository } from '../src/repositories/idea-dependency.repository.js'
import { PrismaIdeaFieldValuesRepository } from '../src/repositories/idea-field-values.repository.js'
import { PrismaIdeaFollowerRepository } from '../src/repositories/idea-follower.repository.js'
import { PrismaIdeaUpvoteRepository } from '../src/repositories/idea-upvote.repository.js'
import { PrismaIssueTaskRepository } from '../src/repositories/issue-task.repository.js'
import { PrismaSprintRepository } from '../src/repositories/sprint.repository.js'
import { PrismaTagRepository } from '../src/repositories/tag.repository.js'
import { PrismaUserRepository } from '../src/repositories/user.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const CREATED = new Date('2026-10-15T09:00:00.000Z')
const SAVED = new Date('2026-10-16T12:00:00.000Z')
const POISON = 'qa325-poison'

describe.skipIf(!DATABASE_URL)(
  'Sprint create-with-tasks and bulk assignment, live database',
  () => {
    const prisma = new PrismaClient()
    const marker = randomUUID()
    const tag = marker.slice(0, 3).toUpperCase()
    const triggerName = `qa325_poison_${marker.slice(0, 8).replaceAll('-', '')}`
    const organizationId = randomUUID()
    const adminId = randomUUID()
    const memberId = randomUUID()
    const ideaTypeId = randomUUID()
    const impactId = randomUUID()
    const stamps = { created_at_utc: CREATED, updated_at_utc: CREATED }
    const [L0, L1, L2, REF, OUT, C_OPEN, C_DONE] = Array.from({ length: 7 }, () =>
      randomUUID(),
    ) as [string, string, string, string, string, string, string]

    const admin: CurrentUserContext = {
      isAuthenticated: true,
      userId: adminId,
      organizationId,
      role: Role.OrgAdmin,
      isImpersonating: false,
      realUserId: adminId,
    }
    const member: CurrentUserContext = {
      ...admin,
      userId: memberId,
      realUserId: memberId,
      role: Role.User,
    }

    function services(currentUser: CurrentUserContext = admin) {
      const unitOfWork = new PrismaUnitOfWork(prisma)
      const boards = new PrismaBoardRepository(prisma, unitOfWork)
      const ideas = new PrismaIdeaRepository(prisma, unitOfWork)
      const audit = new PrismaAuditEventWriter(prisma)
      const clock = { now: () => SAVED }
      const ideaService = new IdeaService(
        ideas,
        boards,
        new PrismaUserRepository(prisma, unitOfWork),
        new PrismaTagRepository(prisma),
        new IdeaCommentsLookupRepository(prisma),
        new IdeaClassificationRepository(prisma),
        new PrismaIdeaFieldValuesRepository(prisma),
        new PrismaIdeaUpvoteRepository(prisma, unitOfWork),
        new PrismaSprintRepository(prisma, unitOfWork),
        new PrismaIssueTaskRepository(prisma, unitOfWork),
        { notify: async () => {} },
        new PrismaIdeaFollowerRepository(prisma, unitOfWork),
        new PrismaIdeaDependencyRepository(prisma, unitOfWork),
        unitOfWork,
        audit,
        currentUser,
        clock,
        { nextInt: () => 0 },
        boards,
      )
      const sprintService = new SprintService(
        new PrismaSprintRepository(prisma, unitOfWork),
        ideas,
        { listByIds: async () => [] },
        unitOfWork,
        audit,
        currentUser,
        clock,
        boards,
      )
      return { ideaService, sprintService }
    }

    let counter = 0
    async function newBoard(
      lanes: { statusId: string; isFinal?: boolean; refs?: string; auto?: boolean }[],
      options: { sprints?: boolean; prefix?: string | null } = {},
    ): Promise<string> {
      const id = randomUUID()
      await prisma.boards.create({
        data: {
          id,
          organization_id: organizationId,
          name: `Assign QA ${id}`,
          key_prefix: options.prefix === undefined ? `Q${++counter}${tag}` : options.prefix,
          next_item_number: 1,
          allow_user_status_update: true,
          sprints_enabled: options.sprints ?? true,
          ...stamps,
          board_swimlanes: {
            create: lanes.map((lane, order) => ({
              id: randomUUID(),
              status_id: lane.statusId,
              display_order: order,
              is_final: lane.isFinal ?? false,
              references_board_id: lane.refs ?? null,
              auto_create_task: lane.auto ?? false,
            })),
          },
        },
      })
      return id
    }

    /** Numbers the item from the board's own counter, as the application does. */
    async function newIdea(input: {
      boardId: string
      statusId: string
      sprintId?: string | null
      title?: string
      effort?: 'Low' | 'Medium' | 'High' | null
      parentId?: string | null
    }): Promise<string> {
      const id = randomUUID()
      const board = await prisma.boards.update({
        where: { id: input.boardId },
        data: { next_item_number: { increment: 1 } },
        select: { next_item_number: true },
      })
      await prisma.ideas.create({
        data: {
          id,
          organization_id: organizationId,
          board_id: input.boardId,
          status_id: input.statusId,
          sprint_id: input.sprintId ?? null,
          parent_idea_id: input.parentId ?? null,
          item_number: board.next_item_number - 1,
          title: input.title ?? `Assign QA ${id}`,
          problem: 'p',
          proposed_solutions: ['s'],
          impact_rationale: 'r',
          priority: 'Medium',
          idea_type_id: ideaTypeId,
          business_impact_id: impactId,
          author_user_id: adminId,
          is_deleted: false,
          phase: 'Discovery',
          effort: input.effort === undefined ? 'Medium' : input.effort,
          ...stamps,
        },
      })
      return id
    }

    async function newSprint(
      boardId: string,
      state: 'Planned' | 'Active' | 'Completed' = 'Planned',
    ) {
      const id = randomUUID()
      await prisma.sprints.create({
        data: {
          id,
          organization_id: organizationId,
          board_id: boardId,
          name: `Sprint ${id.slice(0, 6)}`,
          start_date: new Date('2026-10-01T00:00:00.000Z'),
          end_date: new Date('2026-10-14T00:00:00.000Z'),
          state,
          is_deleted: false,
          ...stamps,
        },
      })
      return id
    }

    const COMMAND = {
      goal: null,
      startDate: '2026-11-02',
      endDate: '2026-11-15',
      ownerUserId: null,
    }
    const row = (id: string) => prisma.ideas.findUniqueOrThrow({ where: { id } })
    const auditRows = (ideaIds: string[], eventType?: string) =>
      prisma.audit_events.findMany({
        where: { entity_id: { in: ideaIds }, ...(eventType ? { event_type: eventType } : {}) },
      })
    const sprintCount = (boardId: string) => prisma.sprints.count({ where: { board_id: boardId } })
    const code = (error: unknown) => (error as { code?: string }).code
    const caught = (promise: Promise<unknown>) =>
      promise.then(
        () => null,
        (e: unknown) => e,
      )

    /** A work board (L0 first, L2 final) with sprints on. */
    const workBoard = () =>
      newBoard([{ statusId: L0 }, { statusId: L1 }, { statusId: L2, isFinal: true }])

    beforeAll(async () => {
      await prisma.organizations.create({
        data: {
          id: organizationId,
          title: `probe-org-${marker}`,
          description: 'Sprint assignment QA probe.',
          invite_code: `probe-${marker}`,
          is_archived: false,
          ...stamps,
        },
      })
      for (const [id, role, first] of [
        [adminId, 'OrgAdmin', 'Admin'],
        [memberId, 'User', 'Member'],
      ] as const) {
        await prisma.users.create({
          data: {
            id,
            organization_id: organizationId,
            first_name: 'Probe',
            last_name: first,
            email: `probe-${first}-${marker}@example.test`,
            normalized_email: `PROBE-${first}-${marker}@EXAMPLE.TEST`.toUpperCase(),
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
      for (const [order, id] of [L0, L1, L2, REF, OUT, C_OPEN, C_DONE].entries()) {
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
      // A write to an item titled with the poison prefix fails at commit, whatever else was staged.
      await prisma.$executeRawUnsafe(
        `CREATE OR REPLACE FUNCTION ${triggerName}() RETURNS trigger AS $$ BEGIN IF NEW.title LIKE '${POISON}%' AND NEW.organization_id = '${organizationId}' THEN RAISE EXCEPTION 'qa325 poison'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`,
      )
      await prisma.$executeRawUnsafe(
        `CREATE TRIGGER ${triggerName} BEFORE UPDATE ON ideas FOR EACH ROW EXECUTE FUNCTION ${triggerName}()`,
      )
    })

    afterAll(async () => {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON ideas`)
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${triggerName}()`)
      await prisma.audit_events.deleteMany({ where: { organization_id: organizationId } })
      await prisma.ideas.updateMany({
        where: { organization_id: organizationId },
        data: { parent_idea_id: null, sprint_id: null },
      })
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

    describe('POST sprint with ideaIds', () => {
      it('commits the sprint, every assignment and one audit row per item together', async () => {
        const board = await workBoard()
        const [a, b, c] = [
          await newIdea({ boardId: board, statusId: L0 }),
          await newIdea({ boardId: board, statusId: L0 }),
          await newIdea({ boardId: board, statusId: L1 }),
        ]

        const result = await services().sprintService.createForBoard(board, {
          ...COMMAND,
          name: 'With tasks',
          ideaIds: [a, b, c],
        })

        expect(result.issueCount).toBe(3)
        expect(await sprintCount(board)).toBe(1)
        for (const id of [a, b, c]) {
          expect((await row(id)).sprint_id).toBe(result.sprintId)
        }
        expect((await row(c)).status_id).toBe(L1)
        expect(await auditRows([a, b, c], 'IssueSprintAssignmentChanged')).toHaveLength(3)
        expect(
          await prisma.audit_events.count({
            where: { entity_id: result.sprintId, event_type: 'SprintCreated' },
          }),
        ).toBe(1)
      })

      it('without ideaIds still creates an empty sprint', async () => {
        const board = await workBoard()

        const result = await services().sprintService.createForBoard(board, {
          ...COMMAND,
          name: 'Empty',
        })

        expect(result.issueCount).toBe(0)
        expect(await sprintCount(board)).toBe(1)
      })

      it.each([
        ['an item on another board', 'sprintItemOnOtherBoard'],
        ['an item already in a sprint', 'sprintItemAlreadyAssigned'],
        ['an id that names no item', null],
      ])('creates nothing when the request holds %s', async (_label, expected) => {
        const board = await workBoard()
        const other = await workBoard()
        const ok = await newIdea({ boardId: board, statusId: L0 })
        const existing = await newSprint(board)
        const bad =
          expected === 'sprintItemOnOtherBoard'
            ? await newIdea({ boardId: other, statusId: L0 })
            : expected === 'sprintItemAlreadyAssigned'
              ? await newIdea({ boardId: board, statusId: L0, sprintId: existing })
              : randomUUID()

        const error = await caught(
          services().sprintService.createForBoard(board, {
            ...COMMAND,
            name: 'Doomed',
            ideaIds: [ok, bad],
          }),
        )

        expect(error).not.toBeNull()
        if (expected) expect(code(error)).toBe(expected)
        expect(await sprintCount(board)).toBe(1) // only the pre-existing one
        expect((await row(ok)).sprint_id).toBeNull()
        expect(await auditRows([ok], 'IssueSprintAssignmentChanged')).toHaveLength(0)
        expect(
          await prisma.audit_events.count({
            where: {
              organization_id: organizationId,
              event_type: 'SprintCreated',
              message: { contains: 'Doomed' },
            },
          }),
        ).toBe(0)
      })

      it('rolls the sprint back when the commit itself fails on a later item', async () => {
        const board = await workBoard()
        const ok = await newIdea({ boardId: board, statusId: L0 })
        const poisoned = await newIdea({ boardId: board, statusId: L0, title: `${POISON} create` })

        const error = await caught(
          services().sprintService.createForBoard(board, {
            ...COMMAND,
            name: 'Rolled back',
            ideaIds: [ok, poisoned],
          }),
        )

        expect(String(error)).toContain('poison')
        expect(await sprintCount(board)).toBe(0)
        expect((await row(ok)).sprint_id).toBeNull()
        expect((await row(poisoned)).sprint_id).toBeNull()
        expect(await auditRows([ok, poisoned])).toHaveLength(0)
      })
    })

    describe('PUT sprint-assignments', () => {
      it('adds, moves between sprints and returns to the backlog, auditing only changed items', async () => {
        const board = await workBoard()
        const s1 = await newSprint(board)
        const s2 = await newSprint(board, 'Active')
        const fresh = await newIdea({ boardId: board, statusId: L0 })
        const inS1 = await newIdea({ boardId: board, statusId: L0, sprintId: s1 })
        const inS2 = await newIdea({ boardId: board, statusId: L1, sprintId: s2 })

        await services().ideaService.assignBoardSprints(board, {
          ideaIds: [fresh, inS1, inS2],
          sprintId: s1,
          statusId: null,
        })

        expect((await row(fresh)).sprint_id).toBe(s1)
        expect((await row(inS1)).sprint_id).toBe(s1)
        expect((await row(inS2)).sprint_id).toBe(s1)
        expect((await row(inS2)).status_id).toBe(L1)
        const events = await auditRows([fresh, inS1, inS2], 'IssueSprintAssignmentChanged')
        expect(events.map((e) => e.entity_id).sort()).toEqual([fresh, inS2].sort())

        await services().ideaService.assignBoardSprints(board, {
          ideaIds: [fresh, inS1, inS2],
          sprintId: null,
          statusId: null,
        })

        for (const id of [fresh, inS1, inS2]) expect((await row(id)).sprint_id).toBeNull()
        expect(await auditRows([fresh, inS1, inS2], 'IssueSprintAssignmentChanged')).toHaveLength(
          2 + 3,
        )
      })

      it('writes nothing, not even updated_at_utc, for a request of no-ops', async () => {
        const board = await workBoard()
        const s1 = await newSprint(board)
        const a = await newIdea({ boardId: board, statusId: L1, sprintId: s1 })

        await services().ideaService.assignBoardSprints(board, {
          ideaIds: [a],
          sprintId: s1,
          statusId: L1,
        })

        expect((await row(a)).updated_at_utc).toEqual(CREATED)
        expect(await auditRows([a])).toHaveLength(0)
      })

      it('refuses a completed sprint and an item of another board, changing nothing', async () => {
        const board = await workBoard()
        const other = await workBoard()
        const done = await newSprint(board, 'Completed')
        const open = await newSprint(board)
        const a = await newIdea({ boardId: board, statusId: L0 })
        const foreign = await newIdea({ boardId: other, statusId: L0 })

        const completed = await caught(
          services().ideaService.assignBoardSprints(board, {
            ideaIds: [a],
            sprintId: done,
            statusId: null,
          }),
        )
        const crossBoard = await caught(
          services().ideaService.assignBoardSprints(board, {
            ideaIds: [a, foreign],
            sprintId: open,
            statusId: null,
          }),
        )

        expect(completed).toHaveProperty('failures.sprintId')
        expect(code(crossBoard)).toBe('sprintItemOnOtherBoard')
        expect((await row(a)).sprint_id).toBeNull()
        expect((await row(foreign)).sprint_id).toBeNull()
        expect(await auditRows([a, foreign])).toHaveLength(0)
      })

      it('rolls the whole request back when a blocked task is dropped past its first lane', async () => {
        const board = await workBoard()
        const sprint = await newSprint(board, 'Active')
        const ok = await newIdea({ boardId: board, statusId: L0 })
        const blocked = await newIdea({ boardId: board, statusId: L0 })
        const blocker = await newIdea({ boardId: board, statusId: L0 })
        await prisma.idea_dependencies.create({
          data: { blocked_idea_id: blocked, blocker_idea_id: blocker, created_at_utc: CREATED },
        })

        const error = await caught(
          services().ideaService.assignBoardSprints(board, {
            ideaIds: [ok, blocked],
            sprintId: sprint,
            statusId: L1,
          }),
        )

        expect(code(error)).toBe('taskBlocked')
        expect((error as { failures?: { ideaIds: string[] } }).failures?.ideaIds[0]).toMatch(
          /^Q\d+[A-Z0-9]+-\d+: /,
        )
        for (const id of [ok, blocked]) {
          const after = await row(id)
          expect(after.sprint_id).toBeNull()
          expect(after.status_id).toBe(L0)
        }
        expect(await auditRows([ok, blocked])).toHaveLength(0)
      })

      it('lets the same blocked task into the sprint when no status is sent', async () => {
        const board = await workBoard()
        const sprint = await newSprint(board)
        const blocked = await newIdea({ boardId: board, statusId: L0 })
        const blocker = await newIdea({ boardId: board, statusId: L0 })
        await prisma.idea_dependencies.create({
          data: { blocked_idea_id: blocked, blocker_idea_id: blocker, created_at_utc: CREATED },
        })

        await services().ideaService.assignBoardSprints(board, {
          ideaIds: [blocked],
          sprintId: sprint,
          statusId: null,
        })

        expect((await row(blocked)).sprint_id).toBe(sprint)
      })

      it('rolls everything back when the commit fails on the last item', async () => {
        const board = await workBoard()
        const sprint = await newSprint(board)
        const a = await newIdea({ boardId: board, statusId: L0 })
        const poisoned = await newIdea({ boardId: board, statusId: L0, title: `${POISON} assign` })

        const error = await caught(
          services().ideaService.assignBoardSprints(board, {
            ideaIds: [a, poisoned],
            sprintId: sprint,
            statusId: L1,
          }),
        )

        expect(String(error)).toContain('poison')
        for (const id of [a, poisoned]) {
          const after = await row(id)
          expect(after.sprint_id).toBeNull()
          expect(after.status_id).toBe(L0)
        }
        expect(await auditRows([a, poisoned])).toHaveLength(0)
      })

      it('refuses a User and changes nothing', async () => {
        const board = await workBoard()
        const sprint = await newSprint(board)
        const a = await newIdea({ boardId: board, statusId: L0 })

        const error = await caught(
          services(member).ideaService.assignBoardSprints(board, {
            ideaIds: [a],
            sprintId: sprint,
            statusId: null,
          }),
        )

        expect(error).toBeInstanceOf(ForbiddenError)
        expect((await row(a)).sprint_id).toBeNull()
      })
    })

    describe('a lane drop into an autoCreateTask reference lane', () => {
      async function boardPair() {
        const child = await newBoard([{ statusId: C_OPEN }, { statusId: C_DONE, isFinal: true }], {
          sprints: false,
        })
        const parent = await newBoard([
          { statusId: L0 },
          { statusId: REF, refs: child, auto: true },
          { statusId: OUT },
        ])
        return { child, parent }
      }
      const nextNumber = async (boardId: string) =>
        (await prisma.boards.findUniqueOrThrow({ where: { id: boardId } })).next_item_number

      it('moves several items, makes one task each and numbers the tasks without collision', async () => {
        const { child, parent } = await boardPair()
        const sprint = await newSprint(parent, 'Active')
        const items = [
          await newIdea({ boardId: parent, statusId: L0 }),
          await newIdea({ boardId: parent, statusId: L0 }),
          await newIdea({ boardId: parent, statusId: L0 }),
          await newIdea({ boardId: parent, statusId: OUT }),
        ]
        const startNext = await nextNumber(child)

        await services().ideaService.assignBoardSprints(parent, {
          ideaIds: items,
          sprintId: sprint,
          statusId: REF,
        })

        for (const id of items) {
          const after = await row(id)
          expect(after.status_id).toBe(REF)
          expect(after.sprint_id).toBe(sprint)
        }
        const tasks = await prisma.ideas.findMany({
          where: { parent_idea_id: { in: items } },
          select: { parent_idea_id: true, board_id: true, item_number: true },
        })
        expect(tasks).toHaveLength(4)
        expect(tasks.every((t) => t.board_id === child)).toBe(true)
        expect(new Set(tasks.map((t) => t.parent_idea_id)).size).toBe(4)
        const numbers = tasks.map((t) => t.item_number as number).sort((x, y) => x - y)
        expect(numbers).toEqual([startNext, startNext + 1, startNext + 2, startNext + 3])
        expect(await nextNumber(child)).toBe(startNext + 4)
        expect(await auditRows(items, 'IdeaStatusChanged')).toHaveLength(4)
        expect(await auditRows(items, 'IssueSprintAssignmentChanged')).toHaveLength(4)
      })

      it('makes no second task when the same items are dropped again', async () => {
        const { child, parent } = await boardPair()
        const sprint = await newSprint(parent, 'Active')
        const items = [
          await newIdea({ boardId: parent, statusId: L0 }),
          await newIdea({ boardId: parent, statusId: L0 }),
        ]
        await services().ideaService.assignBoardSprints(parent, {
          ideaIds: items,
          sprintId: sprint,
          statusId: REF,
        })
        const after = await nextNumber(child)

        await services().ideaService.assignBoardSprints(parent, {
          ideaIds: items,
          sprintId: sprint,
          statusId: REF,
        })

        expect(await prisma.ideas.count({ where: { parent_idea_id: { in: items } } })).toBe(2)
        expect(await nextNumber(child)).toBe(after)
      })

      it('rolls back the moves and every task when one item has no Effort', async () => {
        const { child, parent } = await boardPair()
        const sprint = await newSprint(parent, 'Active')
        const startNext = await nextNumber(child)
        const ok = await newIdea({ boardId: parent, statusId: L0 })
        const noEffort = await newIdea({ boardId: parent, statusId: L0, effort: null })

        const error = await caught(
          services().ideaService.assignBoardSprints(parent, {
            ideaIds: [ok, noEffort],
            sprintId: sprint,
            statusId: REF,
          }),
        )

        expect(code(error)).toBe('effortRequiredForReferenceLane')
        expect((await row(ok)).status_id).toBe(L0)
        expect((await row(ok)).sprint_id).toBeNull()
        expect(
          await prisma.ideas.count({ where: { parent_idea_id: { in: [ok, noEffort] } } }),
        ).toBe(0)
        // Numbers are allocated outside the unit of work (Ruling 5), so a refused request may burn
        // some; it must never reuse or move the counter backwards.
        expect(await nextNumber(child)).toBeGreaterThanOrEqual(startNext)
      })

      it('keeps item numbers unique when two drops race into the same lane', async () => {
        const { child, parent } = await boardPair()
        const sprint = await newSprint(parent, 'Active')
        const first = [
          await newIdea({ boardId: parent, statusId: L0 }),
          await newIdea({ boardId: parent, statusId: L0 }),
          await newIdea({ boardId: parent, statusId: L0 }),
        ]
        const second = [
          await newIdea({ boardId: parent, statusId: L0 }),
          await newIdea({ boardId: parent, statusId: L0 }),
          await newIdea({ boardId: parent, statusId: L0 }),
        ]
        const startNext = await nextNumber(child)

        const results = await Promise.allSettled([
          services().ideaService.assignBoardSprints(parent, {
            ideaIds: first,
            sprintId: sprint,
            statusId: REF,
          }),
          services().ideaService.assignBoardSprints(parent, {
            ideaIds: second,
            sprintId: sprint,
            statusId: REF,
          }),
        ])

        expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled'])
        const tasks = await prisma.ideas.findMany({
          where: { parent_idea_id: { in: [...first, ...second] } },
          select: { item_number: true },
        })
        const numbers = tasks.map((t) => t.item_number as number)
        expect(numbers).toHaveLength(6)
        expect(new Set(numbers).size).toBe(6)
        expect(Math.min(...numbers)).toBeGreaterThanOrEqual(startNext)
        expect(await nextNumber(child)).toBe(startNext + 6)
      })
    })
  },
)
