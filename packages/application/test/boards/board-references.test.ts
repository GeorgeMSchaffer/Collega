// Board References, lane and flag rules (SPEC/contracts/boards.md "Board References"): the
// cross-board checks BoardService makes against the organization's stored boards.

import { type Board, createBoard } from '@collega/domain/boards'
import { createStatus, type Status } from '@collega/domain/statuses'
import { describe, expect, it } from 'vitest'
import { BoardService } from '../../src/boards/board-service.js'
import type { SwimlaneInput } from '../../src/boards/models.js'
import type { BoardRepository, BoardStatusIdeaCount } from '../../src/boards/ports.js'
import { ConflictError, UnprocessableError } from '../../src/common/index.js'
import type { IdeaRepository } from '../../src/ideas/ports.js'
import type { StatusRepository } from '../../src/statuses/ports.js'
import {
  countingUnitOfWork,
  fixedClock,
  NOW,
  ORG_A,
  ORG_B,
  orgAdmin,
  recordingAudit,
} from '../support/fixtures.js'

const S1 = 'status-1'
const S2 = 'status-2'

function status(id: string): Status {
  return createStatus({
    id,
    organizationId: ORG_A,
    name: id,
    color: '#123456',
    sortOrder: 1,
    nowUtc: NOW,
    actorUserId: 'seed',
  })
}

function board(
  id: string,
  extra: {
    organizationId?: string
    referencesBoardId?: string | null
    keyPrefix?: string
    nextItemNumber?: number
  } = {},
): Board {
  const created = createBoard({
    id,
    organizationId: extra.organizationId ?? ORG_A,
    name: id,
    allowUserStatusUpdate: false,
    orderedLanes: [
      { statusId: S1, isFinal: false, referencesBoardId: extra.referencesBoardId ?? null },
      { statusId: S2, isFinal: true, referencesBoardId: null },
    ],
    keyPrefix: extra.keyPrefix,
    nowUtc: NOW,
    actorUserId: 'seed',
  })
  return { ...created, nextItemNumber: extra.nextItemNumber ?? 1 }
}

const LANES: SwimlaneInput[] = [
  { statusId: S1, order: 0 },
  { statusId: S2, order: 1 },
]

function lanesReferencing(boardId: string | null): SwimlaneInput[] {
  return [
    { statusId: S1, order: 0, referencesBoardId: boardId },
    { statusId: S2, order: 1 },
  ]
}

function harness(boards: readonly Board[], statusCounts: readonly BoardStatusIdeaCount[] = []) {
  const byId = new Map(boards.map((b) => [b.id, b]))
  const saved: Board[] = []
  const added: Board[] = []
  const repository = {
    async add(b: Board) {
      added.push(b)
    },
    async save(b: Board) {
      saved.push(b)
    },
    async getById(id: string) {
      return byId.get(id) ?? null
    },
    async listByOrganization(organizationId: string) {
      return [...byId.values()].filter((b) => b.organizationId === organizationId)
    },
    async countIdeasByBoardAndStatus() {
      return statusCounts
    },
    async listLaneIdeas() {
      return []
    },
    async moveIdeas() {},
    async reassignIdeas() {},
  } as unknown as BoardRepository
  const allStatuses = [status(S1), status(S2), status('status-3')]
  const statuses = {
    async listByOrganization() {
      return allStatuses
    },
  } as unknown as StatusRepository
  const service = new BoardService(
    repository,
    statuses,
    {
      async existsById() {
        return true
      },
    },
    countingUnitOfWork(),
    recordingAudit(),
    orgAdmin(ORG_A),
    fixedClock(),
    {} as IdeaRepository,
  )
  return { service, saved, added }
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    if (error instanceof UnprocessableError) {
      return error.code
    }
    if (error instanceof ConflictError) {
      return error.message
    }
    throw error
  }
  return 'none'
}

const update = (service: BoardService, id: string, swimlanes: SwimlaneInput[], extra = {}) =>
  service.update(id, { name: id, allowUserStatusUpdate: false, swimlanes, ...extra })

describe('lane references', () => {
  it('refuses a lane that references its own board', async () => {
    const { service } = harness([board('a'), board('b')])

    expect(await codeOf(update(service, 'a', lanesReferencing('a')))).toBe('laneReferencesOwnBoard')
  })

  it.each([
    ['missing', 'nope', [board('a')]],
    ['archived', 'b', [board('a'), { ...board('b'), isArchived: true }]],
    ['in another organization', 'b', [board('a'), board('b', { organizationId: ORG_B })]],
  ])('refuses a %s target as referencesBoardInvalid', async (_label, target, boards) => {
    const { service } = harness(boards)

    expect(await codeOf(update(service, 'a', lanesReferencing(target)))).toBe(
      'referencesBoardInvalid',
    )
  })

  it('refuses a target that itself has a reference lane', async () => {
    const { service } = harness([board('a'), board('b', { referencesBoardId: 'c' }), board('c')])

    expect(await codeOf(update(service, 'a', lanesReferencing('b')))).toBe(
      'referenceChainNotAllowed',
    )
  })

  it('refuses a reference lane on a board that is already a target', async () => {
    const { service } = harness([board('a'), board('b', { referencesBoardId: 'a' }), board('c')])

    expect(await codeOf(update(service, 'a', lanesReferencing('c')))).toBe(
      'referenceChainNotAllowed',
    )
  })

  it('turns idea features off on a board first named as a target, once', async () => {
    const first = harness([board('a'), board('b')])

    await update(first.service, 'a', lanesReferencing('b'))

    expect(first.saved.map((b) => [b.id, b.ideaFeaturesEnabled])).toEqual([
      ['a', true],
      ['b', false],
    ])

    const again = harness([board('a'), board('b'), board('c', { referencesBoardId: 'b' })])
    await update(again.service, 'a', lanesReferencing('b'))

    expect(again.saved.map((b) => b.id)).toEqual(['a'])
  })

  it('saves lane flags on create', async () => {
    const { service, added } = harness([board('b')])

    await service.create(ORG_A, {
      name: 'New',
      allowUserStatusUpdate: false,
      swimlanes: [
        { statusId: S1, order: 0, referencesBoardId: 'b', isFinal: false },
        { statusId: S2, order: 1, isFinal: true },
      ],
    })

    expect(added[0]?.swimlanes.map((l) => [l.isFinal, l.referencesBoardId])).toEqual([
      [false, 'b'],
      [true, null],
    ])
  })
})

describe('laneInUse', () => {
  const held = [{ boardId: 'a', statusId: S1, ideaCount: 2 }]

  it.each([
    ['changed', lanesReferencing('c')],
    ['removed from the lane', lanesReferencing(null)],
  ])('refuses a reference %s while the lane holds ideas', async (_label, swimlanes) => {
    const { service } = harness(
      [board('a', { referencesBoardId: 'b' }), board('b'), board('c')],
      held,
    )

    expect(await codeOf(update(service, 'a', swimlanes))).toBe('laneInUse')
  })

  it('refuses removing a reference lane that holds ideas, even with an idea move', async () => {
    const { service } = harness([board('a', { referencesBoardId: 'b' }), board('b')], held)

    expect(
      await codeOf(
        update(
          service,
          'a',
          [
            { statusId: S2, order: 0 },
            { statusId: 'status-3', order: 1 },
          ],
          {
            ideaMoves: [{ fromStatusId: S1, toStatusId: S2 }],
          },
        ),
      ),
    ).toBe('laneInUse')
  })

  it('allows the change when the lane is empty or the reference is unchanged', async () => {
    const empty = harness([board('a', { referencesBoardId: 'b' }), board('b'), board('c')])
    const same = harness([board('a', { referencesBoardId: 'b' }), board('b')], held)

    await expect(update(empty.service, 'a', lanesReferencing('c'))).resolves.toBeDefined()
    await expect(update(same.service, 'a', lanesReferencing('b'))).resolves.toBeDefined()
  })
})

describe('archiving a reference target', () => {
  it('refuses while a lane references the board', async () => {
    const { service } = harness([board('a', { referencesBoardId: 'b' }), board('b')])

    expect(await codeOf(service.archive('b'))).toBe('referenceTargetArchived')
  })

  it('allows archiving the referencing board', async () => {
    const { service, saved } = harness([board('a', { referencesBoardId: 'b' }), board('b')])

    await service.archive('a')

    expect(saved.map((b) => b.id)).toEqual(['a'])
  })
})

describe('keyPrefix', () => {
  it('upper-cases and stores a prefix on create', async () => {
    const { service, added } = harness([])

    await service.create(ORG_A, {
      name: 'New',
      allowUserStatusUpdate: false,
      swimlanes: LANES,
      keyPrefix: 'ab',
    })

    expect(added[0]?.keyPrefix).toBe('AB')
  })

  it('answers keyPrefixTaken for a duplicate in the organization, on create and update', async () => {
    const { service } = harness([board('a', { keyPrefix: 'AB' }), board('b')])

    expect(
      await codeOf(
        service.create(ORG_A, {
          name: 'x',
          allowUserStatusUpdate: false,
          swimlanes: LANES,
          keyPrefix: 'ab',
        }),
      ),
    ).toBe('keyPrefixTaken')
    expect(await codeOf(update(service, 'b', LANES, { keyPrefix: 'AB' }))).toBe('keyPrefixTaken')
  })

  it('lets a board keep its own prefix on save', async () => {
    const { service } = harness([board('a', { keyPrefix: 'AB', nextItemNumber: 3 })])

    await expect(update(service, 'a', LANES, { keyPrefix: 'AB' })).resolves.toBeDefined()
  })

  it('locks the prefix once a key has been issued, but not before', async () => {
    const issued = harness([board('a', { keyPrefix: 'AB', nextItemNumber: 2 })])
    const fresh = harness([board('a', { keyPrefix: 'AB', nextItemNumber: 1 })])

    expect(await codeOf(update(issued.service, 'a', LANES, { keyPrefix: 'CD' }))).toBe(
      'keyPrefixLocked',
    )
    expect(await codeOf(update(issued.service, 'a', LANES, { keyPrefix: null }))).toBe(
      'keyPrefixLocked',
    )
    await expect(update(fresh.service, 'a', LANES, { keyPrefix: 'CD' })).resolves.toBeDefined()
  })

  it('leaves the prefix alone when the update omits it', async () => {
    const { service } = harness([board('a', { keyPrefix: 'AB', nextItemNumber: 5 })])

    await expect(update(service, 'a', LANES)).resolves.toMatchObject({ keyPrefix: 'AB' })
  })
})
