// Board archive (SPEC/20-feature-boards-and-statuses.md rule 13): an archived board keeps its lanes
// and ideas but its own settings are frozen until it is unarchived; archive and unarchive are both
// idempotent and an archived board keeps the time it was first archived.

import { describe, expect, it } from 'vitest'
import {
  archiveBoard,
  type Board,
  BoardArchivedError,
  BoardInvariantError,
  createBoard,
  reorderBoardSwimlanes,
  unarchiveBoard,
  updateBoard,
} from '../../src/boards/index.js'

const NOW = new Date('2026-09-27T12:00:00.000Z')
const LATER = new Date('2026-09-28T12:00:00.000Z')
const LATEST = new Date('2026-09-29T12:00:00.000Z')

function active(): Board {
  return createBoard({
    id: 'board-1',
    organizationId: 'org-1',
    name: 'Ideas',
    allowUserStatusUpdate: false,
    orderedStatusIds: ['status-1', 'status-2'],
    nowUtc: NOW,
    actorUserId: 'user-1',
  })
}

function rename(board: Board, name: string): Board {
  return updateBoard(
    board,
    {
      name,
      allowUserStatusUpdate: board.allowUserStatusUpdate,
      orderedStatusIds: board.swimlanes.map((swimlane) => swimlane.statusId),
    },
    LATEST,
    'user-3',
  )
}

describe('archiveBoard', () => {
  it('starts every new board active', () => {
    expect(active()).toMatchObject({ isArchived: false, archivedAtUtc: null })
  })

  it('archives in place, keeping the lanes and stamping the time and actor', () => {
    const board = active()
    const archived = archiveBoard(board, LATER, 'user-2')

    expect(archived).toMatchObject({
      isArchived: true,
      archivedAtUtc: LATER,
      updatedAtUtc: LATER,
      updatedByUserId: 'user-2',
    })
    expect(archived.swimlanes).toEqual(board.swimlanes)
    expect(archived.name).toBe(board.name)
  })

  it('returns an archived board unchanged, keeping the first archive time', () => {
    const archived = archiveBoard(active(), LATER, 'user-2')

    const again = archiveBoard(archived, LATEST, 'user-3')

    expect(again).toBe(archived)
    expect(again.archivedAtUtc).toEqual(LATER)
  })
})

describe('unarchiveBoard', () => {
  it('clears the flag and the archive time', () => {
    const restored = unarchiveBoard(archiveBoard(active(), LATER, 'user-2'), LATEST, 'user-3')

    expect(restored).toMatchObject({
      isArchived: false,
      archivedAtUtc: null,
      updatedAtUtc: LATEST,
      updatedByUserId: 'user-3',
    })
  })

  it('returns an active board unchanged', () => {
    const board = active()

    expect(unarchiveBoard(board, LATER, 'user-2')).toBe(board)
  })
})

describe('an archived board’s settings are frozen', () => {
  it('refuses an update with BoardArchivedError, not the field-keyed invariant error', () => {
    const archived = archiveBoard(active(), LATER, 'user-2')

    expect(() => rename(archived, 'Renamed')).toThrow(BoardArchivedError)
    expect(() => rename(archived, 'Renamed')).not.toThrow(BoardInvariantError)
  })

  it('refuses a swimlane reorder', () => {
    const archived = archiveBoard(active(), LATER, 'user-2')

    expect(() =>
      reorderBoardSwimlanes(archived, ['status-2', 'status-1'], LATEST, 'user-3'),
    ).toThrow(BoardArchivedError)
  })

  it('accepts both again once the board is unarchived', () => {
    const restored = unarchiveBoard(archiveBoard(active(), LATER, 'user-2'), LATEST, 'user-3')

    expect(rename(restored, 'Renamed').name).toBe('Renamed')
    expect(
      reorderBoardSwimlanes(restored, ['status-2', 'status-1'], LATEST, 'user-3').swimlanes.map(
        (swimlane) => swimlane.statusId,
      ),
    ).toEqual(['status-2', 'status-1'])
  })
})
