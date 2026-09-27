// Board description (SPEC/20-feature-boards-and-statuses.md rule 12): optional, trimmed, a blank
// value stored as none, at most 500 characters. The limit is judged on the TRIMMED value, so the
// boundary cases pad with whitespace to prove padding never counts against it.

import { describe, expect, it } from 'vitest'
import {
  BOARD_DESCRIPTION_MAX_LENGTH,
  type Board,
  BoardInvariantError,
  createBoard,
  updateBoard,
} from '../../src/boards/index.js'

const NOW = new Date('2026-09-27T12:00:00.000Z')
const LATER = new Date('2026-09-28T12:00:00.000Z')

function create(description?: string | null): Board {
  return createBoard({
    id: 'board-1',
    organizationId: 'org-1',
    name: 'Ideas',
    description,
    allowUserStatusUpdate: false,
    orderedStatusIds: ['status-1', 'status-2'],
    nowUtc: NOW,
    actorUserId: 'user-1',
  })
}

function update(board: Board, description?: string | null): Board {
  return updateBoard(
    board,
    {
      name: board.name,
      description,
      allowUserStatusUpdate: board.allowUserStatusUpdate,
      orderedStatusIds: board.swimlanes.map((swimlane) => swimlane.statusId),
    },
    LATER,
    'user-2',
  )
}

function invariantFieldOf(fn: () => unknown): string {
  try {
    fn()
  } catch (error) {
    if (error instanceof BoardInvariantError) {
      return error.field
    }
    throw error
  }
  throw new Error('expected a BoardInvariantError, but nothing was thrown')
}

describe('createBoard description', () => {
  it('stores a description trimmed of surrounding whitespace', () => {
    expect(create('  Assembly cell reliability.\n').description).toBe('Assembly cell reliability.')
  })

  it.each([
    ['absent', undefined],
    ['null', null],
    ['empty', ''],
    ['whitespace only', ' \t\n '],
  ])('stores an %s description as none', (_label, description) => {
    expect(create(description).description).toBeNull()
  })

  it('accepts exactly 500 characters, even with surrounding whitespace', () => {
    const atLimit = 'd'.repeat(BOARD_DESCRIPTION_MAX_LENGTH)

    expect(create(`   ${atLimit}   `).description).toBe(atLimit)
  })

  it('refuses 501 characters, keyed on description', () => {
    const overLimit = 'd'.repeat(BOARD_DESCRIPTION_MAX_LENGTH + 1)

    expect(invariantFieldOf(() => create(overLimit))).toBe('description')
  })

  it('pins the limit at 500, the width of the column', () => {
    expect(BOARD_DESCRIPTION_MAX_LENGTH).toBe(500)
  })
})

describe('updateBoard description', () => {
  it('leaves the stored description unchanged when none is given', () => {
    expect(update(create('Keep me.'), undefined).description).toBe('Keep me.')
  })

  it.each([
    ['null', null],
    ['blank', '   '],
  ])('clears the stored description when given %s', (_label, description) => {
    expect(update(create('Clear me.'), description).description).toBeNull()
  })

  it('replaces the stored description with the trimmed new one', () => {
    expect(update(create('Old.'), '  New.  ').description).toBe('New.')
  })

  it('refuses 501 characters on update, keyed on description', () => {
    const overLimit = 'd'.repeat(BOARD_DESCRIPTION_MAX_LENGTH + 1)

    expect(invariantFieldOf(() => update(create('Old.'), overLimit))).toBe('description')
  })
})
