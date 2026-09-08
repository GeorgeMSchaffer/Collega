import { describe, expect, it } from 'vitest'
import {
  boards,
  ideas,
  ideasForBoard,
  navCounts,
  type Status,
  statusById,
  statuses,
} from '@/lib/mock'

/**
 * The seeded distribution: two boards per organization, eleven ideas per board, spread `3/2/2/1/3`
 * across the five statuses in canonical order (`SPEC/40-test-strategy.md`).
 *
 * The fixture is the only thing honouring that shape now, and `buildIdeas` drops silently — a
 * missing status or a short title array hits `continue` and produces fewer ideas with no error. The
 * counts below are what turns that silence into a failure.
 */
const CANONICAL_STATUS_IDS = ['new', 'review', 'progress', 'client', 'done']
const PER_STATUS = [3, 2, 2, 1, 3]
const PER_BOARD = 11

function statusIdsInOrder(boardId: string): string[] {
  const seen: string[] = []
  for (const idea of ideasForBoard(boardId)) {
    if (seen.at(-1) !== idea.statusId) seen.push(idea.statusId)
  }
  return seen
}

describe('the canonical status list', () => {
  it('is the five statuses the distribution is written against', () => {
    // A sixth status would receive nothing from `PER_STATUS` and the per-status counts below would
    // still pass, so the length is asserted separately from the counts.
    expect(statuses.map((status: Status) => status.id)).toEqual(CANONICAL_STATUS_IDS)
  })

  it('accounts for every seeded idea', () => {
    const unknown = ideas.filter((idea) => statusById(idea.statusId) === undefined)
    expect(unknown).toEqual([])
  })
})

describe('the seeded boards', () => {
  it('seeds two boards', () => {
    expect(boards).toHaveLength(2)
  })

  for (const board of boards) {
    it(`gives ${board.name} eleven ideas`, () => {
      expect(ideasForBoard(board.id)).toHaveLength(PER_BOARD)
    })

    it(`spreads ${board.name} 3/2/2/1/3 across the statuses`, () => {
      const rows = ideasForBoard(board.id)
      const counts = CANONICAL_STATUS_IDS.map(
        (statusId) => rows.filter((idea) => idea.statusId === statusId).length,
      )
      expect(counts).toEqual(PER_STATUS)
    })

    it(`orders ${board.name} by canonical status, not by insertion accident`, () => {
      expect(statusIdsInOrder(board.id)).toEqual(CANONICAL_STATUS_IDS)
    })

    it(`states an idea count on ${board.name} that matches the ideas it has`, () => {
      expect(board.ideaCount).toBe(ideasForBoard(board.id).length)
    })
  }

  it('adds up to every idea, with none stranded on an unknown board', () => {
    expect(ideas).toHaveLength(boards.length * PER_BOARD)
    const boardIds = new Set(boards.map((board) => board.id))
    expect(ideas.filter((idea) => !boardIds.has(idea.boardId))).toEqual([])
  })

  it('sums to the count the sidebar advertises', () => {
    expect(navCounts.ideas).toBe(ideas.length)
    expect(navCounts.boards).toBe(boards.length)
  })
})

describe('the seeded ideas themselves', () => {
  it('gives every idea a distinct id', () => {
    expect(new Set(ideas.map((idea) => idea.id)).size).toBe(ideas.length)
  })

  it('gives every idea a distinct human reference across both boards', () => {
    // The reference is the eyebrow the inspector shows. Two ideas sharing one would make the
    // inspector heading ambiguous, and the offset that separates the boards is easy to lose.
    expect(new Set(ideas.map((idea) => idea.reference)).size).toBe(ideas.length)
  })

  it('gives every idea a title and a description', () => {
    // `buildIdeas` falls back to '' rather than failing, so an empty one is silent.
    expect(ideas.filter((idea) => idea.title.length === 0)).toEqual([])
    expect(ideas.filter((idea) => idea.description.length === 0)).toEqual([])
  })

  it('dates every idea without reading the clock', () => {
    // Fixed dates: a screenshot taken tomorrow must look like today's.
    expect(ideas.every((idea) => /^2026-08-\d{2}$/.test(idea.createdOn))).toBe(true)
  })
})
