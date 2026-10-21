// QA for the 2026-10-16 "Board References follow-ups" decision on the board save (SPEC/decisions.md
// items 1 and 2; contracts/boards.md "Pulling items" Auto-create and the task refusal, `autoCreateTask`,
// `ideaMoves`): a card entering an `autoCreateTask` lane by a pull (board create or update) or by a
// bulk lane move gets its one task, staged before the save's commit and finished after it; a task
// the port refuses fails the whole save; a bulk move into an auto-create lane is verified, an
// ordinary lane is not; a task is refused in `pullItemIds` with the exact text, whatever the
// `forceReason`. The task-creation rules themselves are IdeaService's
// (test/ideas/idea-service-task-update-qa.test.ts). Real SQL behaviour is proved in
// packages/infrastructure/test/board-auto-create.integration.test.ts. In-memory ports, fixed clock.

import { createBoard } from '@collega/domain/boards'
import { EffortLevel, IdeaPhase, Priority } from '@collega/domain/enums'
import { createIdea, type Idea } from '@collega/domain/ideas'
import { createStatus } from '@collega/domain/statuses'
import { describe, expect, it } from 'vitest'
import { BoardService } from '../../src/boards/board-service.js'
import type { AutoCreateTaskPort } from '../../src/boards/index.js'
import type { SwimlaneInput } from '../../src/boards/models.js'
import type { BoardRepository, LaneIdea } from '../../src/boards/ports.js'
import {
  type CurrentUserContext,
  UnprocessableError,
  ValidationError,
} from '../../src/common/index.js'
import type { AutoCreateTaskParent } from '../../src/ideas/models.js'
import type { IdeaRepository } from '../../src/ideas/ports.js'
import type { StatusRepository } from '../../src/statuses/ports.js'
import {
  countingUnitOfWork,
  fixedClock,
  member,
  NOW,
  ORG_A,
  orgAdmin,
  recordingAudit,
} from '../support/fixtures.js'

const S1 = 'status-1'
const S2 = 'status-2'
const S3 = 'status-3'
const CHILD = 'child-board'
const TARGET = 'target-board'
const OTHER = 'other-board'
const MEMBER_ID = 'user-1'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const status = (statusId: string) =>
  createStatus({
    id: statusId,
    organizationId: ORG_A,
    name: statusId,
    color: '#123456',
    sortOrder: 1,
    nowUtc: NOW,
    actorUserId: 'seed',
  })

const childBoard = () =>
  createBoard({
    id: CHILD,
    organizationId: ORG_A,
    name: 'Delivery',
    allowUserStatusUpdate: false,
    orderedLanes: [
      { statusId: S1, isFinal: false, referencesBoardId: null },
      { statusId: S2, isFinal: true, referencesBoardId: null },
    ],
    nowUtc: NOW,
    actorUserId: 'seed',
  })

/** S1 plain, S2 hands work to CHILD (auto-creating when asked), S3 plain. */
const targetBoard = (autoCreateTask: boolean) =>
  createBoard({
    id: TARGET,
    organizationId: ORG_A,
    name: 'Target',
    allowUserStatusUpdate: false,
    orderedLanes: [
      { statusId: S1, isFinal: false, referencesBoardId: null },
      { statusId: S2, isFinal: false, referencesBoardId: CHILD, autoCreateTask },
      { statusId: S3, isFinal: false, referencesBoardId: null },
    ],
    nowUtc: NOW,
    actorUserId: 'seed',
  })

function item(n: number, overrides: Partial<Idea> = {}): Idea {
  return {
    ...createIdea({
      id: id(n),
      organizationId: ORG_A,
      boardId: OTHER,
      statusId: S2,
      title: `Item ${n}`,
      description: null,
      problem: 'p',
      proposedSolutions: ['s'],
      impactRationale: 'r',
      priority: Priority.Medium,
      ideaTypeId: 't',
      businessImpactId: 'i',
      dueDate: null,
      authorUserId: MEMBER_ID,
      assigneeUserIds: [],
      tagIds: [],
      mentionedUserIds: [],
      // Distinct creation times, so "oldest first" is a total order.
      nowUtc: new Date(NOW.getTime() - n * 1000),
    }),
    effort: EffortLevel.Medium,
    ...overrides,
  }
}

const laneIdea = (n: number, statusId: string, effort: EffortLevel | null = EffortLevel.Medium) =>
  ({ ideaId: id(n), title: `Lane idea ${n}`, statusId, effort }) satisfies LaneIdea

type Options = {
  user?: CurrentUserContext
  ideas?: readonly Idea[]
  laneIdeas?: readonly LaneIdea[]
  autoCreateTask?: boolean
  /** Ids of parents whose task the port refuses. */
  refuse?: readonly string[]
}

function setup(options: Options = {}) {
  const log: string[] = []
  const staged: { parent: AutoCreateTaskParent; referencedBoardId: string }[] = []
  const verified: { ideaIds: string[]; toStatusId: string }[] = []
  const uow = countingUnitOfWork()
  const committing = {
    async saveChanges() {
      log.push('commit')
      await uow.saveChanges()
    },
  }
  const audit = recordingAudit()
  const recordedWrite = audit.write.bind(audit)
  audit.write = async (event) => {
    log.push(`audit:${event.eventType}`)
    await recordedWrite(event)
  }
  const all = [childBoard(), targetBoard(options.autoCreateTask ?? true)]

  const boards = {
    async add() {
      log.push('add')
    },
    async save() {
      log.push('save')
    },
    async getById(boardId: string) {
      return all.find((b) => b.id === boardId) ?? null
    },
    async listByOrganization() {
      return all
    },
    async countIdeasByBoardAndStatus() {
      return []
    },
    async listLaneIdeas(_boardId: string, statusIds: readonly string[]) {
      return (options.laneIdeas ?? []).filter((l) => statusIds.includes(l.statusId))
    },
    async moveIdeas() {
      log.push('move')
    },
    async verifyIdeasMoved(
      _boardId: string,
      ideas: readonly { ideaId: string }[],
      toStatusId: string,
    ) {
      log.push('verify')
      verified.push({ ideaIds: ideas.map((i) => i.ideaId), toStatusId })
    },
    async reassignIdeas() {
      log.push('reassign')
    },
  } as unknown as BoardRepository

  const tasks: AutoCreateTaskPort = {
    async stageAutoCreatedTask(parent, referencedBoardId) {
      if (options.refuse?.includes(parent.id)) {
        throw new UnprocessableError('referencedBoardArchived', 'The referenced board is archived.')
      }
      log.push(`stage:${parent.id}`)
      staged.push({ parent: { ...parent }, referencedBoardId })
      return async () => {
        log.push(`finish:${parent.id}`)
      }
    },
  }

  const service = new BoardService(
    boards,
    {
      async listByOrganization() {
        return [status(S1), status(S2), status(S3)]
      },
    } as unknown as StatusRepository,
    { existsById: async (orgId: string) => orgId === ORG_A },
    committing,
    audit,
    options.user ?? orgAdmin(),
    fixedClock(),
    {
      async getById(ideaId: string) {
        return options.ideas?.find((i) => i.id === ideaId) ?? null
      },
      async countChildrenByParentIds() {
        return new Map()
      },
    } as unknown as IdeaRepository,
    tasks,
  )
  return { service, log, staged, verified, uow, audit }
}

type Setup = ReturnType<typeof setup>

/** A new board whose S2 lane hands work to CHILD; S1 plain. */
const createLanes = (autoCreateTask: boolean): SwimlaneInput[] => [
  { statusId: S1, order: 0 },
  { statusId: S2, order: 1, referencesBoardId: CHILD, autoCreateTask },
]
const create = (s: Setup, pullItemIds: string[], autoCreateTask = true, forceReason?: string) =>
  s.service.create(ORG_A, {
    name: 'New',
    allowUserStatusUpdate: false,
    swimlanes: createLanes(autoCreateTask),
    pullItemIds,
    forceReason,
  })

/** An edit that keeps S1 and S2 (S2 as the auto-create reference lane) and removes S3. */
const editLanes = (autoCreateTask: boolean): SwimlaneInput[] => [
  { statusId: S1, order: 0 },
  { statusId: S2, order: 1, referencesBoardId: CHILD, autoCreateTask },
]
const update = (
  s: Setup,
  extra: {
    ideaMoves?: { fromStatusId: string; toStatusId: string }[]
    pullItemIds?: string[]
    autoCreateTask?: boolean
  },
) =>
  s.service.update(TARGET, {
    name: 'Target',
    allowUserStatusUpdate: false,
    swimlanes: editLanes(extra.autoCreateTask ?? true),
    ...(extra.ideaMoves ? { ideaMoves: extra.ideaMoves } : {}),
    ...(extra.pullItemIds ? { pullItemIds: extra.pullItemIds } : {}),
  })

const taskIds = (s: Setup) => s.staged.map((entry) => entry.parent.id)
const indexOf = (s: Setup, entry: string) => s.log.indexOf(entry)

async function failure(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (error: unknown) => error,
  )
}

function expectNothingCommitted(s: Setup) {
  expect(s.uow.saves).toBe(0)
  expect(s.log).not.toContain('commit')
  expect(s.audit.events).toHaveLength(0)
  expect(s.log.filter((entry) => entry.startsWith('finish:'))).toEqual([])
}

describe('auto-create on a pull at board create', () => {
  it('creates one task for each pulled card that lands in the auto-create lane, on the referenced board', async () => {
    const s = setup({ ideas: [item(1), item(2)] })

    await create(s, [id(1), id(2)])

    // Oldest first, as the response and the audit list the pulled items.
    expect(s.staged.map((entry) => entry.parent)).toMatchObject([
      { id: id(2), organizationId: ORG_A, title: 'Item 2', parentIdeaId: null },
      { id: id(1), organizationId: ORG_A, title: 'Item 1', parentIdeaId: null },
    ])
    expect(s.staged.map((entry) => entry.referencedBoardId)).toEqual([CHILD, CHILD])
  })

  it('creates a task only for a card that lands in the auto-create lane', async () => {
    // Item 2 keeps S1 (a plain lane); item 3's status is no lane here, so it lands leftmost: S1.
    const s = setup({
      ideas: [item(1), item(2, { statusId: S1 }), item(3, { statusId: S3 })],
    })

    await create(s, [id(1), id(2), id(3)])

    expect(taskIds(s)).toEqual([id(1)])
  })

  it('creates a task for a card placed in the auto-create lane by landing there leftmost', async () => {
    const lanesWithAutoFirst: SwimlaneInput[] = [
      { statusId: S1, order: 0, referencesBoardId: CHILD, autoCreateTask: true },
      { statusId: S2, order: 1 },
    ]
    const s = setup({ ideas: [item(1, { statusId: S3 })] })

    await s.service.create(ORG_A, {
      name: 'New',
      allowUserStatusUpdate: false,
      swimlanes: lanesWithAutoFirst,
      pullItemIds: [id(1)],
    })

    expect(taskIds(s)).toEqual([id(1)])
  })

  it('creates no task when the lane does not auto-create', async () => {
    const s = setup({ ideas: [item(1)] })

    await create(s, [id(1)], false)

    expect(s.staged).toHaveLength(0)
  })

  it('creates no task when nothing is pulled', async () => {
    const s = setup()

    await create(s, [])

    expect(s.staged).toHaveLength(0)
  })

  it('stages every task before the commit and finishes each only after it', async () => {
    const s = setup({ ideas: [item(1), item(2)] })

    await create(s, [id(1), id(2)])

    const commit = indexOf(s, 'commit')
    expect(commit).toBeGreaterThan(indexOf(s, `stage:${id(1)}`))
    expect(commit).toBeGreaterThan(indexOf(s, `stage:${id(2)}`))
    expect(indexOf(s, `finish:${id(1)}`)).toBeGreaterThan(commit)
    expect(indexOf(s, `finish:${id(2)}`)).toBeGreaterThan(commit)
    expect(s.uow.saves).toBe(1)
  })

  it('stages the tasks after the pulled cards are reassigned, in the same save', async () => {
    const s = setup({ ideas: [item(1)] })

    await create(s, [id(1)])

    expect(indexOf(s, 'reassign')).toBeLessThan(indexOf(s, `stage:${id(1)}`))
  })

  it('rolls the whole save back when the first task is refused: no commit, no audit, no task', async () => {
    // Item 2 is the older card, so it is staged first.
    const s = setup({ ideas: [item(1), item(2)], refuse: [id(2)] })

    const error = await failure(create(s, [id(1), id(2)]))

    expect(error).toBeInstanceOf(UnprocessableError)
    expect(error).toMatchObject({ code: 'referencedBoardArchived' })
    expectNothingCommitted(s)
    expect(s.staged).toHaveLength(0)
  })

  it('rolls the whole save back when only the second task is refused', async () => {
    const s = setup({ ideas: [item(1), item(2)], refuse: [id(1)] })

    expect(await failure(create(s, [id(1), id(2)]))).toBeInstanceOf(UnprocessableError)
    expectNothingCommitted(s)
  })

  it('creates a task for an Issue pulled into the lane too', async () => {
    const issue = item(1, { phase: IdeaPhase.Delivery, sprintId: null })
    const s = setup({ ideas: [issue] })

    await create(s, [id(1)])

    expect(taskIds(s)).toEqual([id(1)])
  })
})

describe('auto-create on a pull at board update', () => {
  it('creates the pulled card its task, staged before the commit', async () => {
    const s = setup({ ideas: [item(1)] })

    await update(s, { pullItemIds: [id(1)] })

    expect(taskIds(s)).toEqual([id(1)])
    expect(indexOf(s, 'commit')).toBeGreaterThan(indexOf(s, `stage:${id(1)}`))
    expect(indexOf(s, `finish:${id(1)}`)).toBeGreaterThan(indexOf(s, 'commit'))
  })

  it('creates no task when the edit leaves the lane without auto-create', async () => {
    const s = setup({ ideas: [item(1)], autoCreateTask: false })

    await update(s, { pullItemIds: [id(1)], autoCreateTask: false })

    expect(s.staged).toHaveLength(0)
  })

  it('rolls the edit back when the pulled card task is refused', async () => {
    const s = setup({ ideas: [item(1)], refuse: [id(1)] })

    expect(await failure(update(s, { pullItemIds: [id(1)] }))).toBeInstanceOf(UnprocessableError)
    expectNothingCommitted(s)
  })
})

describe('auto-create on a bulk lane move (ideaMoves)', () => {
  const MOVES = [{ fromStatusId: S3, toStatusId: S2 }]

  it('creates one task per moved card, titled as the card, on the referenced board', async () => {
    const s = setup({ laneIdeas: [laneIdea(1, S3), laneIdea(2, S3)] })

    await update(s, { ideaMoves: MOVES })

    expect(s.staged.map((entry) => entry.parent)).toEqual([
      { id: id(1), organizationId: ORG_A, title: 'Lane idea 1', parentIdeaId: null },
      { id: id(2), organizationId: ORG_A, title: 'Lane idea 2', parentIdeaId: null },
    ])
    expect(s.staged.every((entry) => entry.referencedBoardId === CHILD)).toBe(true)
  })

  it('verifies the moved cards landed after the move and before staging any task', async () => {
    const s = setup({ laneIdeas: [laneIdea(1, S3), laneIdea(2, S3)] })

    await update(s, { ideaMoves: MOVES })

    expect(s.verified).toEqual([{ ideaIds: [id(1), id(2)], toStatusId: S2 }])
    expect(indexOf(s, 'move')).toBeLessThan(indexOf(s, 'verify'))
    expect(indexOf(s, 'verify')).toBeLessThan(indexOf(s, `stage:${id(1)}`))
    expect(indexOf(s, 'commit')).toBeGreaterThan(indexOf(s, `stage:${id(2)}`))
  })

  it('finishes the tasks only after the commit, and audits the move before them', async () => {
    const s = setup({ laneIdeas: [laneIdea(1, S3)] })

    await update(s, { ideaMoves: MOVES })

    expect(indexOf(s, `finish:${id(1)}`)).toBeGreaterThan(indexOf(s, 'commit'))
    expect(indexOf(s, 'audit:BoardUpdated')).toBeLessThan(indexOf(s, `finish:${id(1)}`))
    expect(s.uow.saves).toBe(1)
  })

  it('neither verifies nor creates anything for a move into an ordinary lane', async () => {
    const s = setup({ laneIdeas: [laneIdea(1, S3)] })

    await update(s, { ideaMoves: [{ fromStatusId: S3, toStatusId: S1 }] })

    expect(s.log).toContain('move')
    expect(s.verified).toHaveLength(0)
    expect(s.staged).toHaveLength(0)
  })

  it('neither verifies nor creates anything when the reference lane is not auto-create', async () => {
    const s = setup({ laneIdeas: [laneIdea(1, S3)], autoCreateTask: false })

    await update(s, { ideaMoves: MOVES, autoCreateTask: false })

    expect(s.log).toContain('move')
    expect(s.verified).toHaveLength(0)
    expect(s.staged).toHaveLength(0)
  })

  it('creates tasks for the moved cards and the pulled cards, moves first', async () => {
    const s = setup({ laneIdeas: [laneIdea(1, S3)], ideas: [item(7)] })

    await update(s, { ideaMoves: MOVES, pullItemIds: [id(7)] })

    expect(taskIds(s)).toEqual([id(1), id(7)])
  })

  it('rolls the whole edit back when a moved card task is refused', async () => {
    const s = setup({ laneIdeas: [laneIdea(1, S3), laneIdea(2, S3)], refuse: [id(2)] })

    const error = await failure(update(s, { ideaMoves: MOVES }))

    expect(error).toBeInstanceOf(UnprocessableError)
    expectNothingCommitted(s)
  })

  it('still asks for an Effort first and stages nothing', async () => {
    const s = setup({ laneIdeas: [laneIdea(1, S3, null)] })

    const error = await failure(update(s, { ideaMoves: MOVES }))

    expect(error).toMatchObject({ code: 'effortRequiredForReferenceLane' })
    expect(s.staged).toHaveLength(0)
    expectNothingCommitted(s)
  })

  it('creates nothing when the removed lane holds no ideas', async () => {
    const s = setup({ laneIdeas: [] })

    await update(s, { ideaMoves: MOVES })

    expect(s.verified).toHaveLength(0)
    expect(s.staged).toHaveLength(0)
  })
})

describe('pullItemIds: a task is never pullable', () => {
  const TASK_TEXT = (title: string) =>
    `'${title}' is a task, so it cannot be pulled. Tasks stay on their parent's reference board.`

  async function pullMessages(promise: Promise<unknown>): Promise<readonly string[]> {
    const error = await failure(promise)
    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).message).toBe('One or more fields are invalid.')
    expect(Object.keys((error as ValidationError).failures)).toEqual(['pullItemIds'])
    return (error as ValidationError).failures.pullItemIds ?? []
  }

  const task = (n: number, overrides: Partial<Idea> = {}) =>
    item(n, { boardId: CHILD, statusId: S1, parentIdeaId: id(99), ...overrides })

  it('refuses a task on create with the exact text, saving and creating nothing', async () => {
    const s = setup({ ideas: [task(1)] })

    expect(await pullMessages(create(s, [id(1)]))).toEqual([TASK_TEXT('Item 1')])
    expectNothingCommitted(s)
    expect(s.staged).toHaveLength(0)
  })

  it('refuses a task on update the same way', async () => {
    const s = setup({ ideas: [task(1)] })

    expect(await pullMessages(update(s, { pullItemIds: [id(1)] }))).toEqual([TASK_TEXT('Item 1')])
    expectNothingCommitted(s)
  })

  it('names the task by its title among other per-item refusals, reported together', async () => {
    const inSprint = item(2, { phase: IdeaPhase.Delivery, sprintId: 'sprint-1' })
    const s = setup({ ideas: [task(1), inSprint] })

    expect(await pullMessages(create(s, [id(1), id(2)]))).toEqual([
      TASK_TEXT('Item 1'),
      "'Item 2' is in a sprint, so it cannot be pulled. Move it back to the backlog first.",
    ])
  })

  it('reports a task in a sprint as a task, not as a sprint item', async () => {
    const s = setup({
      ideas: [task(1, { phase: IdeaPhase.Delivery, sprintId: 'sprint-1' })],
    })

    expect(await pullMessages(create(s, [id(1)]))).toEqual([TASK_TEXT('Item 1')])
  })

  it('is not overridable by a forceReason from an Org Admin', async () => {
    const s = setup({ ideas: [task(1)] })

    expect(await pullMessages(create(s, [id(1)], true, 'I know what I am doing'))).toEqual([
      TASK_TEXT('Item 1'),
    ])
    expectNothingCommitted(s)
  })

  it('tells a User who authored the task that it is a task, not that someone else made it', async () => {
    const s = setup({
      user: member(ORG_A, MEMBER_ID),
      ideas: [task(1, { authorUserId: MEMBER_ID })],
    })

    expect(await pullMessages(create(s, [id(1)]))).toEqual([TASK_TEXT('Item 1')])
  })

  it('still pulls the ordinary card named beside it only when no task is named', async () => {
    const s = setup({ ideas: [item(2)] })

    await create(s, [id(2)])

    expect(taskIds(s)).toEqual([id(2)])
  })
})
