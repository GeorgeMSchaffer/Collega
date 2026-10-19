// QA for SPEC/decisions.md 2026-10-19 "Board References UI: comp U answers" answer 1 and
// contracts/boards.md "Rules": saving a lane with `isFinal` true and `referencesBoardId` set is
// `422` `finalLaneCannotReference`, on board create and on board update (so turning an existing
// reference lane Final is refused too), not on a swimlane reorder, which carries no lane rules,
// and checked before `autoCreateTaskRequiresReference` and before the cross-board reference
// checks. In-memory ports, fixed clock and ids.

import { createBoard } from '@collega/domain/boards'
import { createStatus } from '@collega/domain/statuses'
import { describe, expect, it } from 'vitest'
import { BoardService } from '../../src/boards/board-service.js'
import type { AutoCreateTaskPort } from '../../src/boards/index.js'
import type { SwimlaneInput } from '../../src/boards/models.js'
import type { BoardRepository } from '../../src/boards/ports.js'
import { UnprocessableError, ValidationError } from '../../src/common/index.js'
import type { IdeaRepository } from '../../src/ideas/ports.js'
import type { StatusRepository } from '../../src/statuses/ports.js'
import {
  countingUnitOfWork,
  fixedClock,
  NOW,
  ORG_A,
  orgAdmin,
  recordingAudit,
} from '../support/fixtures.js'

const S1 = 'status-1'
const S2 = 'status-2'
const S3 = 'status-3'
const TARGET = 'target-board'
const REFERENCED = 'referenced-board'

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

type StoredLane = { statusId: string; isFinal?: boolean; referencesBoardId?: string | null }

const boardOf = (boardId: string, lanes: StoredLane[]) =>
  createBoard({
    id: boardId,
    organizationId: ORG_A,
    name: boardId,
    allowUserStatusUpdate: false,
    orderedLanes: lanes.map((lane) => ({
      statusId: lane.statusId,
      isFinal: lane.isFinal ?? false,
      referencesBoardId: lane.referencesBoardId ?? null,
    })),
    nowUtc: NOW,
    actorUserId: 'seed',
  })

function setup(targetLanes: StoredLane[]) {
  const saved: unknown[] = []
  const added: unknown[] = []
  const all = [
    boardOf(REFERENCED, [{ statusId: S1 }, { statusId: S2 }]),
    boardOf(TARGET, targetLanes),
  ]
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
  const uow = countingUnitOfWork()
  const audit = recordingAudit()
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
    uow,
    audit,
    orgAdmin(),
    fixedClock(),
    {
      async getById() {
        return null
      },
    } as unknown as IdeaRepository,
    {} as AutoCreateTaskPort,
  )
  return { service, saved, added, uow, audit }
}

type Setup = ReturnType<typeof setup>

const PLAIN: StoredLane[] = [{ statusId: S1 }, { statusId: S2 }]

const body = (swimlanes: SwimlaneInput[]) => ({
  name: 'Target',
  allowUserStatusUpdate: false,
  swimlanes,
})
const create = (s: Setup, swimlanes: SwimlaneInput[]) => s.service.create(ORG_A, body(swimlanes))
const update = (s: Setup, swimlanes: SwimlaneInput[]) => s.service.update(TARGET, body(swimlanes))

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error,
  )

function expectNothingWritten(s: Setup) {
  expect(s.added).toHaveLength(0)
  expect(s.saved).toHaveLength(0)
  expect(s.uow.saves).toBe(0)
  expect(s.audit.events).toHaveLength(0)
}

const finalReference: SwimlaneInput[] = [
  { statusId: S1, order: 0 },
  { statusId: S2, order: 1, isFinal: true, referencesBoardId: REFERENCED },
]

describe('lane save: a Final lane cannot reference a board', () => {
  it.each([
    ['create', create],
    ['update', update],
  ])(
    'refuses isFinal with referencesBoardId on %s with 422 finalLaneCannotReference',
    async (_l, call) => {
      const s = setup(PLAIN)

      const error = await failure(call(s, finalReference))

      expect(error).toBeInstanceOf(UnprocessableError)
      expect(error).toMatchObject({
        code: 'finalLaneCannotReference',
        message: 'A final lane cannot reference a board.',
      })
      expectNothingWritten(s)
    },
  )

  it('refuses turning a stored reference lane Final while keeping its reference', async () => {
    const s = setup([{ statusId: S1 }, { statusId: S2, referencesBoardId: REFERENCED }])

    const error = await failure(update(s, finalReference))

    expect(error).toMatchObject({ code: 'finalLaneCannotReference' })
    expectNothingWritten(s)
  })

  it('accepts turning a stored reference lane Final once its reference is cleared', async () => {
    const s = setup([{ statusId: S1 }, { statusId: S2, referencesBoardId: REFERENCED }])

    const updated = await update(s, [
      { statusId: S1, order: 0 },
      { statusId: S2, order: 1, isFinal: true, referencesBoardId: null },
    ])

    expect(updated.swimlanes.map((l) => [l.statusId, l.isFinal, l.referencesBoardId])).toEqual([
      [S1, false, null],
      [S2, true, null],
    ])
  })

  it('accepts a Final lane with no reference and a reference lane that is not Final', async () => {
    const s = setup(PLAIN)

    const created = await create(s, [
      { statusId: S1, order: 0, referencesBoardId: REFERENCED },
      { statusId: S2, order: 1, isFinal: true },
    ])

    expect(created.swimlanes.map((l) => [l.isFinal, l.referencesBoardId])).toEqual([
      [false, REFERENCED],
      [true, null],
    ])
  })

  it('treats a whitespace referencesBoardId as no reference, so a Final lane with it is accepted', async () => {
    const s = setup(PLAIN)

    const created = await create(s, [
      { statusId: S1, order: 0 },
      { statusId: S2, order: 1, isFinal: true, referencesBoardId: '   ' },
    ])

    expect(created.swimlanes.map((l) => [l.isFinal, l.referencesBoardId])).toEqual([
      [false, null],
      [true, null],
    ])
  })

  it('refuses when only one of several lanes is Final and referencing', async () => {
    const s = setup(PLAIN)

    const error = await failure(
      create(s, [
        { statusId: S1, order: 0, referencesBoardId: REFERENCED },
        { statusId: S2, order: 1 },
        { statusId: S3, order: 2, isFinal: true, referencesBoardId: REFERENCED },
      ]),
    )

    expect(error).toMatchObject({ code: 'finalLaneCannotReference' })
  })

  it('is checked before autoCreateTaskRequiresReference', async () => {
    const s = setup(PLAIN)

    const error = await failure(
      create(s, [
        { statusId: S1, order: 0, autoCreateTask: true },
        { statusId: S2, order: 1, isFinal: true, referencesBoardId: REFERENCED },
      ]),
    )

    expect(error).toMatchObject({ code: 'finalLaneCannotReference' })
  })

  it('is checked before the cross-board reference checks', async () => {
    const s = setup(PLAIN)

    const error = await failure(
      update(s, [
        { statusId: S1, order: 0 },
        { statusId: S2, order: 1, isFinal: true, referencesBoardId: 'no-such-board' },
      ]),
    )

    expect(error).toMatchObject({ code: 'finalLaneCannotReference' })
  })

  it('still refuses autoCreateTask on a Final lane with no reference as autoCreateTaskRequiresReference', async () => {
    const s = setup(PLAIN)

    const error = await failure(
      create(s, [
        { statusId: S1, order: 0 },
        { statusId: S2, order: 1, isFinal: true, autoCreateTask: true },
      ]),
    )

    expect(error).toMatchObject({ code: 'autoCreateTaskRequiresReference' })
  })

  it('is checked after the lane-count validation', async () => {
    const s = setup(PLAIN)

    const error = await failure(
      create(s, [{ statusId: S1, order: 0, isFinal: true, referencesBoardId: REFERENCED }]),
    )

    expect(error).toBeInstanceOf(ValidationError)
  })
})

describe('swimlane reorder: no lane rules', () => {
  it('does not refuse a stored board that already has a Final reference lane', async () => {
    const s = setup([
      { statusId: S1 },
      { statusId: S2, isFinal: true, referencesBoardId: REFERENCED },
    ])

    await s.service.reorderSwimlanes(TARGET, {
      swimlanes: [
        { statusId: S2, order: 0 },
        { statusId: S1, order: 1 },
      ],
    })

    const board = s.saved[0] as { swimlanes: { statusId: string }[] }
    expect(board.swimlanes.map((l) => l.statusId)).toEqual([S2, S1])
  })

  it('ignores isFinal and referencesBoardId carried in the reorder payload', async () => {
    const s = setup(PLAIN)

    await s.service.reorderSwimlanes(TARGET, {
      swimlanes: [
        { statusId: S2, order: 0, isFinal: true, referencesBoardId: REFERENCED },
        { statusId: S1, order: 1 },
      ],
    })

    const board = s.saved[0] as {
      swimlanes: { statusId: string; isFinal: boolean; referencesBoardId: string | null }[]
    }
    expect(board.swimlanes.map((l) => [l.statusId, l.isFinal, l.referencesBoardId])).toEqual([
      [S2, false, null],
      [S1, false, null],
    ])
  })
})
