import { describe, expect, it } from 'vitest'
import { ruleMessage } from '@/lib/server/rule-messages'

/** The three refusals sprint planning from the Backlog can come back with, in words. */
describe('ruleMessage for sprint planning', () => {
  it.each([
    ['sprintItemOnOtherBoard', 'A sprint holds tasks from its own board only.'],
    ['sprintItemAlreadyAssigned', 'A task already in a sprint can’t be put in a new one.'],
    ['sprintsNotEnabled', 'Sprints are switched off on this board.'],
  ])('says %s plainly', (key, words) => {
    expect(ruleMessage(key)).toBe(words)
  })

  it('shows an unknown key as it came', () => {
    expect(ruleMessage('somethingNew')).toBe('somethingNew')
  })
})
