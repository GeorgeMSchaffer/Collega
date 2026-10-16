// Board References, lanes and flags (SPEC/contracts/boards.md "Board References"): a lane carries
// `isFinal` and `referencesBoardId`, a board carries a key prefix and two feature flags.

import { describe, expect, it } from 'vitest'
import {
  type Board,
  BoardInvariantError,
  createBoard,
  reorderBoardSwimlanes,
  updateBoard,
} from '../../src/boards/index.js'

const NOW = new Date('2026-10-15T12:00:00.000Z')
const LATER = new Date('2026-10-16T12:00:00.000Z')

const LANES = [
  { statusId: 'status-1', isFinal: false, referencesBoardId: 'board-9' },
  { statusId: 'status-2', isFinal: true, referencesBoardId: null },
  { statusId: 'status-3', isFinal: true, referencesBoardId: null },
]

function create(extra: { keyPrefix?: string | null; sprintsEnabled?: boolean } = {}): Board {
  return createBoard({
    id: 'board-1',
    organizationId: 'org-1',
    name: 'Ideas',
    allowUserStatusUpdate: false,
    orderedLanes: LANES,
    nowUtc: NOW,
    actorUserId: 'user-1',
    ...extra,
  })
}

function fieldOf(fn: () => unknown): string {
  try {
    fn()
  } catch (error) {
    if (error instanceof BoardInvariantError) {
      return error.field
    }
    throw error
  }
  throw new Error('expected a BoardInvariantError')
}

describe('createBoard lanes and flags', () => {
  it('keeps both lane fields and allows several final lanes', () => {
    expect(create().swimlanes).toEqual([
      { statusId: 'status-1', displayOrder: 0, isFinal: false, referencesBoardId: 'board-9' },
      { statusId: 'status-2', displayOrder: 1, isFinal: true, referencesBoardId: null },
      { statusId: 'status-3', displayOrder: 2, isFinal: true, referencesBoardId: null },
    ])
  })

  it('defaults the flags and starts item numbering at 1', () => {
    const board = create()

    expect(board).toMatchObject({
      keyPrefix: null,
      sprintsEnabled: false,
      ideaFeaturesEnabled: true,
      nextItemNumber: 1,
    })
  })

  it('upper-cases the key prefix', () => {
    expect(create({ keyPrefix: 'ab12' }).keyPrefix).toBe('AB12')
  })

  it.each(['A', 'ABCDEFGHIJK', 'AB-1', 'ab c', 'ÄB'])('refuses the key prefix %j', (keyPrefix) => {
    expect(fieldOf(() => create({ keyPrefix }))).toBe('keyPrefix')
  })

  it('accepts 2 and 10 characters, and treats blank as none', () => {
    expect(create({ keyPrefix: 'AB' }).keyPrefix).toBe('AB')
    expect(create({ keyPrefix: 'ABCDEFGHI0' }).keyPrefix).toBe('ABCDEFGHI0')
    expect(create({ keyPrefix: '  ' }).keyPrefix).toBeNull()
  })
})

describe('updateBoard and reorderBoardSwimlanes with lanes and flags', () => {
  it('leaves the prefix and flags alone when not given, and replaces them when given', () => {
    const board = create({ keyPrefix: 'AB' })
    const params = {
      name: 'Ideas',
      allowUserStatusUpdate: false,
      orderedLanes: LANES,
    }

    const untouched = updateBoard(board, params, LATER, 'user-2')
    const changed = updateBoard(
      board,
      { ...params, keyPrefix: 'cd', sprintsEnabled: true, ideaFeaturesEnabled: false },
      LATER,
      'user-2',
    )
    const cleared = updateBoard(board, { ...params, keyPrefix: null }, LATER, 'user-2')

    expect(untouched).toMatchObject({ keyPrefix: 'AB', sprintsEnabled: false })
    expect(changed).toMatchObject({
      keyPrefix: 'CD',
      sprintsEnabled: true,
      ideaFeaturesEnabled: false,
    })
    expect(cleared.keyPrefix).toBeNull()
  })

  it('refuses a duplicate status across lane inputs', () => {
    expect(
      fieldOf(() =>
        updateBoard(
          create(),
          {
            name: 'x',
            allowUserStatusUpdate: false,
            orderedLanes: [...LANES.slice(0, 1), ...LANES.slice(0, 1)],
          },
          LATER,
          null,
        ),
      ),
    ).toBe('swimlanes')
  })

  it('keeps isFinal and referencesBoardId when lanes are reordered', () => {
    const reordered = reorderBoardSwimlanes(
      create(),
      ['status-3', 'status-1', 'status-2'],
      LATER,
      'user-2',
    )

    expect(reordered.swimlanes).toEqual([
      { statusId: 'status-3', displayOrder: 0, isFinal: true, referencesBoardId: null },
      { statusId: 'status-1', displayOrder: 1, isFinal: false, referencesBoardId: 'board-9' },
      { statusId: 'status-2', displayOrder: 2, isFinal: true, referencesBoardId: null },
    ])
  })
})
