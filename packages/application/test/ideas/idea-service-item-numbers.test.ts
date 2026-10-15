// Item numbers and keys (Board References Ruling 3): a create on a board with a prefix takes the
// next number and answers `<prefix>-<n>`; a board without a prefix numbers nothing.

import { describe, expect, it } from 'vitest'
import { orgAdmin } from '../support/fixtures.js'
import { BOARD_A, board, CREATE, harness, idea } from './idea-service-harness.js'

describe('IdeaService item numbers', () => {
  it('numbers two creates on one board 1 and 2 and keys them', async () => {
    const h = harness({ currentUser: orgAdmin(), boards: [board({ keyPrefix: 'CI' })] })

    const first = await h.service.create(BOARD_A, CREATE)
    const second = await h.service.create(BOARD_A, CREATE)

    expect(h.added.map((i) => i.itemNumber)).toEqual([1, 2])
    expect(first.itemKey).toBe('CI-1')
    expect(second.itemKey).toBe('CI-2')
  })

  it('gives an idea on a board without a prefix no number and no key', async () => {
    const h = harness({ currentUser: orgAdmin(), boards: [board({ keyPrefix: null })] })

    const created = await h.service.create(BOARD_A, CREATE)

    expect(h.added[0]?.itemNumber).toBeNull()
    expect(created.itemKey).toBeNull()
  })

  it('returns the key on the detail read', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: [board({ keyPrefix: 'CI' })],
      ideas: [idea({ itemNumber: 19 })],
    })

    const detail = await h.service.getById('idea-1')

    expect(detail.itemKey).toBe('CI-19')
  })
})
