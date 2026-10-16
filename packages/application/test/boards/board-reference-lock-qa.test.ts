// QA for the reference-lane lock on a pull (SPEC/decisions.md 2026-10-16 "Every exit is locked";
// contracts/boards.md "Pulling items" refusal list, line 140) and for the `autoCreateTask` lane
// flag (contracts/boards.md "Board References"): the lock and its exact wording under
// `pullItemIds`, the Org Admin override on create and update with its audit, and the lane-save
// rules. The move and detach paths are IdeaService's, in
// test/ideas/idea-service-reference-lock-qa.test.ts. In-memory ports, fixed clock and ids.
//
// Deliberately not pinned (open owner questions): a pull or `ideaMoves` into an `autoCreateTask`
// lane creating a task, and 403-versus-404 ordering for `forceReason`.

import { createBoard } from '@collega/domain/boards'
import { EffortLevel, Priority, Role } from '@collega/domain/enums'
import { createIdea, type Idea, promoteIdeaToIssue } from '@collega/domain/ideas'
import { createStatus } from '@collega/domain/statuses'
import { describe, expect, it } from 'vitest'
import { BoardService } from '../../src/boards/board-service.js'
import type { AutoCreateTaskPort } from '../../src/boards/index.js'
import type { SwimlaneInput } from '../../src/boards/models.js'
import type { BoardRepository } from '../../src/boards/ports.js'
import type { AuditEventInput, CurrentUserContext } from '../../src/common/index.js'
import { ForbiddenError, UnprocessableError, ValidationError } from '../../src/common/index.js'
import type { IdeaRepository } from '../../src/ideas/ports.js'
import type { StatusRepository } from '../../src/statuses/ports.js'
import {
  countingUnitOfWork,
  fixedClock,
  impersonating,
  member,
  NOW,
  ORG_A,
  orgAdmin,
  readOnly,
  recordingAudit,
  siteAdmin,
} from '../support/fixtures.js'

const S1 = 'status-1'
const S2 = 'status-2'
const S3 = 'status-3'
const SOURCE = 'source-board'
const TARGET = 'target-board'
const REFERENCED = 'referenced-board'
const MEMBER_ID = 'user-1'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function status(statusId: string) {
  return createStatus({
    id: statusId,
    organizationId: ORG_A,
    name: statusId,
    color: '#123456',
    sortOrder: 1,
    nowUtc: NOW,
    actorUserId: 'seed',
  })
}

function boardOf(boardId: string, lanes: { statusId: string; referencesBoardId: string | null }[]) {
  return createBoard({
    id: boardId,
    organizationId: ORG_A,
    name: boardId,
    allowUserStatusUpdate: false,
    orderedLanes: lanes.map((lane) => ({ ...lane, isFinal: false })),
    nowUtc: NOW,
    actorUserId: 'seed',
  })
}

/** The board the cards are pulled FROM: S1 plain, S2 hands work to REFERENCED. */
const sourceBoard = () =>
  boardOf(SOURCE, [
    { statusId: S1, referencesBoardId: null },
    { statusId: S2, referencesBoardId: REFERENCED },
  ])
const targetBoard = () =>
  boardOf(TARGET, [
    { statusId: S1, referencesBoardId: null },
    { statusId: S2, referencesBoardId: null },
  ])

function item(n: number, overrides: Partial<Idea> = {}): Idea {
  return {
    ...createIdea({
      id: id(n),
      organizationId: ORG_A,
      boardId: SOURCE,
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
      nowUtc: new Date(NOW.getTime() - n * 1000),
    }),
    effort: EffortLevel.Medium,
    ...overrides,
  }
}

type Counts = Record<string, { total: number; done: number }>

function setup(
  user: CurrentUserContext,
  ideas: readonly Idea[],
  counts: Counts = {},
  options: { sourceBoardGone?: boolean } = {},
) {
  const saved: unknown[] = []
  const added: unknown[] = []
  const reassigned: unknown[][] = []
  const countCalls: (readonly string[])[] = []
  const uow = countingUnitOfWork()
  const savesAtWrite: Record<string, number> = {}
  const audit = recordingAudit()
  const recordedWrite = audit.write.bind(audit)
  audit.write = async (event) => {
    savesAtWrite[event.eventType] = uow.saves
    await recordedWrite(event)
  }
  const boards = {
    async add(b: unknown) {
      added.push(b)
    },
    async save(b: unknown) {
      saved.push(b)
    },
    async getById(boardId: string) {
      if (boardId === TARGET) return targetBoard()
      if (boardId === SOURCE && !options.sourceBoardGone) return sourceBoard()
      return null
    },
    async listByOrganization() {
      return []
    },
    async countIdeasByBoardAndStatus() {
      return []
    },
    async listLaneIdeas() {
      return []
    },
    async moveIdeas() {},
    async reassignIdeas(_boardId: string, items: unknown[]) {
      reassigned.push(items)
    },
  } as unknown as BoardRepository
  const statuses = {
    async listByOrganization() {
      return [status(S1), status(S2), status(S3)]
    },
  } as unknown as StatusRepository
  const service = new BoardService(
    boards,
    statuses,
    {
      async existsById(orgId: string) {
        return orgId === ORG_A
      },
    },
    uow,
    audit,
    user,
    fixedClock(),
    {
      async getById(ideaId: string) {
        return ideas.find((i) => i.id === ideaId) ?? null
      },
      async countChildrenByParentIds(parentIds: readonly string[]) {
        countCalls.push(parentIds)
        return new Map(parentIds.flatMap((p) => (counts[p] ? [[p, counts[p]] as const] : [])))
      },
    } as unknown as IdeaRepository,
    {} as AutoCreateTaskPort,
  )
  return { service, saved, added, reassigned, countCalls, uow, audit, savesAtWrite }
}

type Setup = ReturnType<typeof setup>

const LANES: SwimlaneInput[] = [
  { statusId: S1, order: 0 },
  { statusId: S2, order: 1 },
]
const create = (s: Setup, pullItemIds: string[], forceReason?: string | null) =>
  s.service.create(ORG_A, {
    name: 'New',
    allowUserStatusUpdate: false,
    swimlanes: LANES,
    pullItemIds,
    forceReason,
  })
const update = (s: Setup, pullItemIds: string[], forceReason?: string | null) =>
  s.service.update(TARGET, {
    name: 'Target',
    allowUserStatusUpdate: false,
    swimlanes: LANES,
    pullItemIds,
    forceReason,
  })

async function pullMessages(promise: Promise<unknown>): Promise<readonly string[]> {
  try {
    await promise
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError)
    return (error as ValidationError).failures.pullItemIds ?? []
  }
  throw new Error('expected the pull to be refused')
}

const meta = (e: AuditEventInput | undefined) =>
  JSON.parse(e?.metadataJson ?? 'null') as Record<string, unknown> | null
const types = (s: Setup) => s.audit.events.map((e) => e.eventType)
const eventsOf = (s: Setup, eventType: string) =>
  s.audit.events.filter((e) => e.eventType === eventType)

function expectNothingSaved(s: Setup) {
  expect(s.added).toHaveLength(0)
  expect(s.saved).toHaveLength(0)
  expect(s.reassigned).toHaveLength(0)
  expect(s.uow.saves).toBe(0)
  expect(s.audit.events).toHaveLength(0)
}

const OPEN_2: Counts = { [id(1)]: { total: 3, done: 1 } }

describe('pull: the lock (contracts/boards.md line 140)', () => {
  it('refuses with a 400 keyed pullItemIds and the exact wording, naming the open count', async () => {
    const s = setup(orgAdmin(), [item(1)], OPEN_2)

    expect(await pullMessages(create(s, [id(1)]))).toEqual([
      "'Item 1' is waiting on 2 open tasks, so it cannot be pulled.",
    ])
    expectNothingSaved(s)
  })

  it('is a 400, not a 422, so the contract status is the pull refusal one', async () => {
    const s = setup(orgAdmin(), [item(1)], OPEN_2)

    const error = await create(s, [id(1)]).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ValidationError)
    expect(error).not.toBeInstanceOf(UnprocessableError)
    expect(error).toMatchObject({ message: 'One or more fields are invalid.' })
  })

  it('refuses on update the same way, leaving the board untouched', async () => {
    const s = setup(orgAdmin(), [item(1)], OPEN_2)

    expect(await pullMessages(update(s, [id(1)]))).toEqual([
      "'Item 1' is waiting on 2 open tasks, so it cannot be pulled.",
    ])
    expectNothingSaved(s)
  })

  it('refuses a User who authored the card', async () => {
    const s = setup(member(ORG_A, MEMBER_ID), [item(1)], OPEN_2)

    expect(await pullMessages(create(s, [id(1)]))).toEqual([
      "'Item 1' is waiting on 2 open tasks, so it cannot be pulled.",
    ])
    expectNothingSaved(s)
  })

  it('reports every locked card together, each with its own count, and pulls none of them', async () => {
    const s = setup(orgAdmin(), [item(1), item(2), item(3, { statusId: S1 })], {
      [id(1)]: { total: 3, done: 1 },
      [id(2)]: { total: 1, done: 0 },
    })

    expect(await pullMessages(create(s, [id(1), id(2), id(3)]))).toEqual([
      "'Item 1' is waiting on 2 open tasks, so it cannot be pulled.",
      "'Item 2' is waiting on 1 open tasks, so it cannot be pulled.",
    ])
    expectNothingSaved(s)
  })

  it('reports the lock beside other per-item problems in one refusal', async () => {
    const s = setup(orgAdmin(), [item(1)], OPEN_2)

    expect(await pullMessages(create(s, [id(1), id(9)]))).toEqual([
      "'Item 1' is waiting on 2 open tasks, so it cannot be pulled.",
      `Item '${id(9)}' was not found.`,
    ])
  })

  it('applies the lock to a backlog Issue in a reference lane too', async () => {
    const issue = promoteIdeaToIssue(
      item(1),
      { effort: EffortLevel.High, sprintId: null, currentUpvoteCount: 0 },
      NOW,
      'promoter',
    )
    const s = setup(orgAdmin(), [issue], OPEN_2)

    expect(await pullMessages(create(s, [id(1)]))).toEqual([
      "'Item 1' is waiting on 2 open tasks, so it cannot be pulled.",
    ])
  })

  it('asks the repository for the counts of the cards in reference lanes only, in one call', async () => {
    const s = setup(
      orgAdmin(),
      [item(1), item(2, { statusId: S1 }), item(3, { boardId: null })],
      OPEN_2,
    )

    await pullMessages(create(s, [id(1), id(2), id(3)]))

    expect(s.countCalls).toEqual([[id(1)]])
  })

  it.each([
    ['has no tasks', {}],
    ['has only final tasks', { [id(1)]: { total: 2, done: 2 } }],
    ['has a total of zero', { [id(1)]: { total: 0, done: 0 } }],
  ])('pulls a card in a reference lane that %s', async (_label, counts) => {
    const s = setup(orgAdmin(), [item(1)], counts)

    await create(s, [id(1)])

    expect(s.reassigned[0]).toHaveLength(1)
    expect(types(s)).not.toContain('IdeaMovedPastOpenTasks')
  })

  it('pulls a card from a plain lane of the same board, whatever the repository counts', async () => {
    const s = setup(orgAdmin(), [item(1, { statusId: S1 })], OPEN_2)

    await create(s, [id(1)])

    expect(s.reassigned[0]).toHaveLength(1)
    expect(s.countCalls).toHaveLength(0)
  })

  it('pulls a pool idea, which has no lane to be held in', async () => {
    const s = setup(orgAdmin(), [item(1, { boardId: null })], OPEN_2)

    await create(s, [id(1)])

    expect(s.reassigned[0]).toHaveLength(1)
  })

  it('treats a card whose source board has gone as unlocked', async () => {
    const s = setup(orgAdmin(), [item(1)], OPEN_2, { sourceBoardGone: true })

    await create(s, [id(1)])

    expect(s.reassigned[0]).toHaveLength(1)
  })
})

describe('pull: the Org Admin override', () => {
  it('pulls past the open tasks and audits the override with the reason and the count', async () => {
    const s = setup(orgAdmin(), [item(1)], OPEN_2)

    await create(s, [id(1)], 'Board is being merged')

    expect(s.reassigned[0]).toHaveLength(1)
    const forced = eventsOf(s, 'IdeaMovedPastOpenTasks')
    expect(forced).toHaveLength(1)
    expect(forced[0]).toMatchObject({
      entityType: 'Idea',
      entityId: id(1),
      message: "Idea 'Item 1' moved past 2 open tasks.",
    })
    expect(meta(forced[0])).toEqual({ reason: 'Board is being merged', openTaskCount: 2 })
  })

  it('works on update as well', async () => {
    const s = setup(orgAdmin(), [item(1)], OPEN_2)

    await update(s, [id(1)], 'Board is being merged')

    expect(s.reassigned[0]).toHaveLength(1)
    expect(meta(eventsOf(s, 'IdeaMovedPastOpenTasks')[0])).toEqual({
      reason: 'Board is being merged',
      openTaskCount: 2,
    })
  })

  it('writes the override event after the item events, and only after the commit', async () => {
    const s = setup(orgAdmin(), [item(1)], OPEN_2)

    await create(s, [id(1)], 'Because')

    expect(types(s)).toEqual(['BoardCreated', 'IdeaBoardChanged', 'IdeaMovedPastOpenTasks'])
    expect(s.savesAtWrite.IdeaMovedPastOpenTasks).toBe(1)
  })

  it('audits only the cards the override actually passed', async () => {
    const s = setup(orgAdmin(), [item(1), item(2, { statusId: S1 }), item(3), item(4)], {
      [id(1)]: { total: 2, done: 0 },
      [id(3)]: { total: 1, done: 1 },
      [id(4)]: { total: 4, done: 1 },
    })

    await create(s, [id(1), id(2), id(3), id(4)], 'Because')

    expect(eventsOf(s, 'IdeaBoardChanged')).toHaveLength(4)
    expect(
      eventsOf(s, 'IdeaMovedPastOpenTasks').map((e) => [e.entityId, meta(e)?.openTaskCount]),
    ).toEqual([
      [id(4), 3],
      [id(1), 2],
    ])
  })

  it('writes no override event when the reason was sent but no card was locked', async () => {
    const s = setup(orgAdmin(), [item(1, { statusId: S1 }), item(2, { boardId: null })], OPEN_2)

    await create(s, [id(1), id(2)], 'Just in case')

    expect(s.reassigned[0]).toHaveLength(2)
    expect(types(s)).not.toContain('IdeaMovedPastOpenTasks')
  })

  it('stores the reason trimmed', async () => {
    const s = setup(orgAdmin(), [item(1)], OPEN_2)

    await create(s, [id(1)], '  padded reason  ')

    expect(meta(eventsOf(s, 'IdeaMovedPastOpenTasks')[0])?.reason).toBe('padded reason')
  })

  it.each([
    ['an empty string', ''],
    ['spaces only', '   '],
    ['null', null],
    ['absent', undefined],
  ])('treats %s as no reason: the locked card still refuses', async (_label, forceReason) => {
    const s = setup(orgAdmin(), [item(1)], OPEN_2)

    expect(await pullMessages(create(s, [id(1)], forceReason))).toEqual([
      "'Item 1' is waiting on 2 open tasks, so it cannot be pulled.",
    ])
    expectNothingSaved(s)
  })

  it('does not let a reason pass a card that is refused for another reason', async () => {
    const other = item(2, { organizationId: 'org-b' })
    const s = setup(orgAdmin(), [item(1), other], OPEN_2)

    expect(await pullMessages(create(s, [id(1), id(2)], 'Because'))).toEqual([
      `Item '${id(2)}' was not found.`,
    ])
    expectNothingSaved(s)
  })

  it('lets a Site Admin viewing as an Org Admin override, auditing the administrator as the actor', async () => {
    const viewAs = impersonating({
      targetUserId: 'org-admin-1',
      targetRole: Role.OrgAdmin,
      targetOrganizationId: ORG_A,
      realUserId: 'site-admin-9',
    })
    const s = setup(viewAs, [item(1)], OPEN_2)

    await create(s, [id(1)], 'Support request')

    expect(eventsOf(s, 'IdeaMovedPastOpenTasks')[0]?.attribution).toMatchObject({
      actorUserId: 'site-admin-9',
      onBehalfOfUserId: 'org-admin-1',
    })
  })
})

describe('pull: forceReason from anyone but an Org Admin', () => {
  it('is 403 for a User on create, even when nothing is locked, and saves nothing', async () => {
    const s = setup(member(ORG_A, MEMBER_ID), [item(1, { statusId: S1 })])

    const error = await create(s, [id(1)], 'Let me through').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ForbiddenError)
    expect((error as Error).message).toBe('Only an Org Admin can move an item past its open tasks.')
    expectNothingSaved(s)
  })

  it('is 403 for a User with no pull at all, when only a reason is sent', async () => {
    const s = setup(member(ORG_A, MEMBER_ID), [])

    expect(await create(s, [], 'Let me through').catch((e: unknown) => e)).toBeInstanceOf(
      ForbiddenError,
    )
    expectNothingSaved(s)
  })

  it('is 403 for a locked card too, rather than the lock message', async () => {
    const s = setup(member(ORG_A, MEMBER_ID), [item(1)], OPEN_2)

    expect(await create(s, [id(1)], 'Let me through').catch((e: unknown) => e)).toBeInstanceOf(
      ForbiddenError,
    )
  })

  it('is 403 for a Site Admin viewing as a User, by the effective role', async () => {
    const viewAs = impersonating({
      targetUserId: MEMBER_ID,
      targetRole: Role.User,
      targetOrganizationId: ORG_A,
    })
    const s = setup(viewAs, [item(1)], OPEN_2)

    expect(await create(s, [id(1)], 'Let me through').catch((e: unknown) => e)).toBeInstanceOf(
      ForbiddenError,
    )
    expectNothingSaved(s)
  })

  it('leaves a Read Only caller refused as before', async () => {
    const s = setup(readOnly(ORG_A), [item(1)], OPEN_2)

    expect(await create(s, [id(1)], 'Because').catch((e: unknown) => e)).toBeInstanceOf(
      ForbiddenError,
    )
    expectNothingSaved(s)
  })

  it('leaves a direct Site Admin refused as before, with or without a reason', async () => {
    for (const reason of [undefined, 'Because']) {
      const s = setup(siteAdmin(), [item(1)], OPEN_2)
      expect(await create(s, [id(1)], reason).catch((e: unknown) => e)).toBeInstanceOf(
        ForbiddenError,
      )
      expectNothingSaved(s)
    }
  })
})

describe('lane save: autoCreateTask', () => {
  const lanes = (autoCreateTask: boolean | undefined, referencesBoardId: string | null) => [
    { statusId: S1, order: 0, referencesBoardId, autoCreateTask },
    { statusId: S2, order: 1 },
  ]
  const referencedBoard = () =>
    boardOf(REFERENCED, [
      { statusId: S1, referencesBoardId: null },
      { statusId: S2, referencesBoardId: null },
    ])

  /** A service over stored boards, so a lane that references one passes the cross-board rules. */
  function stored() {
    const saved: unknown[] = []
    const added: unknown[] = []
    const all = [referencedBoard(), targetBoard()]
    const boards = {
      async add(b: unknown) {
        added.push(b)
      },
      async save(b: unknown) {
        saved.push(b)
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
      async listLaneIdeas() {
        return []
      },
      async moveIdeas() {},
      async reassignIdeas() {},
    } as unknown as BoardRepository
    const service = new BoardService(
      boards,
      {
        async listByOrganization() {
          return [status(S1), status(S2), status(S3)]
        },
      } as unknown as StatusRepository,
      {
        async existsById() {
          return true
        },
      },
      countingUnitOfWork(),
      recordingAudit(),
      orgAdmin(),
      fixedClock(),
      {
        async getById() {
          return null
        },
      } as unknown as IdeaRepository,
      {} as AutoCreateTaskPort,
    )
    return { service, saved, added }
  }

  it('stores the flag on a created board and answers it on the lane', async () => {
    const s = stored()

    const created = await s.service.create(ORG_A, {
      name: 'New',
      allowUserStatusUpdate: false,
      swimlanes: lanes(true, REFERENCED),
    })

    const savedLanes = (
      s.added[0] as { swimlanes: { statusId: string; autoCreateTask: boolean }[] }
    ).swimlanes
    expect(savedLanes.map((l) => [l.statusId, l.autoCreateTask])).toEqual([
      [S1, true],
      [S2, false],
    ])
    expect(created.swimlanes.map((l) => l.autoCreateTask)).toEqual([true, false])
  })

  it('stores the flag on update and answers it on the lane', async () => {
    const s = stored()

    const updated = await s.service.update(TARGET, {
      name: 'Target',
      allowUserStatusUpdate: false,
      swimlanes: lanes(true, REFERENCED),
    })

    expect(updated.swimlanes.map((l) => l.autoCreateTask)).toEqual([true, false])
    expect(
      (s.saved[0] as { swimlanes: { autoCreateTask: boolean }[] }).swimlanes.map(
        (l) => l.autoCreateTask,
      ),
    ).toEqual([true, false])
  })

  it('reads an absent flag as false', async () => {
    const s = stored()

    const created = await s.service.create(ORG_A, {
      name: 'New',
      allowUserStatusUpdate: false,
      swimlanes: lanes(undefined, REFERENCED),
    })

    expect(created.swimlanes.map((l) => l.autoCreateTask)).toEqual([false, false])
  })

  it.each([
    [
      'create',
      (s: ReturnType<typeof stored>) =>
        s.service.create(ORG_A, {
          name: 'New',
          allowUserStatusUpdate: false,
          swimlanes: lanes(true, null),
        }),
    ],
    [
      'update',
      (s: ReturnType<typeof stored>) =>
        s.service.update(TARGET, {
          name: 'Target',
          allowUserStatusUpdate: false,
          swimlanes: lanes(true, null),
        }),
    ],
  ])(
    'refuses the flag on a lane with no referenced board on %s with 422 autoCreateTaskRequiresReference',
    async (_label, call) => {
      const s = stored()

      const error = await call(s).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(UnprocessableError)
      expect(error).toMatchObject({
        code: 'autoCreateTaskRequiresReference',
        message: 'A lane can create a task on entry only when it references a board.',
      })
      expect(s.added).toHaveLength(0)
      expect(s.saved).toHaveLength(0)
    },
  )

  it('accepts the flag set to false on a lane with no referenced board', async () => {
    const s = stored()

    await expect(
      s.service.create(ORG_A, {
        name: 'New',
        allowUserStatusUpdate: false,
        swimlanes: lanes(false, null),
      }),
    ).resolves.toBeDefined()
  })

  it('treats a whitespace referencesBoardId as no reference and so refuses the flag', async () => {
    const s = stored()

    const error = await s.service
      .create(ORG_A, {
        name: 'New',
        allowUserStatusUpdate: false,
        swimlanes: lanes(true, '   '),
      })
      .catch((e: unknown) => e)

    expect(error).toMatchObject({ code: 'autoCreateTaskRequiresReference' })
  })

  it('refuses a lane list that is short of lanes before it looks at the flag', async () => {
    const s = stored()

    const error = await s.service
      .create(ORG_A, {
        name: 'New',
        allowUserStatusUpdate: false,
        swimlanes: [{ statusId: S1, order: 0, autoCreateTask: true }],
      })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ValidationError)
  })
})
