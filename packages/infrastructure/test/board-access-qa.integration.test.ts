// Live-database QA for "Restricted boards and user groups" (SPEC/20-feature-board-access-and-groups.md
// BAG-3 and BAG-4c; SPEC/contracts/boards.md "Board access"), against the real SQL.
//
// The "can see" rule exists twice: in the domain (`canSeeBoard`, which BoardService applies to the
// boards it loads) and as the SQL behind `BoardAccessLookup.canSeeBoard` and
// `VisibleBoardsLookup.visibleBoardIds` (which every other service's lists and by-id checks use).
// The application suites fake the SQL half, so this file is where the two are held to one table:
//
//  - the BAG-3 table over {Org Admin, creator, direct grant, group grant, not granted} x
//    {Organization, Restricted}, read through BoardService over Prisma (list and detail) and through
//    both SQL lookups, which must agree;
//  - 3d: joining and leaving a group changes both answers on the next read, and no board row is
//    written;
//  - 2d: a Restricted board with an empty list is its creator's and the Org Admins' only;
//  - 4c: the Ideas list and a title search, through IdeaService over Prisma, leave the hidden idea
//    out for the member who is not granted and keep it for the one who is.
//
// Skipped unless `DATABASE_URL` is set. It builds its own organization and removes it afterwards.

import { randomUUID } from 'node:crypto'
import { BoardService } from '@collega/application/boards'
import { type CurrentUserContext, NotFoundError } from '@collega/application/common'
import { IdeaService, type OrganizationIdeaListQuery } from '@collega/application/ideas'
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
import { PrismaMetricTypeRepository } from '../src/repositories/metric-type.repository.js'
import { OrganizationExistenceLookupRepository } from '../src/repositories/organization-existence-lookup.repository.js'
import { PrismaSprintRepository } from '../src/repositories/sprint.repository.js'
import { PrismaStatusRepository } from '../src/repositories/status.repository.js'
import { PrismaTagRepository } from '../src/repositories/tag.repository.js'
import { PrismaUserRepository } from '../src/repositories/user.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const CREATED = new Date('2026-10-28T09:00:00.000Z')

const ORG_LIST_QUERY: OrganizationIdeaListQuery = {
  page: null,
  pageSize: 100,
  search: null,
  scope: null,
  sortBy: null,
  sortDirection: null,
  fieldFilters: null,
  boardIds: [],
  includeNoBoard: false,
  statusIds: [],
  priorities: [],
  tags: [],
  user: null,
  phase: null,
}

describe.skipIf(!DATABASE_URL)('Restricted boards against a live database', () => {
  const prisma = new PrismaClient()
  const marker = randomUUID()
  const organizationId = randomUUID()
  const [adminId, creatorId, directId, groupedId, outsiderId] = [1, 2, 3, 4, 5].map(() =>
    randomUUID(),
  ) as [string, string, string, string, string]
  const groupId = randomUUID()
  const [statusA, statusB, ideaTypeId, impactId] = [1, 2, 3, 4].map(() => randomUUID()) as [
    string,
    string,
    string,
    string,
  ]
  const openBoard = randomUUID()
  const lockedBoard = randomUUID()
  const emptyListBoard = randomUUID()
  const hiddenIdea = randomUUID()
  const openIdea = randomUUID()
  const hiddenTitle = `Northwind ${marker.slice(0, 8)}`
  const stamps = { created_at_utc: CREATED, updated_at_utc: CREATED }

  const ctx = (userId: string, role: Role = Role.User): CurrentUserContext => ({
    isAuthenticated: true,
    userId,
    organizationId,
    role,
    isImpersonating: false,
    realUserId: userId,
  })

  const CALLERS: readonly [string, CurrentUserContext][] = [
    ['Org Admin', ctx(adminId, Role.OrgAdmin)],
    ['the creator', ctx(creatorId)],
    ['a direct grant', ctx(directId)],
    ['a group grant', ctx(groupedId)],
    ['not granted', ctx(outsiderId)],
  ]

  function services(currentUser: CurrentUserContext) {
    const unitOfWork = new PrismaUnitOfWork(prisma)
    const boards = new PrismaBoardRepository(prisma, unitOfWork)
    const ideas = new PrismaIdeaRepository(prisma, unitOfWork)
    const audit = new PrismaAuditEventWriter(prisma)
    const clock = { now: () => CREATED }
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
      new PrismaMetricTypeRepository(prisma, unitOfWork),
      audit,
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
    return { boards, ideaService, boardService }
  }

  async function newBoard(
    id: string,
    visibility: 'Organization' | 'Restricted',
    grants: { users: string[]; groups: string[] },
  ) {
    await prisma.boards.create({
      data: {
        id,
        organization_id: organizationId,
        name: `Access QA ${visibility} ${id.slice(0, 8)}`,
        allow_user_status_update: true,
        is_archived: false,
        visibility,
        created_by_user_id: creatorId,
        next_item_number: 1,
        ...stamps,
        board_swimlanes: {
          create: [statusA, statusB].map((statusId, order) => ({
            id: randomUUID(),
            status_id: statusId,
            display_order: order,
            is_final: false,
          })),
        },
        board_access_users: { create: grants.users.map((user_id) => ({ user_id })) },
        board_access_groups: { create: grants.groups.map((group_id) => ({ group_id })) },
      },
    })
  }

  async function newIdea(id: string, boardId: string, title: string) {
    await prisma.ideas.create({
      data: {
        id,
        organization_id: organizationId,
        board_id: boardId,
        status_id: statusA,
        title,
        problem: 'p',
        proposed_solutions: ['s'],
        impact_rationale: 'r',
        priority: 'Medium',
        idea_type_id: ideaTypeId,
        business_impact_id: impactId,
        author_user_id: directId,
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
        title: `probe-org-access-${marker}`,
        description: 'Restricted boards QA probe.',
        invite_code: `probe-access-${marker}`,
        is_archived: false,
        ...stamps,
      },
    })
    for (const [id, role, name] of [
      [adminId, 'OrgAdmin', 'Admin'],
      [creatorId, 'User', 'Creator'],
      [directId, 'User', 'Direct'],
      [groupedId, 'User', 'Grouped'],
      [outsiderId, 'User', 'Outsider'],
    ] as const) {
      await prisma.users.create({
        data: {
          id,
          organization_id: organizationId,
          first_name: 'Probe',
          last_name: name,
          email: `probe-access-${name}-${marker}@example.test`,
          normalized_email: `PROBE-ACCESS-${name}-${marker}@EXAMPLE.TEST`.toUpperCase(),
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
    for (const [order, id] of [statusA, statusB].entries()) {
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
    await prisma.user_groups.create({
      data: {
        id: groupId,
        organization_id: organizationId,
        name: 'Deal team',
        normalized_name: 'DEAL TEAM',
        ...stamps,
        user_group_members: { create: [{ user_id: groupedId }] },
      },
    })
    // Both boards carry the same list: it grants on the Restricted one and is ignored on the other.
    const grants = { users: [directId], groups: [groupId] }
    await newBoard(openBoard, 'Organization', grants)
    await newBoard(lockedBoard, 'Restricted', grants)
    await newBoard(emptyListBoard, 'Restricted', { users: [], groups: [] })
    await newIdea(hiddenIdea, lockedBoard, hiddenTitle)
    await newIdea(openIdea, openBoard, `Open ${marker.slice(0, 8)}`)
  })

  afterAll(async () => {
    await prisma.audit_events.deleteMany({ where: { organization_id: organizationId } })
    await prisma.ideas.deleteMany({ where: { organization_id: organizationId } })
    await prisma.board_swimlanes.deleteMany({
      where: { boards: { organization_id: organizationId } },
    })
    await prisma.boards.deleteMany({ where: { organization_id: organizationId } })
    await prisma.user_groups.deleteMany({ where: { organization_id: organizationId } })
    await prisma.business_impacts.deleteMany({ where: { organization_id: organizationId } })
    await prisma.idea_types.deleteMany({ where: { organization_id: organizationId } })
    await prisma.statuses.deleteMany({ where: { organization_id: organizationId } })
    await prisma.users.deleteMany({ where: { organization_id: organizationId } })
    await prisma.organizations.deleteMany({ where: { id: organizationId } })
    await prisma.$disconnect()
  })

  const TABLE = () =>
    CALLERS.flatMap(([label, caller]) => [
      [label, caller, 'Organization', openBoard, true] as const,
      [label, caller, 'Restricted', lockedBoard, label !== 'not granted'] as const,
    ])

  it('BAG-3 table through BoardService over Prisma: listed and readable exactly when the rule says', async () => {
    for (const [label, caller, visibility, boardId, sees] of TABLE()) {
      const { boardService } = services(caller)
      const listed = (await boardService.list(organizationId)).map((b) => b.boardId)
      const read = await boardService.getById(boardId).then(
        () => true,
        (error: unknown) => {
          expect(error, `${label} / ${visibility}`).toBeInstanceOf(NotFoundError)
          return false
        },
      )

      expect(listed.includes(boardId), `${label} lists the ${visibility} board`).toBe(sees)
      expect(read, `${label} reads the ${visibility} board`).toBe(sees)
    }
  })

  it('BAG-3 table through the SQL lookups: canSeeBoard and visibleBoardIds agree with the rule', async () => {
    const { boards } = services(ctx(adminId, Role.OrgAdmin))
    // Org Admins never reach the SQL (board-access.ts skips it), so the SQL is held to the
    // four callers whose sight depends on it.
    for (const [label, caller, visibility, boardId, sees] of TABLE()) {
      if (caller.role === Role.OrgAdmin) continue
      const userId = caller.userId as string

      expect(
        await boards.canSeeBoard(boardId, organizationId, userId),
        `${label} / ${visibility}: canSeeBoard`,
      ).toBe(sees)
      expect(
        (await boards.visibleBoardIds(organizationId, userId)).includes(boardId),
        `${label} / ${visibility}: visibleBoardIds`,
      ).toBe(sees)
    }
  })

  it('2d: a Restricted board with an empty list is seen by Org Admins and its creator only, in both halves', async () => {
    const { boards } = services(ctx(adminId, Role.OrgAdmin))
    for (const [label, caller] of CALLERS) {
      const expected = label === 'Org Admin' || label === 'the creator'
      const listed = (await services(caller).boardService.list(organizationId)).map(
        (b) => b.boardId,
      )
      expect(listed.includes(emptyListBoard), `${label} lists it`).toBe(expected)
      if (caller.role !== Role.OrgAdmin) {
        expect(
          await boards.canSeeBoard(emptyListBoard, organizationId, caller.userId as string),
        ).toBe(expected)
      }
    }
  })

  it('BAG-3d: joining and leaving the group changes both halves on the next read, with no board written', async () => {
    const before = await prisma.boards.findUniqueOrThrow({ where: { id: lockedBoard } })
    const sees = async () => {
      const { boards, boardService } = services(ctx(outsiderId))
      const viaService = await boardService.getById(lockedBoard).then(
        () => true,
        () => false,
      )
      return {
        viaService,
        canSee: await boards.canSeeBoard(lockedBoard, organizationId, outsiderId),
        visible: (await boards.visibleBoardIds(organizationId, outsiderId)).includes(lockedBoard),
      }
    }

    expect(await sees()).toEqual({ viaService: false, canSee: false, visible: false })

    await prisma.user_group_members.create({ data: { group_id: groupId, user_id: outsiderId } })
    try {
      expect(await sees()).toEqual({ viaService: true, canSee: true, visible: true })
    } finally {
      await prisma.user_group_members.deleteMany({
        where: { group_id: groupId, user_id: outsiderId },
      })
    }

    expect(await sees()).toEqual({ viaService: false, canSee: false, visible: false })
    const after = await prisma.boards.findUniqueOrThrow({ where: { id: lockedBoard } })
    expect(after.updated_at_utc).toEqual(before.updated_at_utc)
  })

  it('4c: the Ideas list and a title search leave the hidden idea out for OUTSIDER and keep it for a grantee', async () => {
    const outsider = services(ctx(outsiderId)).ideaService
    const list = await outsider.listByOrganization(organizationId, ORG_LIST_QUERY)
    const search = await outsider.listByOrganization(organizationId, {
      ...ORG_LIST_QUERY,
      search: hiddenTitle,
    })

    for (const body of [list, search]) {
      expect(JSON.stringify(body)).not.toContain(hiddenIdea)
      expect(JSON.stringify(body)).not.toContain(hiddenTitle)
    }
    expect(list.items.map((i) => i.ideaId)).toEqual([openIdea])
    expect(search.totalCount).toBe(0)

    for (const granted of [directId, groupedId, creatorId]) {
      const page = await services(ctx(granted)).ideaService.listByOrganization(organizationId, {
        ...ORG_LIST_QUERY,
        search: hiddenTitle,
      })
      expect(
        page.items.map((i) => i.ideaId),
        granted,
      ).toEqual([hiddenIdea])
    }
  })

  it('4a: the hidden idea’s read is 404 for OUTSIDER through the real by-id check', async () => {
    await expect(services(ctx(outsiderId)).ideaService.getById(hiddenIdea)).rejects.toThrow(
      NotFoundError,
    )
    await expect(services(ctx(groupedId)).ideaService.getById(hiddenIdea)).resolves.toMatchObject({
      ideaId: hiddenIdea,
    })
  })
})
