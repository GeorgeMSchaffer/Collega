// Removing a lane moves its ideas (SPEC/20-feature-boards-and-statuses.md rule 14,
// SPEC/contracts/boards.md `PUT /boards/{boardId}` `ideaMoves`).
//
// The repository here answers `listLaneIdeas` from a fixed population - which ideas count as
// "live Discovery" is the adapter's filter, pinned against Postgres in
// packages/infrastructure/test/board-lane-removal.integration.test.ts. What is pinned here is the
// service's side: which saves are refused and with what, what is staged, and what is audited.

import { archiveBoard, type Board, createBoard } from '@collega/domain/boards'
import { Role } from '@collega/domain/enums'
import { createStatus, type Status } from '@collega/domain/statuses'
import { describe, expect, it } from 'vitest'
import { BoardService } from '../../src/boards/board-service.js'
import type { IdeaMoveInput, UpdateBoardCommand } from '../../src/boards/models.js'
import type { BoardRepository, LaneIdea } from '../../src/boards/ports.js'
import { ConflictError, type CurrentUserContext, ValidationError } from '../../src/common/index.js'
import type { StatusRepository } from '../../src/statuses/ports.js'
import {
  countingUnitOfWork,
  fixedClock,
  impersonating,
  NOW,
  ORG_A,
  orgAdmin,
  recordingAudit,
} from '../support/fixtures.js'

const NEW = 'status-new'
const REVIEW = 'status-review'
const DONE = 'status-done'
const PARKED = 'status-parked'
const BOARD_ID = 'board-a'

const STATUS_NAMES: Record<string, string> = {
  [NEW]: 'New / Pending',
  [REVIEW]: 'In Review',
  [DONE]: 'Done',
  [PARKED]: 'Parked',
}

function status(id: string, sortOrder: number): Status {
  return createStatus({
    id,
    organizationId: ORG_A,
    name: STATUS_NAMES[id] ?? id,
    color: '#123456',
    sortOrder,
    nowUtc: NOW,
    actorUserId: 'seed',
  })
}

const STATUSES = [status(NEW, 10), status(REVIEW, 20), status(DONE, 30), status(PARKED, 40)]

/** New / Pending, In Review, Done - Parked exists in the organization but is not a lane. */
function board(archived = false): Board {
  const created = createBoard({
    id: BOARD_ID,
    organizationId: ORG_A,
    name: 'Acme Board',
    allowUserStatusUpdate: false,
    orderedStatusIds: [NEW, REVIEW, DONE],
    nowUtc: NOW,
    actorUserId: 'seed',
  })
  return archived ? archiveBoard(created, NOW, 'seed') : created
}

function idea(ideaId: string, statusId: string): LaneIdea {
  return { ideaId, title: `Idea ${ideaId}`, statusId }
}

type MoveCall = {
  boardId: string
  ideaIds: readonly string[]
  fromStatusId: string
  toStatusId: string
  nowUtc: Date
  actorUserId: string | null
}

function harness(
  options: {
    ideas?: readonly LaneIdea[]
    archived?: boolean
    currentUser?: CurrentUserContext
  } = {},
) {
  const existing = board(options.archived)
  const population = options.ideas ?? []
  /** Every write and commit, in the order the service made them. */
  const log: string[] = []
  const moves: MoveCall[] = []
  const laneReads: (readonly string[])[] = []

  const boards: BoardRepository = {
    async add() {},
    async save() {
      log.push('save')
    },
    async getById(id) {
      return id === BOARD_ID ? existing : null
    },
    async listByOrganization() {
      return [existing]
    },
    async isStatusReferenced() {
      return false
    },
    async countIdeasByBoard() {
      return new Map()
    },
    async countIdeasByBoardAndStatus() {
      return []
    },
    async countIdeasByBoardAndTag() {
      return []
    },
    async getUserNames() {
      return new Map()
    },
    async listLaneIdeas(boardId, statusIds) {
      laneReads.push(statusIds)
      expect(boardId).toBe(BOARD_ID)
      return population.filter((row) => statusIds.includes(row.statusId))
    },
    async moveIdeas(boardId, ideaIds, fromStatusId, toStatusId, nowUtc, actorUserId) {
      log.push('move')
      moves.push({ boardId, ideaIds, fromStatusId, toStatusId, nowUtc, actorUserId })
    },
  }

  const statuses: StatusRepository = {
    async add() {},
    async addMany() {},
    async getById(id) {
      return STATUSES.find((s) => s.id === id) ?? null
    },
    async listActiveByOrganization() {
      return STATUSES
    },
    async listByOrganization() {
      return STATUSES
    },
    async countActiveByOrganization() {
      return STATUSES.length
    },
    async save() {},
  }

  const unitOfWork = countingUnitOfWork()
  const committing = {
    async saveChanges() {
      log.push('commit')
      await unitOfWork.saveChanges()
    },
  }
  const audit = recordingAudit()

  return {
    service: new BoardService(
      boards,
      statuses,
      { existsById: async () => true },
      committing,
      audit,
      options.currentUser ?? orgAdmin(ORG_A),
      fixedClock(),
    ),
    log,
    moves,
    laneReads,
    audit,
  }
}

/** A save keeping `lanes`, in that order, with the given moves. */
function save(lanes: readonly string[], ideaMoves?: readonly IdeaMoveInput[]): UpdateBoardCommand {
  return {
    name: 'Acme Board',
    allowUserStatusUpdate: false,
    swimlanes: lanes.map((statusId, order) => ({ statusId, order })),
    ...(ideaMoves === undefined ? {} : { ideaMoves }),
  }
}

async function refusal(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('Expected the save to be refused.')
    },
    (thrown: unknown) => thrown,
  )
}

/** The `ideaMoves` messages of a refused save, which must be a 400 keyed `ideaMoves` only. */
async function ideaMovesErrors(promise: Promise<unknown>): Promise<readonly string[]> {
  const error = await refusal(promise)
  expect(error).toBeInstanceOf(ValidationError)
  const validation = error as ValidationError
  expect(validation.message).toBe('One or more fields are invalid.')
  expect(Object.keys(validation.failures)).toEqual(['ideaMoves'])
  return validation.failures.ideaMoves ?? []
}

const HOLDS_MANY = (name: string, count: number) =>
  `'${name}' still holds ${count} ideas. Choose a lane that stays on the board to move them to.`
const HOLDS_ONE = (name: string) =>
  `'${name}' still holds 1 idea. Choose a lane that stays on the board to move it to.`
const BAD_TARGET = 'Ideas can only move to a lane that stays on the board.'
const NOT_REMOVED = 'A move must come from a lane this save removes.'
const DUPLICATE = 'A removed lane can move its ideas to one lane only.'

describe('BoardService.update refusing a lane removal that strands ideas', () => {
  it('refuses a removed lane holding several ideas with no move, naming the lane and count', async () => {
    const { service, log } = harness({
      ideas: [idea('i1', REVIEW), idea('i2', REVIEW), idea('i3', REVIEW)],
    })

    const errors = await ideaMovesErrors(service.update(BOARD_ID, save([NEW, DONE])))

    expect(errors).toEqual([HOLDS_MANY('In Review', 3)])
    expect(log).toEqual([])
  })

  it('uses the singular for a lane holding one idea', async () => {
    const { service } = harness({ ideas: [idea('i1', REVIEW)] })

    const errors = await ideaMovesErrors(service.update(BOARD_ID, save([NEW, DONE])))

    expect(errors).toEqual([HOLDS_ONE('In Review')])
  })

  it('reports each stranded lane in its own message', async () => {
    const { service } = harness({
      ideas: [idea('i1', REVIEW), idea('i2', DONE), idea('i3', DONE)],
    })

    const errors = await ideaMovesErrors(service.update(BOARD_ID, save([NEW, PARKED])))

    expect(errors).toEqual([HOLDS_ONE('In Review'), HOLDS_MANY('Done', 2)])
  })

  it('refuses a move to a lane the saved board does not keep', async () => {
    const { service, log } = harness({ ideas: [idea('i1', REVIEW)] })

    const errors = await ideaMovesErrors(
      service.update(BOARD_ID, save([NEW, DONE], [{ fromStatusId: REVIEW, toStatusId: PARKED }])),
    )

    expect(errors).toEqual([BAD_TARGET])
    expect(log).toEqual([])
  })

  it('refuses a move to the removed lane itself', async () => {
    const { service } = harness({ ideas: [idea('i1', REVIEW)] })

    const errors = await ideaMovesErrors(
      service.update(BOARD_ID, save([NEW, DONE], [{ fromStatusId: REVIEW, toStatusId: REVIEW }])),
    )

    expect(errors).toEqual([BAD_TARGET])
  })

  it('refuses a move from a lane the save keeps', async () => {
    const { service, log } = harness({ ideas: [idea('i1', NEW)] })

    const errors = await ideaMovesErrors(
      service.update(
        BOARD_ID,
        save([NEW, REVIEW, DONE], [{ fromStatusId: NEW, toStatusId: DONE }]),
      ),
    )

    expect(errors).toEqual([NOT_REMOVED])
    expect(log).toEqual([])
  })

  it('refuses a move from a status that was never a lane', async () => {
    const { service } = harness()

    const errors = await ideaMovesErrors(
      service.update(BOARD_ID, save([NEW, DONE], [{ fromStatusId: PARKED, toStatusId: NEW }])),
    )

    expect(errors).toEqual([NOT_REMOVED])
  })

  it('refuses the same removed lane named twice, even with the same target', async () => {
    const { service, log } = harness({ ideas: [idea('i1', REVIEW)] })

    const errors = await ideaMovesErrors(
      service.update(
        BOARD_ID,
        save(
          [NEW, DONE],
          [
            { fromStatusId: REVIEW, toStatusId: NEW },
            { fromStatusId: REVIEW, toStatusId: NEW },
          ],
        ),
      ),
    )

    expect(errors).toEqual([DUPLICATE])
    expect(log).toEqual([])
  })

  it('reports every problem in one refusal, each message once', async () => {
    const { service } = harness({
      ideas: [idea('i1', REVIEW), idea('i2', DONE), idea('i3', DONE)],
    })

    const errors = await ideaMovesErrors(
      service.update(
        BOARD_ID,
        save(
          [NEW, PARKED],
          [
            { fromStatusId: NEW, toStatusId: PARKED },
            { fromStatusId: NEW, toStatusId: PARKED },
            { fromStatusId: REVIEW, toStatusId: DONE },
            { fromStatusId: REVIEW, toStatusId: NEW },
          ],
        ),
      ),
    )

    // NEW is kept (twice - one message); REVIEW's target is removed, and its second entry is a
    // duplicate; DONE still holds two ideas and has no entry. REVIEW is not also reported as
    // stranded: its own entry already says what is wrong with it.
    expect(errors).toEqual([NOT_REMOVED, BAD_TARGET, DUPLICATE, HOLDS_MANY('Done', 2)])
  })

  it('refuses a malformed move even when the save removes no lane', async () => {
    const { service, laneReads } = harness()

    const errors = await ideaMovesErrors(
      service.update(BOARD_ID, save([NEW, REVIEW, DONE], [{ fromStatusId: '', toStatusId: '' }])),
    )

    // An empty target is also not a kept lane; the contract only requires the refusal to name it.
    expect(errors).toContain(NOT_REMOVED)
    expect(laneReads).toEqual([])
  })

  it('answers 409 for an archived board before looking at the moves', async () => {
    const { service, laneReads } = harness({ archived: true, ideas: [idea('i1', REVIEW)] })

    const error = await refusal(
      service.update(BOARD_ID, save([NEW, DONE], [{ fromStatusId: NEW, toStatusId: PARKED }])),
    )

    expect(error).toBeInstanceOf(ConflictError)
    expect(laneReads).toEqual([])
  })
})

describe('BoardService.update moving a removed lane’s ideas', () => {
  it('stages the move with the board save, before the one commit', async () => {
    const { service, log, moves } = harness({
      ideas: [idea('i1', REVIEW), idea('i2', REVIEW), idea('i9', NEW)],
    })

    await service.update(BOARD_ID, save([NEW, DONE], [{ fromStatusId: REVIEW, toStatusId: DONE }]))

    expect(log).toEqual(['save', 'move', 'commit'])
    expect(moves).toEqual([
      {
        boardId: BOARD_ID,
        ideaIds: ['i1', 'i2'],
        fromStatusId: REVIEW,
        toStatusId: DONE,
        nowUtc: NOW,
        actorUserId: 'org-admin-1',
      },
    ])
  })

  it('reads only the removed lanes’ ideas', async () => {
    const { service, laneReads } = harness({ ideas: [idea('i1', REVIEW)] })

    await service.update(BOARD_ID, save([NEW, DONE], [{ fromStatusId: REVIEW, toStatusId: NEW }]))

    expect(laneReads).toEqual([[REVIEW]])
  })

  it('sends each removed lane to its own target', async () => {
    const { service, moves } = harness({
      ideas: [idea('i1', REVIEW), idea('i2', DONE)],
    })

    await service.update(
      BOARD_ID,
      save(
        [NEW, PARKED],
        [
          { fromStatusId: DONE, toStatusId: PARKED },
          { fromStatusId: REVIEW, toStatusId: NEW },
        ],
      ),
    )

    expect(moves.map((move) => [move.fromStatusId, move.toStatusId, move.ideaIds])).toEqual([
      [REVIEW, NEW, ['i1']],
      [DONE, PARKED, ['i2']],
    ])
  })

  it('accepts a lane the same save adds as the target', async () => {
    const { service, moves } = harness({ ideas: [idea('i1', REVIEW)] })

    await service.update(
      BOARD_ID,
      save([NEW, PARKED, DONE], [{ fromStatusId: REVIEW, toStatusId: PARKED }]),
    )

    expect(moves.map((move) => move.toStatusId)).toEqual([PARKED])
  })

  it('removes an empty lane without asking for a move', async () => {
    const { service, log, moves } = harness({ ideas: [idea('i1', NEW)] })

    await service.update(BOARD_ID, save([NEW, DONE]))

    expect(moves).toEqual([])
    expect(log).toEqual(['save', 'commit'])
  })

  it('accepts a move from a removed lane that turned out empty, and moves nothing', async () => {
    const { service, moves, audit } = harness()

    await service.update(BOARD_ID, save([NEW, DONE], [{ fromStatusId: REVIEW, toStatusId: NEW }]))

    expect(moves).toEqual([])
    expect(audit.events.map((event) => event.eventType)).toEqual(['BoardUpdated'])
    expect(JSON.parse(audit.events[0]?.metadataJson ?? '{}')).not.toHaveProperty('ideaMoves')
  })

  it('treats an absent ideaMoves as none', async () => {
    const { service, moves } = harness()

    await service.update(BOARD_ID, save([NEW, REVIEW, DONE]))

    expect(moves).toEqual([])
  })
})

describe('BoardService.update auditing a lane removal', () => {
  it('writes one IdeaStatusChanged per moved idea, in the shape a move on the board writes', async () => {
    const { service, audit } = harness({
      ideas: [idea('i1', REVIEW), idea('i2', REVIEW), idea('i3', DONE)],
    })

    await service.update(
      BOARD_ID,
      save(
        [NEW, PARKED],
        [
          { fromStatusId: REVIEW, toStatusId: NEW },
          { fromStatusId: DONE, toStatusId: PARKED },
        ],
      ),
    )

    const ideaEvents = audit.events.filter((event) => event.eventType === 'IdeaStatusChanged')
    expect(ideaEvents).toEqual([
      expect.objectContaining({
        entityType: 'Idea',
        entityId: 'i1',
        organizationId: ORG_A,
        occurredAtUtc: NOW,
        message: "Idea 'Idea i1' moved to a new status.",
        metadataJson: JSON.stringify({ fromStatusId: REVIEW, toStatusId: NEW }),
        attribution: { actorUserId: 'org-admin-1', onBehalfOfUserId: null },
      }),
      expect.objectContaining({
        entityId: 'i2',
        metadataJson: JSON.stringify({ fromStatusId: REVIEW, toStatusId: NEW }),
      }),
      expect.objectContaining({
        entityId: 'i3',
        message: "Idea 'Idea i3' moved to a new status.",
        metadataJson: JSON.stringify({ fromStatusId: DONE, toStatusId: PARKED }),
      }),
    ])
  })

  it('records the moves on BoardUpdated, one entry per lane with its count', async () => {
    const { service, audit } = harness({
      ideas: [idea('i1', REVIEW), idea('i2', REVIEW), idea('i3', DONE)],
    })

    await service.update(
      BOARD_ID,
      save(
        [NEW, PARKED],
        [
          { fromStatusId: REVIEW, toStatusId: NEW },
          { fromStatusId: DONE, toStatusId: PARKED },
        ],
      ),
    )

    const boardEvents = audit.events.filter((event) => event.eventType === 'BoardUpdated')
    expect(boardEvents).toHaveLength(1)
    expect(JSON.parse(boardEvents[0]?.metadataJson ?? '{}')).toEqual({
      name: 'Acme Board',
      swimlaneCount: 2,
      ideaMoves: [
        { fromStatusId: REVIEW, toStatusId: NEW, ideaCount: 2 },
        { fromStatusId: DONE, toStatusId: PARKED, ideaCount: 1 },
      ],
    })
  })

  it('attributes each move to the administrator while acting through View As', async () => {
    const { service, audit } = harness({
      ideas: [idea('i1', REVIEW)],
      currentUser: impersonating({
        targetUserId: 'org-admin-1',
        targetRole: Role.OrgAdmin,
        targetOrganizationId: ORG_A,
        realUserId: 'site-admin-1',
      }),
    })

    await service.update(BOARD_ID, save([NEW, DONE], [{ fromStatusId: REVIEW, toStatusId: NEW }]))

    for (const event of audit.events) {
      expect(event.attribution).toEqual({
        actorUserId: 'site-admin-1',
        onBehalfOfUserId: 'org-admin-1',
      })
    }
  })

  it('audits nothing when the save is refused', async () => {
    const { service, audit } = harness({ ideas: [idea('i1', REVIEW)] })

    await refusal(service.update(BOARD_ID, save([NEW, DONE])))

    expect(audit.events).toEqual([])
  })
})
