// The BAG-4 leak matrix at the HTTP boundary (SPEC/20-feature-board-access-and-groups.md BAG-4;
// SPEC/contracts/boards.md "Board access"): for a caller who cannot see board B, every item on B
// (idea, Issue, task) behaves as if it did not exist.
//
// The fixture is the one the spec's oracle names: two users of one organization - INSIDER, granted
// on the Restricted board directly, and OUTSIDER, not granted - and a Restricted board holding one
// idea, one Issue and one task, beside an Organization board holding one idea, so every list read
// is proven to FILTER rather than merely to be empty: INSIDER gets the hidden items back from the
// same read that leaves them out for OUTSIDER.
//
// The controllers are the real ones over the real Application services; only the ports are
// in-memory. The list fakes honour the `visibleBoardIds` filter the service hands them (`null` is
// every board) and nothing else decides sight, so a service that forgot to pass the filter, or
// passed the wrong set, leaks in these tests. Every port is strict: a method a test did not expect
// to be reached throws, rather than answering a default that could hide a path.
//
// A non-member's response must contain neither the idea's id nor its title anywhere in its body
// (BAG-4 oracle), asserted by string search over the serialized body. A 404 is additionally asserted
// to be the SAME response a nonexistent id gets, which is what "as if it did not exist" means; it
// necessarily echoes the id the caller typed (in `instance`), exactly as for any missing id.
//
// IdeaService-backed surfaces (the idea read and its history, idea edits and moves, the Ideas
// list, the backlog, board tasks, export/import, idea assignees) are covered at the Application
// level in packages/application/test/ideas/idea-service-board-access-qa.test.ts: a route-level
// fake of IdeaService's twenty ports would restate that suite's harness.

import { randomUUID } from 'node:crypto'
import {
  type AutoCreateTaskPort,
  type BoardRepository,
  BoardService,
} from '@collega/application/boards'
import { type CommentRepository, CommentService } from '@collega/application/comments'
import { type Clock, type CurrentUserContext, type UnitOfWork } from '@collega/application/common'
import { FollowService, type IdeaFollowerRepository } from '@collega/application/following'
import type { IdeaRepository, IdeaService } from '@collega/application/ideas'
import { type IssueTaskRepository, IssueTaskService } from '@collega/application/issue-tasks'
import {
  type InboxRow,
  type NotificationInboxRepository,
  NotificationInboxService,
} from '@collega/application/notifications'
import {
  type OutcomeIdeasPort,
  type OutcomeReadsPort,
  type OutcomeRepository,
  OutcomeService,
  type OutcomeUsersPort,
} from '@collega/application/outcomes'
import {
  type SprintBoardsPort,
  type SprintIssuesPort,
  type SprintRepository,
  SprintService,
  type SprintUsersPort,
} from '@collega/application/sprints'
import type { StatusRepository } from '@collega/application/statuses'
import { type TagRepository, TagService } from '@collega/application/tags'
import { type IdeaUpvoteRepository, UpvoteService } from '@collega/application/upvotes'
import { type Board, createBoard } from '@collega/domain/boards'
import { createComment } from '@collega/domain/comments'
import {
  BoardVisibility,
  IdeaPhase,
  NotificationEventType,
  Priority,
  Role,
  UserStatus,
} from '@collega/domain/enums'
import { createIdea, type Idea, promoteIdeaToIssue } from '@collega/domain/ideas'
import { createOutcome } from '@collega/domain/outcomes'
import { createSprint } from '@collega/domain/sprints'
import { createStatus } from '@collega/domain/statuses'
import { createTag } from '@collega/domain/tags'
import { describe, expect, it } from 'vitest'
import { BoardsController } from '../src/boards/boards.controller.js'
import { CommentsController } from '../src/comments/comments.controller.js'
import { FollowingController } from '../src/following/following.controller.js'
import { IdeasController } from '../src/ideas/ideas.controller.js'
import { IssueTasksController } from '../src/issue-tasks/issue-tasks.controller.js'
import { NotificationsController } from '../src/notifications/notifications.controller.js'
import { OutcomesController } from '../src/outcomes/outcomes.controller.js'
import { SprintsController } from '../src/sprints/sprints.controller.js'
import { TagsController } from '../src/tags/tags.controller.js'
import { renderProblem } from './problem-render.js'

// --- The fixture ----------------------------------------------------------------------------------

const ORG = '11111111-1111-1111-1111-111111111111'
const ADMIN = 'a0000000-0000-0000-0000-00000000000a'
const INSIDER = 'a0000000-0000-0000-0000-000000000001'
const OUTSIDER = 'a0000000-0000-0000-0000-000000000002'

const OPEN_BOARD = 'b0000000-0000-0000-0000-000000000001'
const LOCKED_BOARD = 'b0000000-0000-0000-0000-000000000002'
const STATUS_1 = 'c0000000-0000-0000-0000-000000000001'
const STATUS_2 = 'c0000000-0000-0000-0000-000000000002'
const TYPE = 'e0000000-0000-0000-0000-000000000001'
const IMPACT = 'e0000000-0000-0000-0000-000000000002'

/** The three hidden items. Their ids and titles must never reach OUTSIDER. */
const IDEA = 'd0000000-0000-0000-0000-000000000001'
const ISSUE = 'd0000000-0000-0000-0000-000000000002'
const TASK = 'd0000000-0000-0000-0000-000000000003'
const IDEA_TITLE = 'Quietly acquire Northwind'
const ISSUE_TITLE = 'Draft the Northwind term sheet'
const TASK_TITLE = 'Northwind diligence checklist'
/** The visible item on the Organization board, which both users get. */
const OPEN_IDEA = 'd0000000-0000-0000-0000-000000000009'
const OPEN_TITLE = 'Shorter onboarding'
/** An id that names nothing, for the "as if it did not exist" comparison. */
const MISSING = 'd0000000-0000-0000-0000-0000000000ff'

const HIDDEN = [IDEA, ISSUE, TASK, IDEA_TITLE, ISSUE_TITLE, TASK_TITLE] as const
const HIDDEN_ITEMS = [
  ['idea', IDEA],
  ['Issue', ISSUE],
  ['task', TASK],
] as const

const COMMENT_ON_IDEA = 'f0000000-0000-0000-0000-000000000001'
const TAG = 'f1000000-0000-0000-0000-000000000001'
const OUTCOME = 'f2000000-0000-0000-0000-000000000001'
const OPEN_SPRINT = 'f3000000-0000-0000-0000-000000000001'
const LOCKED_SPRINT = 'f3000000-0000-0000-0000-000000000002'

const NOW = new Date('2026-10-28T12:00:00.000Z')
const CLOCK: Clock = { now: () => NOW }
const UNIT_OF_WORK: UnitOfWork = { saveChanges: async () => {} }
const AUDIT = { write: async () => {} }

const ROLE_OF: Record<string, Role> = {
  [ADMIN]: Role.OrgAdmin,
  [INSIDER]: Role.User,
  [OUTSIDER]: Role.User,
}
const EMAIL_OF: Record<string, string> = {
  [ADMIN]: 'admin@acme.test',
  [INSIDER]: 'insider@acme.test',
  [OUTSIDER]: 'outsider@acme.test',
}

function as(userId: string): CurrentUserContext {
  return {
    isAuthenticated: true,
    userId,
    organizationId: ORG,
    role: ROLE_OF[userId] ?? Role.User,
    isImpersonating: false,
    realUserId: userId,
  }
}

function user(id: string) {
  return {
    id,
    firstName: id === ADMIN ? 'Ada' : id === INSIDER ? 'Ines' : 'Otto',
    lastName: 'Acme',
    email: EMAIL_OF[id] ?? '',
    organizationId: ORG,
    role: ROLE_OF[id] ?? Role.User,
    status: UserStatus.Active,
    portraitPng: null,
  }
}

const USERS = [ADMIN, INSIDER, OUTSIDER].map(user)

/** The rule itself, as the infrastructure lookups answer it for this fixture: the Organization
 * board is everyone's, the Restricted one is its creator's (ADMIN) and INSIDER's. */
const ACCESS = {
  canSeeBoard: async (boardId: string, organizationId: string, userId: string) =>
    organizationId === ORG && (boardId !== LOCKED_BOARD || userId === INSIDER || userId === ADMIN),
  visibleBoardIds: async (organizationId: string, userId: string) =>
    organizationId !== ORG
      ? []
      : userId === INSIDER || userId === ADMIN
        ? [OPEN_BOARD, LOCKED_BOARD]
        : [OPEN_BOARD],
}

function board(id: string, visibility: BoardVisibility): Board {
  return createBoard({
    id,
    organizationId: ORG,
    name: id === LOCKED_BOARD ? 'Northwind deal room' : 'Everyone',
    allowUserStatusUpdate: true,
    orderedLanes: [STATUS_1, STATUS_2].map((statusId) => ({
      statusId,
      isFinal: false,
      referencesBoardId: null,
    })),
    access: {
      visibility,
      userIds: visibility === BoardVisibility.Restricted ? [INSIDER] : [],
      groupIds: [],
    },
    nowUtc: NOW,
    actorUserId: ADMIN,
  })
}

const BOARDS = [
  board(OPEN_BOARD, BoardVisibility.Organization),
  board(LOCKED_BOARD, BoardVisibility.Restricted),
]

function item(
  id: string,
  title: string,
  boardId: string,
  options: { delivery?: boolean; parentIdeaId?: string } = {},
): Idea {
  const base = createIdea({
    id,
    organizationId: ORG,
    boardId,
    statusId: STATUS_1,
    title,
    description: `${title}.`,
    problem: 'A problem.',
    proposedSolutions: ['A solution.'],
    impactRationale: 'A rationale.',
    priority: Priority.Medium,
    ideaTypeId: TYPE,
    businessImpactId: IMPACT,
    dueDate: null,
    authorUserId: INSIDER,
    assigneeUserIds: [],
    tagIds: [TAG],
    mentionedUserIds: [],
    nowUtc: NOW,
  })
  const placed = { ...base, parentIdeaId: options.parentIdeaId ?? null }
  return options.delivery
    ? promoteIdeaToIssue(
        placed,
        { effort: 'Medium' as never, sprintId: null, currentUpvoteCount: 0 },
        NOW,
        INSIDER,
      )
    : placed
}

const IDEAS: readonly Idea[] = [
  item(IDEA, IDEA_TITLE, LOCKED_BOARD),
  item(ISSUE, ISSUE_TITLE, LOCKED_BOARD, { delivery: true }),
  item(TASK, TASK_TITLE, LOCKED_BOARD, { parentIdeaId: ISSUE }),
  item(OPEN_IDEA, OPEN_TITLE, OPEN_BOARD),
]
const ideaById = (id: string) => IDEAS.find((i) => i.id === id) ?? null

/** `null` is every board; an item on no board always passes (board-access.ts). */
function onVisible(boardId: string | null, visible: readonly string[] | null | undefined): boolean {
  return visible == null || boardId === null || visible.includes(boardId)
}

// --- Harness helpers ------------------------------------------------------------------------------

/** A port whose every unimplemented method fails the test that reached it. */
function port<T extends object>(name: string, impl: Partial<T>): T {
  return new Proxy(impl, {
    get(target, prop) {
      if (prop in target) return target[prop as keyof typeof target]
      // `await port` and vitest's pretty-printer probe these; neither is a call to the port.
      if (prop === 'then' || typeof prop === 'symbol' || prop === 'toJSON') return undefined
      throw new Error(`${name}.${String(prop)} was reached, which this test did not expect.`)
    },
  }) as T
}

/** The serialized body must not carry a hidden item's id or title anywhere. */
function expectNoLeak(body: unknown): void {
  const serialized = JSON.stringify(body)
  for (const secret of HIDDEN) {
    expect(serialized, `the body names "${secret}"`).not.toContain(secret)
  }
}

/** The serialized body carries every given id or title, proving the read is not simply empty. */
function expectShows(body: unknown, ...values: string[]): void {
  const serialized = JSON.stringify(body)
  for (const value of values) {
    expect(serialized).toContain(value)
  }
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    (value) => {
      throw new Error(`expected a refusal, got ${JSON.stringify(value)}`)
    },
    (error: unknown) => error,
  )
}

/** The response for `call(id)`, without its random `traceId` and with the addressed id replaced, so
 * two responses for different ids compare equal when they differ only in that id. */
async function problemFor(
  call: (id: string) => Promise<unknown>,
  id: string,
  url: (id: string) => string,
) {
  const { status, body } = renderProblem(await rejectionOf(call(id)), url(id))
  const { traceId: _random, ...rest } = body
  return { status, body: JSON.parse(JSON.stringify(rest).replaceAll(id, '{id}')) }
}

/** BAG-4a/b: `404`, never `403`, and indistinguishable from a nonexistent id. */
async function expectAsIfMissing(
  call: (id: string) => Promise<unknown>,
  hiddenId: string,
  url: (id: string) => string,
): Promise<void> {
  const hidden = await problemFor(call, hiddenId, url)
  const missing = await problemFor(call, MISSING, url)

  expect(hidden.status).toBe(404)
  expect(hidden).toEqual(missing)
  // The id the caller typed is echoed in `instance`, as for any missing id; titles never are.
  for (const title of [IDEA_TITLE, ISSUE_TITLE, TASK_TITLE]) {
    expect(JSON.stringify(hidden.body)).not.toContain(title)
  }
}

// --- Boards ---------------------------------------------------------------------------------------

function boardsController(currentUser: CurrentUserContext) {
  const boardsById = new Map(BOARDS.map((b) => [b.id, b]))
  const statuses = [STATUS_1, STATUS_2].map((id, index) =>
    createStatus({
      id,
      organizationId: ORG,
      name: `Status ${index + 1}`,
      color: '#123456',
      sortOrder: index * 10,
      nowUtc: NOW,
      actorUserId: ADMIN,
    }),
  )
  const added: Board[] = []
  const boards = port<BoardRepository>('boards', {
    ...ACCESS,
    getById: async (id) => boardsById.get(id) ?? null,
    listByOrganization: async (organizationId) =>
      [...boardsById.values()].filter((b) => b.organizationId === organizationId),
    listGroupIdsForUser: async () => [],
    countIdeasByBoard: async (ids) =>
      new Map(ids.map((id) => [id, IDEAS.filter((i) => i.boardId === id).length])),
    countIdeasByBoardAndStatus: async () => [],
    countIdeasByBoardAndTag: async () => [],
    getUserNames: async (ids) =>
      new Map(ids.map((id) => [id, { firstName: user(id).firstName, lastName: 'Acme' }])),
    listLaneIdeas: async () => [],
    listOrganizationUserIds: async () => USERS.map((u) => u.id),
    listOrganizationGroupIds: async () => [],
    listIdeaTypes: async () => [],
    isStatusReferenced: async () => false,
    add: async (b) => {
      added.push(b)
    },
    // Naming a board as a lane's target turns its idea features off (contracts/boards.md).
    save: async () => {},
    listPullCandidates: async (query) => {
      const items = IDEAS.filter(
        (i) =>
          i.boardId !== null &&
          i.parentIdeaId === null &&
          i.phase === IdeaPhase.Discovery &&
          onVisible(i.boardId, query.visibleBoardIds),
      ).map((i) => ({
        ideaId: i.id,
        title: i.title,
        authorUserId: i.authorUserId,
        authorName: 'Ines Acme',
        boardId: i.boardId,
        boardName: boardsById.get(i.boardId ?? '')?.name ?? null,
        statusId: i.statusId,
        statusName: 'Status 1',
        phase: i.phase,
        tags: [],
        priority: i.priority,
        upvoteCount: 0,
        isMine: i.authorUserId === query.currentUserId,
      }))
      return { items, page: 1, pageSize: 20, totalCount: items.length, hiddenTaskCount: 0 }
    },
  })
  const service = new BoardService(
    boards,
    port<StatusRepository>('statuses', {
      getById: async (id: string) => statuses.find((s) => s.id === id) ?? null,
      listActiveByOrganization: async () => statuses,
      listByOrganization: async () => statuses,
    }),
    { existsById: async (id) => id === ORG },
    UNIT_OF_WORK,
    AUDIT,
    currentUser,
    CLOCK,
    port<IdeaRepository>('ideas', { getById: async (id: string) => ideaById(id) }),
    port<AutoCreateTaskPort>('tasks', {}),
  )
  return { controller: new BoardsController(service), added }
}

describe('BAG-4 boards', () => {
  it('4c: the board list leaves the Restricted board out for OUTSIDER and lists it for INSIDER', async () => {
    const outsider = await boardsController(as(OUTSIDER)).controller.list(ORG, undefined)
    const insider = await boardsController(as(INSIDER)).controller.list(ORG, undefined)

    expect(outsider.map((b) => b.boardId)).toEqual([OPEN_BOARD])
    expect(JSON.stringify(outsider)).not.toContain(LOCKED_BOARD)
    expect(JSON.stringify(outsider)).not.toContain('Northwind')
    expect(insider.map((b) => b.boardId).sort()).toEqual([OPEN_BOARD, LOCKED_BOARD].sort())
  })

  it('4a: the board read is 404 for OUTSIDER, the same as a board that does not exist', async () => {
    const { controller } = boardsController(as(OUTSIDER))
    const hidden = renderProblem(
      await rejectionOf(controller.getById(LOCKED_BOARD)),
      `/api/v1/boards/${LOCKED_BOARD}`,
    )
    const missing = renderProblem(
      await rejectionOf(controller.getById(MISSING)),
      `/api/v1/boards/${MISSING}`,
    )

    expect(hidden.status).toBe(404)
    expect(hidden.body.title).toBe(missing.body.title)
    expect(hidden.body.detail).toBe(missing.body.detail)
    expect(JSON.stringify(hidden.body)).not.toContain('Northwind')
    await expect(
      boardsController(as(INSIDER)).controller.getById(LOCKED_BOARD),
    ).resolves.toMatchObject({
      boardId: LOCKED_BOARD,
      visibility: BoardVisibility.Restricted,
    })
  })

  it('4b: changing the board’s access is 404 for OUTSIDER, never 403', async () => {
    const { controller } = boardsController(as(OUTSIDER))
    const error = await rejectionOf(
      controller.setAccess(LOCKED_BOARD, {
        visibility: 'Organization',
        userIds: [],
        groupIds: [],
      }),
    )

    expect(renderProblem(error, `/api/v1/boards/${LOCKED_BOARD}/access`).status).toBe(404)
  })

  it('4e: pull candidates leave the Restricted board’s idea out for OUTSIDER and offer it to INSIDER', async () => {
    const query = { source: 'boards' }
    const outsider = await boardsController(as(OUTSIDER)).controller.pullCandidates(ORG, query)
    const insider = await boardsController(as(INSIDER)).controller.pullCandidates(ORG, query)

    expectNoLeak(outsider)
    expectShows(outsider, OPEN_IDEA)
    expect(outsider.totalCount).toBe(1)
    expectShows(insider, IDEA, IDEA_TITLE, OPEN_IDEA)
  })

  it('4e: pulling the hidden idea into a new board is refused for OUTSIDER exactly as a missing id is', async () => {
    const body = (pullItemId: string) => ({
      name: 'My board',
      swimlanes: [
        { statusId: STATUS_1, order: 0 },
        { statusId: STATUS_2, order: 1 },
      ],
      pullItemIds: [pullItemId],
    })
    const outsider = boardsController(as(OUTSIDER))
    const url = `/api/v1/organizations/${ORG}/boards`
    const hidden = renderProblem(
      await rejectionOf(outsider.controller.create(ORG, body(IDEA))),
      url,
    )
    const missing = renderProblem(
      await rejectionOf(boardsController(as(OUTSIDER)).controller.create(ORG, body(MISSING))),
      url,
    )
    const scrub = (problem: typeof hidden, id: string) => {
      const { traceId: _random, ...rest } = problem.body
      return JSON.parse(JSON.stringify(rest).replaceAll(id, '{id}'))
    }

    expect(hidden.status).toBe(missing.status)
    expect(scrub(hidden, IDEA)).toEqual(scrub(missing, MISSING))
    expect(JSON.stringify(hidden.body)).not.toContain(IDEA_TITLE)
    expect(outsider.added).toEqual([])
  })

  it('4d: a new lane referencing a board the caller cannot see is 422 referencesBoardInvalid, as for an unknown board', async () => {
    const body = (referencesBoardId: string) => ({
      name: 'My board',
      swimlanes: [
        { statusId: STATUS_1, order: 0 },
        { statusId: STATUS_2, order: 1, referencesBoardId },
      ],
    })
    const hidden = boardsController(as(OUTSIDER))
    const refused = renderProblem(
      await rejectionOf(hidden.controller.create(ORG, body(LOCKED_BOARD))),
      `/api/v1/organizations/${ORG}/boards`,
    )
    const unknown = renderProblem(
      await rejectionOf(boardsController(as(OUTSIDER)).controller.create(ORG, body(MISSING))),
      `/api/v1/organizations/${ORG}/boards`,
    )

    expect(refused.status).toBe(422)
    expect(JSON.stringify(refused.body)).toContain('referencesBoardInvalid')
    const { traceId: _a, ...refusedBody } = refused.body
    const { traceId: _b, ...unknownBody } = unknown.body
    expect(refusedBody).toEqual(unknownBody)
    expect(hidden.added).toEqual([])
  })

  it('4d: INSIDER, who can see the board, may reference it', async () => {
    const granted = boardsController(as(INSIDER))

    await granted.controller.create(ORG, {
      name: 'My board',
      swimlanes: [
        { statusId: STATUS_1, order: 0 },
        { statusId: STATUS_2, order: 1, referencesBoardId: LOCKED_BOARD },
      ],
    })

    expect(granted.added).toHaveLength(1)
  })
})

// --- Comments, upvotes and following (4a, 4b, 4h) ----------------------------------------------------

function commentsController(currentUser: CurrentUserContext) {
  const comments = [
    createComment({
      id: COMMENT_ON_IDEA,
      ideaId: IDEA,
      authorUserId: INSIDER,
      body: `About ${IDEA_TITLE}`,
      mentionedUserIds: [],
      nowUtc: NOW,
    }),
  ]
  const added: unknown[] = []
  const service = new CommentService(
    port<CommentRepository>('comments', {
      getById: async (id: string) => comments.find((c) => c.id === id) ?? null,
      listByIdea: async (filter: { ideaId: string }) => {
        const items = comments.filter((c) => c.ideaId === filter.ideaId)
        return {
          items,
          page: 1,
          pageSize: 20,
          totalCount: items.length,
          sortBy: null,
          sortDirection: 'asc' as const,
        }
      },
      add: async (c: unknown) => {
        added.push(c)
      },
    }),
    {
      getById: async (id) => {
        const found = ideaById(id)
        return found
          ? {
              id: found.id,
              organizationId: found.organizationId,
              boardId: found.boardId,
              title: found.title,
              authorUserId: found.authorUserId,
              assigneeUserIds: found.assigneeUserIds,
            }
          : null
      },
    },
    { listFollowerIds: async () => [] },
    {
      listByIds: async (ids) => USERS.filter((u) => ids.includes(u.id)),
      findByNormalizedEmail: async (email) => USERS.find((u) => u.email === email) ?? null,
    },
    { notify: async () => {} },
    UNIT_OF_WORK,
    AUDIT,
    currentUser,
    CLOCK,
    ACCESS,
  )
  return { controller: new CommentsController(service), added }
}

function upvoteRoute(currentUser: CurrentUserContext) {
  const service = new UpvoteService(
    port<IdeaUpvoteRepository>('upvotes', {
      getByIdeaAndUser: async () => null,
      add: async () => {},
      countByIdea: async () => 1,
    }),
    {
      getPlacement: async (id) => {
        const found = ideaById(id)
        return found ? { organizationId: found.organizationId, boardId: found.boardId } : null
      },
    },
    UNIT_OF_WORK,
    AUDIT,
    currentUser,
    CLOCK,
    ACCESS,
  )
  return new IdeasController(port<IdeaService>('ideaService', {}), service)
}

function followingController(currentUser: CurrentUserContext) {
  const service = new FollowService(
    port<IdeaFollowerRepository>('followers', {
      add: async () => {},
      remove: async () => {},
      isFollowing: async () => false,
      countByIdea: async () => 1,
    }),
    {
      getById: async (id) => {
        const found = ideaById(id)
        return found ? { organizationId: found.organizationId, boardId: found.boardId } : null
      },
    },
    UNIT_OF_WORK,
    currentUser,
    CLOCK,
    ACCESS,
  )
  return new FollowingController(service)
}

describe('BAG-4 comments, upvotes and following', () => {
  it.each(HIDDEN_ITEMS)(
    '4a: the comment list of the hidden %s is 404 for OUTSIDER, as for a missing id',
    async (_label, hiddenId) => {
      const { controller } = commentsController(as(OUTSIDER))

      await expectAsIfMissing(
        (id) => controller.listByIdea(id, {}),
        hiddenId,
        (id) => `/api/v1/ideas/${id}/comments`,
      )
    },
  )

  it('4a: INSIDER reads the same comment list', async () => {
    const result = await commentsController(as(INSIDER)).controller.listByIdea(IDEA, {})

    expectShows(result, COMMENT_ON_IDEA, IDEA)
  })

  it.each(HIDDEN_ITEMS)(
    '4b: commenting on the hidden %s is 404 for OUTSIDER, and writes nothing',
    async (_label, hiddenId) => {
      const { controller, added } = commentsController(as(OUTSIDER))

      await expectAsIfMissing(
        (id) => controller.create(id, { body: 'Hello' }),
        hiddenId,
        (id) => `/api/v1/ideas/${id}/comments`,
      )
      expect(added).toEqual([])
    },
  )

  it('4b: editing and deleting a comment on a hidden item are 404 for OUTSIDER', async () => {
    const { controller } = commentsController(as(OUTSIDER))

    for (const call of [
      () => controller.update(COMMENT_ON_IDEA, { body: 'Edited' }),
      () => controller.delete(COMMENT_ON_IDEA),
    ]) {
      const { status, body } = renderProblem(
        await rejectionOf(call()),
        `/api/v1/comments/${COMMENT_ON_IDEA}`,
      )
      expect(status).toBe(404)
      expectNoLeak(body)
    }
  })

  it.each(HIDDEN_ITEMS)(
    '4b: upvoting the hidden %s is 404 for OUTSIDER',
    async (_label, hiddenId) => {
      const controller = upvoteRoute(as(OUTSIDER))

      await expectAsIfMissing(
        (id) => controller.toggleUpvote(id),
        hiddenId,
        (id) => `/api/v1/ideas/${id}/upvote/toggle`,
      )
    },
  )

  it('4b: INSIDER upvotes the same idea', async () => {
    await expect(upvoteRoute(as(INSIDER)).toggleUpvote(IDEA)).resolves.toBeDefined()
  })

  it.each(HIDDEN_ITEMS)(
    '4b: following and unfollowing the hidden %s are 404 for OUTSIDER',
    async (_label, hiddenId) => {
      const controller = followingController(as(OUTSIDER))

      await expectAsIfMissing(
        (id) => controller.follow(id),
        hiddenId,
        (id) => `/api/v1/ideas/${id}/follow`,
      )
      await expectAsIfMissing(
        (id) => controller.unfollow(id),
        hiddenId,
        (id) => `/api/v1/ideas/${id}/follow`,
      )
    },
  )

  it('4b: INSIDER follows the same idea', async () => {
    await expect(followingController(as(INSIDER)).follow(IDEA)).resolves.toBeDefined()
  })

  it('4h: INSIDER mentioning OUTSIDER on the Restricted board is 400 keyed mentionEmails, and nothing is written', async () => {
    const { controller, added } = commentsController(as(INSIDER))
    const { status, body } = renderProblem(
      await rejectionOf(
        controller.create(IDEA, { body: 'Look at this', mentionEmails: [EMAIL_OF[OUTSIDER]] }),
      ),
      `/api/v1/ideas/${IDEA}/comments`,
    )

    expect(status).toBe(400)
    expect(Object.keys(body.errors as object)).toEqual(['mentionEmails'])
    expect(added).toEqual([])
  })

  it('4h: mentioning someone who can see the board is accepted', async () => {
    const { controller, added } = commentsController(as(OUTSIDER))

    await controller.create(OPEN_IDEA, { body: 'Look', mentionEmails: [EMAIL_OF[INSIDER]] })
    const granted = commentsController(as(ADMIN))
    await granted.controller.create(IDEA, { body: 'Look', mentionEmails: [EMAIL_OF[INSIDER]] })

    expect(added).toHaveLength(1)
    expect(granted.added).toHaveLength(1)
  })

  // SPEC/contracts/boards.md "Board access": naming a user who cannot see the board is 400 with the
  // message `'{name}' can't see this board.`.
  it('4h: the mention refusal is worded as the contract states', async () => {
    const { controller } = commentsController(as(INSIDER))
    const { body } = renderProblem(
      await rejectionOf(
        controller.create(IDEA, { body: 'Look at this', mentionEmails: [EMAIL_OF[OUTSIDER]] }),
      ),
      `/api/v1/ideas/${IDEA}/comments`,
    )

    expect((body.errors as Record<string, string[]>).mentionEmails).toEqual([
      "'Otto Acme' can't see this board.",
    ])
  })
})

// --- Issue tasks (4a, 4b, 4h) --------------------------------------------------------------------

function issueTasksController(currentUser: CurrentUserContext) {
  const added: unknown[] = []
  const service = new IssueTaskService(
    port<IssueTaskRepository>('issueTasks', {
      listByIdea: async () => [],
      add: async (task: unknown) => {
        added.push(task)
      },
    }),
    { getById: async (id) => ideaById(id) },
    { listByIds: async (ids) => USERS.filter((u) => ids.includes(u.id)) },
    { notify: async () => {} },
    UNIT_OF_WORK,
    currentUser,
    CLOCK,
    ACCESS,
  )
  return { controller: new IssueTasksController(service), added }
}

describe('BAG-4 Issue checklist', () => {
  it.each(HIDDEN_ITEMS)(
    '4a: the checklist of the hidden %s is 404 for OUTSIDER',
    async (_label, hiddenId) => {
      const { controller } = issueTasksController(as(OUTSIDER))

      await expectAsIfMissing(
        (id) => controller.list(id),
        hiddenId,
        (id) => `/api/v1/ideas/${id}/tasks`,
      )
    },
  )

  it('4b: adding a checklist step to the hidden Issue is 404 for OUTSIDER, and writes nothing', async () => {
    const { controller, added } = issueTasksController(as(OUTSIDER))

    await expectAsIfMissing(
      (id) => controller.create(id, { title: 'Step' }),
      ISSUE,
      (id) => `/api/v1/ideas/${id}/tasks`,
    )
    expect(added).toEqual([])
  })

  it('4h: INSIDER assigning a step to OUTSIDER is 400 keyed assigneeUserId, and nothing is written', async () => {
    const { controller, added } = issueTasksController(as(INSIDER))
    const { status, body } = renderProblem(
      await rejectionOf(controller.create(ISSUE, { title: 'Step', assigneeUserId: OUTSIDER })),
      `/api/v1/ideas/${ISSUE}/tasks`,
    )

    expect(status).toBe(400)
    expect(Object.keys(body.errors as object)).toEqual(['assigneeUserId'])
    expect(added).toEqual([])
  })

  it('4h: INSIDER may assign a step to themselves', async () => {
    const { controller, added } = issueTasksController(as(INSIDER))

    await controller.create(ISSUE, { title: 'Step', assigneeUserId: INSIDER })

    expect(added).toHaveLength(1)
  })
})

// --- Inbox (4c, 4f) ------------------------------------------------------------------------------

function notificationsController(currentUser: CurrentUserContext) {
  const row = (ideaId: string, title: string, boardName: string) =>
    ({
      id: randomUUID(),
      eventType: NotificationEventType.CommentAdded,
      ideaId,
      ideaTitle: title,
      link: `/ideas/${ideaId}`,
      actor: null,
      statusName: null,
      boardName,
      occurredAtUtc: NOW,
      readAtUtc: null,
    }) satisfies InboxRow
  // Both users hold a stored event about each idea: the events are kept whoever can see (4f).
  const rows = [
    { boardId: LOCKED_BOARD, row: row(IDEA, IDEA_TITLE, 'Northwind deal room') },
    { boardId: OPEN_BOARD, row: row(OPEN_IDEA, OPEN_TITLE, 'Everyone') },
  ]
  const visibleRows = (visible: readonly string[] | null | undefined) =>
    rows.filter((r) => onVisible(r.boardId, visible)).map((r) => r.row)
  const service = new NotificationInboxService(
    port<NotificationInboxRepository>('inbox', {
      listForRecipient: async (query) => {
        const items = visibleRows(query.visibleBoardIds)
        return { items, page: 1, pageSize: 20, totalCount: items.length }
      },
      countUnread: async (_recipient, _since, visible) => visibleRows(visible).length,
    }),
    currentUser,
    CLOCK,
    ACCESS,
  )
  return new NotificationsController(service)
}

describe('BAG-4 inbox', () => {
  it('4f: the inbox and the unread count leave out events about the hidden idea for OUTSIDER', async () => {
    const controller = notificationsController(as(OUTSIDER))
    const page = await controller.list({})
    const unread = await controller.unreadCount()

    expectNoLeak(page)
    expectShows(page, OPEN_IDEA)
    expect(page.totalCount).toBe(1)
    expect(unread).toEqual({ unreadCount: 1 })
  })

  it('4f: INSIDER, reading the same stored events, gets both', async () => {
    const controller = notificationsController(as(INSIDER))

    expectShows(await controller.list({}), IDEA, IDEA_TITLE, OPEN_IDEA)
    expect(await controller.unreadCount()).toEqual({ unreadCount: 2 })
  })
})

// --- Tag catalog (4c) ----------------------------------------------------------------------------

function tagsController(currentUser: CurrentUserContext) {
  const tag = createTag({
    id: TAG,
    organizationId: ORG,
    name: 'strategy',
    color: '#336699',
    nowUtc: NOW,
    actorUserId: ADMIN,
  })
  const service = new TagService(
    port<TagRepository>('tags', {
      listByOrganization: async () => [tag],
      usageByTagIds: async (_ids, visible) => {
        const tagged = IDEAS.filter((i) => i.tagIds.includes(TAG) && onVisible(i.boardId, visible))
        const boards = [...new Set(tagged.flatMap((i) => (i.boardId ? [i.boardId] : [])))].map(
          (boardId) => ({ boardId, name: BOARDS.find((b) => b.id === boardId)?.name ?? '' }),
        )
        return new Map([[TAG, { ideaCount: tagged.length, boards }]])
      },
      getCreatorNames: async () => new Map(),
    }),
    { existsById: async (id) => id === ORG },
    AUDIT,
    currentUser,
    CLOCK,
    { nextInt: () => 0 },
    ACCESS,
  )
  return new TagsController(service)
}

describe('BAG-4 tag catalog', () => {
  it('4c: usage counts and boards leave the Restricted board out for OUTSIDER', async () => {
    const outsider = await tagsController(as(OUTSIDER)).catalog(ORG)
    const insider = await tagsController(as(INSIDER)).catalog(ORG)

    expect(outsider[0]?.ideaCount).toBe(1)
    expect(JSON.stringify(outsider)).not.toContain(LOCKED_BOARD)
    expect(JSON.stringify(outsider)).not.toContain('Northwind')
    expect(insider[0]?.ideaCount).toBe(4)
    expectShows(insider, LOCKED_BOARD)
  })
})

// --- Outcomes and the Roadmap (4c) -------------------------------------------------------------------

function outcomesController(currentUser: CurrentUserContext) {
  const outcome = createOutcome({
    id: OUTCOME,
    organizationId: ORG,
    name: 'Grow',
    description: null,
    targetStartDate: '2026-10-01',
    targetEndDate: '2026-12-31',
    ownerUserId: null,
    sortOrder: 0,
    color: '#336699',
    nowUtc: NOW,
    actorUserId: ADMIN,
  })
  // ISSUE (hidden) and OPEN_IDEA are grouped under the Outcome; IDEA (hidden) is ungrouped.
  const grouped = IDEAS.filter((i) => i.id === ISSUE || i.id === OPEN_IDEA)
  const ungrouped = IDEAS.filter((i) => i.id === IDEA)
  const project = (i: Idea) => ({
    ideaId: i.id,
    itemKey: null,
    title: i.title,
    statusId: i.statusId,
    effort: null,
    assigneeUserIds: [],
    sprintId: null,
    sprintStart: null,
    sprintEnd: null,
    metrics: [],
  })
  const service = new OutcomeService(
    port<OutcomeRepository>('outcomes', {
      listByOrganization: async () => [outcome],
      getById: async (id) => (id === OUTCOME ? outcome : null),
    }),
    port<OutcomeReadsPort>('outcomeReads', {
      rollupsByOutcomeIds: async (_ids, visible) => {
        const ideas = grouped.filter((i) => onVisible(i.boardId, visible))
        return new Map([
          [
            OUTCOME,
            {
              ideaCount: ideas.length,
              doneIdeaCount: 0,
              taskCount: 0,
              doneTaskCount: 0,
              sprintStart: null,
              sprintEnd: null,
              metricTotals: [],
            },
          ],
        ])
      },
      ideasByOutcomeIds: async (_ids, visible) =>
        new Map([[OUTCOME, grouped.filter((i) => onVisible(i.boardId, visible)).map(project)]]),
      listUngroupedIdeas: async (_org, visible) =>
        ungrouped.filter((i) => onVisible(i.boardId, visible)).map(project),
    }),
    port<OutcomeIdeasPort>('outcomeIdeas', {}),
    port<OutcomeUsersPort>('outcomeUsers', {}),
    UNIT_OF_WORK,
    AUDIT,
    currentUser,
    CLOCK,
    { nextInt: () => 0 },
    ACCESS,
  )
  return new OutcomesController(service)
}

describe('BAG-4 Outcomes and Roadmap', () => {
  it('4c: the Roadmap and the Outcome totals leave the hidden items out for OUTSIDER', async () => {
    const controller = outcomesController(as(OUTSIDER))
    const roadmap = await controller.roadmap(ORG)
    const list = await controller.list(ORG, {})
    const detail = await controller.getById(ORG, OUTCOME)

    for (const body of [roadmap, list, detail]) expectNoLeak(body)
    expectShows(roadmap, OPEN_IDEA)
    expect(list.items[0]?.ideaCount).toBe(1)
    expect(roadmap.ungrouped).toEqual([])
  })

  it('4c: INSIDER gets the same reads with the hidden items in them', async () => {
    const controller = outcomesController(as(INSIDER))
    const roadmap = await controller.roadmap(ORG)

    expectShows(roadmap, ISSUE, ISSUE_TITLE, IDEA, IDEA_TITLE, OPEN_IDEA)
    expect((await controller.list(ORG, {})).items[0]?.ideaCount).toBe(2)
  })
})

// --- Sprints (4a, 4c) ----------------------------------------------------------------------------

function sprintsController(currentUser: CurrentUserContext) {
  const sprint = (id: string, boardId: string, name: string) =>
    createSprint({
      id,
      organizationId: ORG,
      name,
      goal: null,
      startDate: '2026-10-26',
      endDate: '2026-11-06',
      ownerUserId: null,
      boardId,
      nowUtc: NOW,
      actorUserId: ADMIN,
    })
  const sprints = [
    sprint(OPEN_SPRINT, OPEN_BOARD, 'Sprint 1'),
    sprint(LOCKED_SPRINT, LOCKED_BOARD, 'Northwind sprint'),
  ]
  const service = new SprintService(
    port<SprintRepository>('sprints', {
      listByOrganization: async () => sprints,
      listByBoard: async (boardId) => sprints.filter((s) => s.boardId === boardId),
      getById: async (id) => sprints.find((s) => s.id === id) ?? null,
    }),
    port<SprintIssuesPort>('sprintIssues', {
      countsBySprintIds: async (ids) =>
        new Map(ids.map((id) => [id, { issueCount: 0, doneCount: 0, ideaCount: 0 }])),
    }),
    port<SprintUsersPort>('sprintUsers', {}),
    UNIT_OF_WORK,
    AUDIT,
    currentUser,
    CLOCK,
    port<SprintBoardsPort>('sprintBoards', {
      getSprintBoard: async (boardId) =>
        BOARDS.some((b) => b.id === boardId)
          ? {
              id: boardId,
              organizationId: ORG,
              sprintsEnabled: true,
              isArchived: false,
              finalStatusIds: [],
            }
          : null,
    }),
    ACCESS,
  )
  return new SprintsController(service, port<IdeaService>('ideaService', {}))
}

describe('BAG-4 sprints', () => {
  it('4c: the organization’s sprint list leaves the Restricted board’s sprint out for OUTSIDER', async () => {
    const outsider = await sprintsController(as(OUTSIDER)).list(ORG, {})
    const insider = await sprintsController(as(INSIDER)).list(ORG, {})

    expect(outsider.map((s) => s.sprintId)).toEqual([OPEN_SPRINT])
    expect(insider.map((s) => s.sprintId).sort()).toEqual([OPEN_SPRINT, LOCKED_SPRINT].sort())
  })

  it('4a: the Restricted board’s sprints and one of its sprints by id are 404 for OUTSIDER', async () => {
    const controller = sprintsController(as(OUTSIDER))

    expect(
      renderProblem(await rejectionOf(controller.listForBoard(LOCKED_BOARD, {})), '/').status,
    ).toBe(404)
    expect(
      renderProblem(await rejectionOf(controller.getById(ORG, LOCKED_SPRINT)), '/').status,
    ).toBe(404)
    await expect(
      sprintsController(as(INSIDER)).listForBoard(LOCKED_BOARD, {}),
    ).resolves.toHaveLength(1)
  })
})
