// Live-database QA for the reference-lane lock and the auto-create lane (SPEC/decisions.md
// 2026-10-16 "A reference lane locks its card until its tasks are final";
// SPEC/20-feature-board-references.md Behavior 4): the real IdeaService and BoardService over the
// Prisma repositories. What the unit suites fake is proved here: open = total minus done over the
// child board's final lanes, soft-deleted tasks not counting, the override's audit rows, the
// `autoCreateTask` column through save, read and reorder, and the auto-create's move rolling back
// with the task it could not create. Skipped unless `DATABASE_URL` is set; builds its own
// organization and removes it afterwards.
//
// Each call builds a FRESH set of services: the unit of work is a command buffer, so a refused
// call's staged writes would otherwise ride along on the next call's commit. A request has its own
// buffer in production for the same reason.

import { randomUUID } from 'node:crypto'
import { BoardService } from '@collega/application/boards'
import { type CurrentUserContext, ValidationError } from '@collega/application/common'
import { IdeaService } from '@collega/application/ideas'
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
import { OrganizationExistenceLookupRepository } from '../src/repositories/organization-existence-lookup.repository.js'
import { PrismaSprintRepository } from '../src/repositories/sprint.repository.js'
import { PrismaStatusRepository } from '../src/repositories/status.repository.js'
import { PrismaTagRepository } from '../src/repositories/tag.repository.js'
import { PrismaUserRepository } from '../src/repositories/user.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const CREATED = new Date('2026-10-15T09:00:00.000Z')
const SAVED = new Date('2026-10-16T12:00:00.000Z')

describe.skipIf(!DATABASE_URL)(
  'Reference-lane lock and auto-create, against a live database',
  () => {
    const prisma = new PrismaClient()
    const marker = randomUUID()
    const tag = marker.slice(0, 4).toUpperCase()
    const organizationId = randomUUID()
    const adminId = randomUUID()
    const memberId = randomUUID()
    const ideaTypeId = randomUUID()
    const impactId = randomUUID()
    const stamps = { created_at_utc: CREATED, updated_at_utc: CREATED }

    // Statuses: the parent board's lanes, then the child board's two.
    const [S_NEW, S_REF, S_OUT, S_AUTO, S_OPEN, S_DONE] = Array.from({ length: 6 }, () =>
      randomUUID(),
    ) as [string, string, string, string, string, string]

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

    /** `afterLaneRead` runs once a board save has read the lanes it removes, before it commits. */
    function services(
      currentUser: CurrentUserContext = admin,
      afterLaneRead?: () => Promise<void>,
    ) {
      const unitOfWork = new PrismaUnitOfWork(prisma)
      const boards = new PrismaBoardRepository(prisma, unitOfWork)
      if (afterLaneRead) {
        const read = boards.listLaneIdeas.bind(boards)
        boards.listLaneIdeas = async (boardId, statusIds) => {
          const ideas = await read(boardId, statusIds)
          await afterLaneRead()
          return ideas
        }
      }
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
      const boardService = new BoardService(
        boards,
        new PrismaStatusRepository(prisma, unitOfWork),
        new OrganizationExistenceLookupRepository(prisma),
        unitOfWork,
        audit,
        currentUser,
        clock,
        ideas,
        ideaService,
      )
      return { ideaService, boardService }
    }

    let boardCounter = 0
    async function newBoard(
      lanes: { statusId: string; isFinal?: boolean; refs?: string; auto?: boolean }[],
      isArchived = false,
    ): Promise<string> {
      const id = randomUUID()
      await prisma.boards.create({
        data: {
          id,
          organization_id: organizationId,
          name: `Lock QA ${id}`,
          key_prefix: `K${++boardCounter}${tag}`,
          next_item_number: 1,
          allow_user_status_update: true,
          is_archived: isArchived,
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

    /** A child board (open lane, then a final one) and a parent board whose S_REF lane references it. */
    async function boardPair(auto = false) {
      const child = await newBoard([{ statusId: S_OPEN }, { statusId: S_DONE, isFinal: true }])
      const parentBoard = await newBoard([
        { statusId: S_NEW },
        { statusId: S_REF, refs: child },
        { statusId: S_OUT },
        { statusId: S_AUTO, refs: child, auto },
      ])
      return { child, parentBoard }
    }

    async function newIdea(input: {
      boardId: string | null
      statusId: string
      parentId?: string | null
      isDeleted?: boolean
      effort?: 'Low' | 'Medium' | 'High' | null
      title?: string
      authorId?: string
    }): Promise<string> {
      const id = randomUUID()
      await prisma.ideas.create({
        data: {
          id,
          organization_id: organizationId,
          board_id: input.boardId,
          status_id: input.statusId,
          parent_idea_id: input.parentId ?? null,
          title: input.title ?? `Lock QA idea ${id}`,
          problem: 'p',
          proposed_solutions: ['s'],
          impact_rationale: 'r',
          priority: 'Medium',
          idea_type_id: ideaTypeId,
          business_impact_id: impactId,
          author_user_id: input.authorId ?? adminId,
          is_deleted: input.isDeleted ?? false,
          phase: 'Discovery',
          effort: input.effort === undefined ? 'Medium' : input.effort,
          ...stamps,
        },
      })
      return id
    }

    /** A parent in S_REF with 2 open tasks, 1 done, and 1 open but soft-deleted: 2 hold it. */
    async function lockedParent(boardId: string, child: string, title?: string): Promise<string> {
      const parent = await newIdea({
        boardId,
        statusId: S_REF,
        ...(title === undefined ? {} : { title }),
      })
      await newIdea({ boardId: child, statusId: S_OPEN, parentId: parent })
      await newIdea({ boardId: child, statusId: S_OPEN, parentId: parent })
      await newIdea({ boardId: child, statusId: S_DONE, parentId: parent })
      await newIdea({ boardId: child, statusId: S_OPEN, parentId: parent, isDeleted: true })
      return parent
    }

    const statusOf = async (ideaId: string) =>
      (await prisma.ideas.findUniqueOrThrow({ where: { id: ideaId } })).status_id
    const boardOf = async (ideaId: string) =>
      (await prisma.ideas.findUniqueOrThrow({ where: { id: ideaId } })).board_id
    const eventsOf = (ideaId: string, eventType: string) =>
      prisma.audit_events.findMany({ where: { entity_id: ideaId, event_type: eventType } })

    beforeAll(async () => {
      await prisma.organizations.create({
        data: {
          id: organizationId,
          title: `probe-org-${marker}`,
          description: 'Reference lock QA probe.',
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
      for (const [order, id] of [S_NEW, S_REF, S_OUT, S_AUTO, S_OPEN, S_DONE].entries()) {
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
    })

    it('refuses an ideaMoves save into an auto-create lane when a planned idea left the lane meanwhile, rolling it all back', async () => {
      const child = await newBoard([{ statusId: S_OPEN }, { statusId: S_DONE, isFinal: true }])
      const board = await newBoard([
        { statusId: S_NEW },
        { statusId: S_AUTO, refs: child, auto: true },
        { statusId: S_OUT },
      ])
      const stays = await newIdea({ boardId: board, statusId: S_OUT, title: 'Stays' })
      const leaves = await newIdea({ boardId: board, statusId: S_OUT, title: 'Leaves' })
      const { boardService } = services(admin, async () => {
        await prisma.ideas.update({ where: { id: leaves }, data: { status_id: S_NEW } })
      })

      const error = await boardService
        .update(board, {
          name: 'Moved meanwhile',
          allowUserStatusUpdate: true,
          swimlanes: [
            { statusId: S_NEW, order: 0 },
            { statusId: S_AUTO, order: 1, referencesBoardId: child, autoCreateTask: true },
          ],
          ideaMoves: [{ fromStatusId: S_OUT, toStatusId: S_AUTO }],
        })
        .catch((caught: unknown) => caught)

      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).failures).toEqual({
        ideaMoves: ["'Leaves' is no longer in that lane."],
      })
      expect(await statusOf(stays)).toBe(S_OUT)
      expect(await statusOf(leaves)).toBe(S_NEW)
      expect(await prisma.ideas.count({ where: { parent_idea_id: { in: [stays, leaves] } } })).toBe(
        0,
      )
      expect(await prisma.board_swimlanes.count({ where: { board_id: board } })).toBe(3)
      expect(
        await prisma.audit_events.count({
          where: { entity_id: { in: [board, stays, leaves] } },
        }),
      ).toBe(0)
    })

    afterAll(async () => {
      await prisma.audit_events.deleteMany({ where: { organization_id: organizationId } })
      await prisma.ideas.updateMany({
        where: { organization_id: organizationId },
        data: { parent_idea_id: null },
      })
      await prisma.ideas.deleteMany({ where: { organization_id: organizationId } })
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

    describe('the lock on a move', () => {
      it('counts open as total minus done over the child final lanes, and skips deleted tasks', async () => {
        const { child, parentBoard } = await boardPair()
        const parent = await lockedParent(parentBoard, child)

        const error = await services()
          .ideaService.changeStatus(parent, { statusId: S_OUT })
          .catch((e: unknown) => e)

        expect(error).toMatchObject({ code: 'parentHasOpenTasks' })
        expect((error as Error).message).toContain('is waiting on 2 open tasks')
        expect(await statusOf(parent)).toBe(S_REF)
        expect(await eventsOf(parent, 'IdeaStatusChanged')).toHaveLength(0)
      })

      it('lets the card go once its last open task is in a final lane', async () => {
        const { child, parentBoard } = await boardPair()
        const parent = await newIdea({ boardId: parentBoard, statusId: S_REF })
        const task = await newIdea({ boardId: child, statusId: S_OPEN, parentId: parent })
        await newIdea({ boardId: child, statusId: S_DONE, parentId: parent })

        expect(
          await services()
            .ideaService.changeStatus(parent, { statusId: S_OUT })
            .catch((e: unknown) => e),
        ).toMatchObject({ code: 'parentHasOpenTasks' })

        await prisma.ideas.update({ where: { id: task }, data: { status_id: S_DONE } })
        await services().ideaService.changeStatus(parent, { statusId: S_OUT })

        expect(await statusOf(parent)).toBe(S_OUT)
      })

      it('lets a card with no tasks, and a card outside a reference lane, move', async () => {
        const { parentBoard } = await boardPair()
        const empty = await newIdea({ boardId: parentBoard, statusId: S_REF })
        const plain = await newIdea({ boardId: parentBoard, statusId: S_NEW })

        await services().ideaService.changeStatus(empty, { statusId: S_OUT })
        await services().ideaService.changeStatus(plain, { statusId: S_OUT })

        expect(await statusOf(empty)).toBe(S_OUT)
        expect(await statusOf(plain)).toBe(S_OUT)
      })

      it('lets an Org Admin force the move, auditing the reason and the count after the commit', async () => {
        const { child, parentBoard } = await boardPair()
        const parent = await lockedParent(parentBoard, child, 'Forced parent')

        await services().ideaService.changeStatus(parent, {
          statusId: S_OUT,
          forceReason: '  Customer escalation  ',
        })

        expect(await statusOf(parent)).toBe(S_OUT)
        const forced = await eventsOf(parent, 'IdeaMovedPastOpenTasks')
        expect(forced).toHaveLength(1)
        expect(forced[0]).toMatchObject({
          entity_type: 'Idea',
          organization_id: organizationId,
          actor_user_id: adminId,
          message: "Idea 'Forced parent' moved past 2 open tasks.",
        })
        expect(JSON.parse(forced[0]?.metadata_json ?? 'null')).toEqual({
          reason: 'Customer escalation',
          openTaskCount: 2,
        })
        // The tasks are untouched: still three live ones in the same lanes.
        const tasks = await prisma.ideas.findMany({
          where: { parent_idea_id: parent, is_deleted: false },
          select: { status_id: true },
        })
        expect(tasks.map((t) => t.status_id).sort()).toEqual([S_DONE, S_OPEN, S_OPEN].sort())
      })

      it('writes no override event when nothing held the card', async () => {
        const { parentBoard } = await boardPair()
        const parent = await newIdea({ boardId: parentBoard, statusId: S_REF })

        await services().ideaService.changeStatus(parent, {
          statusId: S_OUT,
          forceReason: 'Just in case',
        })

        expect(await statusOf(parent)).toBe(S_OUT)
        expect(await eventsOf(parent, 'IdeaMovedPastOpenTasks')).toHaveLength(0)
      })

      it('refuses a User who sends a reason with 403 and leaves the card where it is', async () => {
        const { child, parentBoard } = await boardPair()
        const parent = await lockedParent(parentBoard, child)

        const error = await services(member)
          .ideaService.changeStatus(parent, { statusId: S_OUT, forceReason: 'Let me through' })
          .catch((e: unknown) => e)

        expect(error).toMatchObject({ name: 'ForbiddenError' })
        expect(await statusOf(parent)).toBe(S_REF)
        expect(await eventsOf(parent, 'IdeaMovedPastOpenTasks')).toHaveLength(0)
      })
    })

    describe('the lock on a detach', () => {
      it('refuses while tasks are open, then detaches with an override and audits it', async () => {
        const { child, parentBoard } = await boardPair()
        const parent = await lockedParent(parentBoard, child, 'Detached parent')

        const refused = await services()
          .ideaService.detachFromBoard(parent)
          .catch((e: unknown) => e)
        expect(refused).toMatchObject({ code: 'parentHasOpenTasks' })
        expect(await boardOf(parent)).toBe(parentBoard)

        await services().ideaService.detachFromBoard(parent, 'Board is being retired')

        expect(await boardOf(parent)).toBeNull()
        const forced = await eventsOf(parent, 'IdeaMovedPastOpenTasks')
        expect(forced).toHaveLength(1)
        expect(JSON.parse(forced[0]?.metadata_json ?? 'null')).toEqual({
          reason: 'Board is being retired',
          openTaskCount: 2,
        })
        expect(await eventsOf(parent, 'IdeaBoardChanged')).toHaveLength(1)
      })

      it('detaches a card whose tasks are all final, with no override event', async () => {
        const { child, parentBoard } = await boardPair()
        const parent = await newIdea({ boardId: parentBoard, statusId: S_REF })
        await newIdea({ boardId: child, statusId: S_DONE, parentId: parent })

        await services().ideaService.detachFromBoard(parent)

        expect(await boardOf(parent)).toBeNull()
        expect(await eventsOf(parent, 'IdeaMovedPastOpenTasks')).toHaveLength(0)
      })
    })

    describe('the lock on a pull', () => {
      const lanes = (a: string, b: string) => [
        { statusId: a, order: 0 },
        { statusId: b, order: 1 },
      ]

      it('refuses the pull with the exact 400 text, creating no board and moving no card', async () => {
        const { child, parentBoard } = await boardPair()
        const parent = await lockedParent(parentBoard, child, 'Pulled parent')
        const boardsBefore = await prisma.boards.count({
          where: { organization_id: organizationId },
        })

        const error = await services()
          .boardService.create(organizationId, {
            name: 'Pull target',
            allowUserStatusUpdate: true,
            swimlanes: lanes(S_NEW, S_OUT),
            pullItemIds: [parent],
          })
          .catch((e: unknown) => e)

        expect(error).toMatchObject({
          name: 'ValidationError',
          failures: {
            pullItemIds: ["'Pulled parent' is waiting on 2 open tasks, so it cannot be pulled."],
          },
        })
        expect(await prisma.boards.count({ where: { organization_id: organizationId } })).toBe(
          boardsBefore,
        )
        expect(await boardOf(parent)).toBe(parentBoard)
      })

      it('pulls past the open tasks for an Org Admin who gives a reason, auditing the override', async () => {
        const { child, parentBoard } = await boardPair()
        const parent = await lockedParent(parentBoard, child, 'Forced pull')

        const created = await services().boardService.create(organizationId, {
          name: 'Forced pull target',
          allowUserStatusUpdate: true,
          swimlanes: lanes(S_NEW, S_REF),
          pullItemIds: [parent],
          forceReason: 'Board is being merged',
        })

        expect(await boardOf(parent)).toBe(created.boardId)
        const forced = await eventsOf(parent, 'IdeaMovedPastOpenTasks')
        expect(forced).toHaveLength(1)
        expect(JSON.parse(forced[0]?.metadata_json ?? 'null')).toEqual({
          reason: 'Board is being merged',
          openTaskCount: 2,
        })
      })

      it('pulls an unlocked card from a reference lane and audits no override', async () => {
        const { parentBoard } = await boardPair()
        const parent = await newIdea({ boardId: parentBoard, statusId: S_REF })

        const created = await services().boardService.create(organizationId, {
          name: 'Plain pull target',
          allowUserStatusUpdate: true,
          swimlanes: lanes(S_NEW, S_REF),
          pullItemIds: [parent],
          forceReason: 'Just in case',
        })

        expect(await boardOf(parent)).toBe(created.boardId)
        expect(await eventsOf(parent, 'IdeaMovedPastOpenTasks')).toHaveLength(0)
      })
    })

    describe('autoCreateTask on a lane', () => {
      it('round-trips through create, read, update and reorder', async () => {
        const child = await newBoard([{ statusId: S_OPEN }, { statusId: S_DONE, isFinal: true }])
        const lanesWithFlag = [
          { statusId: S_NEW, order: 0 },
          { statusId: S_REF, order: 1, referencesBoardId: child, autoCreateTask: true },
          { statusId: S_OUT, order: 2 },
        ]

        const created = await services().boardService.create(organizationId, {
          name: 'Auto round trip',
          allowUserStatusUpdate: true,
          swimlanes: lanesWithFlag,
        })
        expect(created.swimlanes.map((l) => [l.statusId, l.autoCreateTask])).toEqual([
          [S_NEW, false],
          [S_REF, true],
          [S_OUT, false],
        ])

        const read = await services().boardService.getById(created.boardId)
        expect(read.swimlanes.map((l) => l.autoCreateTask)).toEqual([false, true, false])
        const stored = await prisma.board_swimlanes.findMany({
          where: { board_id: created.boardId },
          orderBy: { display_order: 'asc' },
          select: { auto_create_task: true },
        })
        expect(stored.map((l) => l.auto_create_task)).toEqual([false, true, false])

        await services().boardService.reorderSwimlanes(created.boardId, {
          swimlanes: [
            { statusId: S_OUT, order: 0 },
            { statusId: S_REF, order: 1 },
            { statusId: S_NEW, order: 2 },
          ],
        })
        const reordered = await services().boardService.getById(created.boardId)
        expect(reordered.swimlanes.map((l) => [l.statusId, l.autoCreateTask])).toEqual([
          [S_OUT, false],
          [S_REF, true],
          [S_NEW, false],
        ])

        const turnedOff = await services().boardService.update(created.boardId, {
          name: 'Auto round trip',
          allowUserStatusUpdate: true,
          swimlanes: [
            { statusId: S_OUT, order: 0 },
            { statusId: S_REF, order: 1, referencesBoardId: child, autoCreateTask: false },
            { statusId: S_NEW, order: 2 },
          ],
        })
        expect(turnedOff.swimlanes.map((l) => l.autoCreateTask)).toEqual([false, false, false])
        expect(
          (await services().boardService.getById(created.boardId)).swimlanes.map(
            (l) => l.autoCreateTask,
          ),
        ).toEqual([false, false, false])
      })

      it('refuses the flag on a lane with no referenced board, saving nothing', async () => {
        const boardsBefore = await prisma.boards.count({
          where: { organization_id: organizationId },
        })

        const error = await services()
          .boardService.create(organizationId, {
            name: 'Bad auto',
            allowUserStatusUpdate: true,
            swimlanes: [
              { statusId: S_NEW, order: 0, autoCreateTask: true },
              { statusId: S_OUT, order: 1 },
            ],
          })
          .catch((e: unknown) => e)

        expect(error).toMatchObject({ code: 'autoCreateTaskRequiresReference' })
        expect(await prisma.boards.count({ where: { organization_id: organizationId } })).toBe(
          boardsBefore,
        )
      })
    })

    describe('auto-create on a status move', () => {
      it('creates one task: the parent title, the child first lane, linked, numbered, idea-only fields null', async () => {
        const { child, parentBoard } = await boardPair(true)
        const parent = await newIdea({
          boardId: parentBoard,
          statusId: S_NEW,
          title: 'Hand this off',
        })

        await services().ideaService.changeStatus(parent, { statusId: S_AUTO })

        expect(await statusOf(parent)).toBe(S_AUTO)
        const tasks = await prisma.ideas.findMany({ where: { parent_idea_id: parent } })
        expect(tasks).toHaveLength(1)
        expect(tasks[0]).toMatchObject({
          title: 'Hand this off',
          board_id: child,
          status_id: S_OPEN,
          item_number: 1,
          is_deleted: false,
          author_user_id: adminId,
        })
        expect(await eventsOf(tasks[0]?.id ?? '', 'BoardTaskCreated')).toHaveLength(1)
        expect(await eventsOf(parent, 'IdeaStatusChanged')).toHaveLength(1)

        const read = await services().ideaService.getById(tasks[0]?.id ?? '')
        expect(read).toMatchObject({
          title: 'Hand this off',
          parentIdeaId: parent,
          problem: null,
          impactRationale: null,
          priority: null,
          ideaTypeId: null,
          businessImpactId: null,
          proposedSolutions: [],
        })
      })

      it('holds the parent afterwards: the new task is open, so the lock applies', async () => {
        const { parentBoard } = await boardPair(true)
        const parent = await newIdea({ boardId: parentBoard, statusId: S_NEW })
        await services().ideaService.changeStatus(parent, { statusId: S_AUTO })

        const error = await services()
          .ideaService.changeStatus(parent, { statusId: S_OUT })
          .catch((e: unknown) => e)

        expect(error).toMatchObject({ code: 'parentHasOpenTasks' })
        expect(await statusOf(parent)).toBe(S_AUTO)
      })

      it('creates no task when the lane does not auto-create', async () => {
        const { parentBoard } = await boardPair(false)
        const parent = await newIdea({ boardId: parentBoard, statusId: S_NEW })

        await services().ideaService.changeStatus(parent, { statusId: S_AUTO })

        expect(await statusOf(parent)).toBe(S_AUTO)
        expect(await prisma.ideas.count({ where: { parent_idea_id: parent } })).toBe(0)
      })

      it('rolls the move back, with no task and no audit, when the referenced board is archived', async () => {
        const { child, parentBoard } = await boardPair(true)
        const parent = await newIdea({ boardId: parentBoard, statusId: S_NEW })
        await prisma.boards.update({ where: { id: child }, data: { is_archived: true } })

        const error = await services()
          .ideaService.changeStatus(parent, { statusId: S_AUTO })
          .catch((e: unknown) => e)

        expect(error).toMatchObject({ code: 'referencedBoardArchived' })
        expect(await statusOf(parent)).toBe(S_NEW)
        expect(await prisma.ideas.count({ where: { parent_idea_id: parent } })).toBe(0)
        expect(await eventsOf(parent, 'IdeaStatusChanged')).toHaveLength(0)
        const board = await prisma.boards.findUniqueOrThrow({
          where: { id: child },
          select: { next_item_number: true },
        })
        // The refusal came before a number was allocated, so none was burned.
        expect(board.next_item_number).toBe(1)
      })

      it('rolls the move back when the organization has no active idea type', async () => {
        const { parentBoard } = await boardPair(true)
        const parent = await newIdea({ boardId: parentBoard, statusId: S_NEW })
        await prisma.idea_types.update({ where: { id: ideaTypeId }, data: { is_deleted: true } })

        try {
          const error = await services()
            .ideaService.changeStatus(parent, { statusId: S_AUTO })
            .catch((e: unknown) => e)

          expect(error).toMatchObject({ code: 'noDefaultIdeaType' })
          expect(await statusOf(parent)).toBe(S_NEW)
          expect(await prisma.ideas.count({ where: { parent_idea_id: parent } })).toBe(0)
        } finally {
          await prisma.idea_types.update({ where: { id: ideaTypeId }, data: { is_deleted: false } })
        }
      })

      it('still asks for an Effort first, creating no task', async () => {
        const { parentBoard } = await boardPair(true)
        const parent = await newIdea({ boardId: parentBoard, statusId: S_NEW, effort: null })

        const error = await services()
          .ideaService.changeStatus(parent, { statusId: S_AUTO })
          .catch((e: unknown) => e)

        expect(error).toMatchObject({ code: 'effortRequiredForReferenceLane' })
        expect(await statusOf(parent)).toBe(S_NEW)
        expect(await prisma.ideas.count({ where: { parent_idea_id: parent } })).toBe(0)
      })

      it('a move that succeeds after a refused one carries nothing over from the refusal', async () => {
        const { child, parentBoard } = await boardPair(true)
        const first = await newIdea({ boardId: parentBoard, statusId: S_NEW })
        const second = await newIdea({ boardId: parentBoard, statusId: S_NEW })
        await prisma.boards.update({ where: { id: child }, data: { is_archived: true } })
        await services()
          .ideaService.changeStatus(first, { statusId: S_AUTO })
          .catch(() => undefined)
        await prisma.boards.update({ where: { id: child }, data: { is_archived: false } })

        await services().ideaService.changeStatus(second, { statusId: S_AUTO })

        expect(await statusOf(first)).toBe(S_NEW)
        expect(await statusOf(second)).toBe(S_AUTO)
        expect(await prisma.ideas.count({ where: { parent_idea_id: first } })).toBe(0)
        expect(await prisma.ideas.count({ where: { parent_idea_id: second } })).toBe(1)
      })
    })
  },
)
