import { describe, expect, it } from 'vitest'
import { waitsOn } from '@/lib/board-work'

/**
 * `waitsOn` (slice 300): whether a candidate blocker already waits, directly or through others, on
 * the item - the picker disables such a row, mirroring the server's `dependencyCycle`.
 */
const card = (id: string, ...blockedBy: string[]) => ({
  id,
  blockedBy: blockedBy.map((ideaId) => ({ ideaId, itemKey: null, isFinal: false })),
})

describe('waitsOn', () => {
  it('is false when the candidate waits on nothing', () => {
    expect(waitsOn([card('b'), card('a')], 'b', 'a')).toBe(false)
  })

  it('is true when the candidate waits directly on the item', () => {
    expect(waitsOn([card('b', 'a'), card('a')], 'b', 'a')).toBe(true)
  })

  it('is true when the candidate waits on the item through a chain', () => {
    const cards = [card('b', 'c'), card('c', 'd'), card('d', 'a'), card('a')]

    expect(waitsOn(cards, 'b', 'a')).toBe(true)
  })

  it('is false when the item waits on the candidate, which is the allowed direction', () => {
    expect(waitsOn([card('a', 'b'), card('b')], 'b', 'a')).toBe(false)
  })

  it('is false for a candidate whose chain never reaches the item', () => {
    const cards = [card('b', 'c'), card('c', 'x'), card('a'), card('x')]

    expect(waitsOn(cards, 'b', 'a')).toBe(false)
  })

  it('finds the item down a second branch', () => {
    const cards = [card('b', 'c', 'd'), card('c'), card('d', 'a'), card('a')]

    expect(waitsOn(cards, 'b', 'a')).toBe(true)
  })

  it('terminates on a loop that does not include the item', () => {
    const cards = [card('b', 'c'), card('c', 'b'), card('a')]

    expect(waitsOn(cards, 'b', 'a')).toBe(false)
  })

  it('terminates on a diamond and still finds the item behind it', () => {
    const cards = [card('b', 'c', 'd'), card('c', 'e'), card('d', 'e'), card('e', 'a'), card('a')]

    expect(waitsOn(cards, 'b', 'a')).toBe(true)
  })

  it('treats a blocker beyond the board page as the end of the chain', () => {
    expect(waitsOn([card('b', 'off-page')], 'b', 'a')).toBe(false)
  })

  it('is false for a candidate that is not among the cards', () => {
    expect(waitsOn([card('a')], 'missing', 'a')).toBe(false)
  })
})
