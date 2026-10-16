// Item numbers beyond the create path (Board References Ruling 3): CSV import numbering, detach
// leaving the number null, and the `itemKey` shape on list, delivery and detail projections.

import { describe, expect, it } from 'vitest'
import type { IdeaImportRow } from '../../src/ideas/models.js'
import { orgAdmin } from '../support/fixtures.js'
import {
  BOARD_A,
  BOARD_B,
  board,
  CREATE,
  harness,
  idea,
  LIST_QUERY,
  promotedIdea,
} from './idea-service-harness.js'

const ORG = orgAdmin()

function row(rowNumber: number, title: string): IdeaImportRow {
  return {
    rowNumber,
    cells: new Map(
      Object.entries({
        title,
        priority: 'Medium',
        'idea type': 'Improvement',
        'business impact': 'Medium',
      }),
    ),
  }
}

describe('IdeaService item numbers: CSV import', () => {
  it('numbers imported rows consecutively after existing creates', async () => {
    const h = harness({ currentUser: ORG, boards: [board({ keyPrefix: 'CI' })] })
    await h.service.create(BOARD_A, CREATE)

    const result = await h.service.importBoardIdeas(BOARD_A, [row(1, 'One'), row(2, 'Two')])

    expect(result.createdCount).toBe(2)
    expect(h.added.map((i) => i.itemNumber)).toEqual([1, 2, 3])
  })

  it('does not spend a number on a row rejected before creation', async () => {
    const h = harness({ currentUser: ORG, boards: [board({ keyPrefix: 'CI' })] })
    const bad: IdeaImportRow = { rowNumber: 2, cells: new Map([['title', '']]) }

    const result = await h.service.importBoardIdeas(BOARD_A, [row(1, 'One'), bad, row(3, 'Three')])

    expect(result.createdCount).toBe(2)
    expect(h.added.map((i) => i.itemNumber)).toEqual([1, 2])
  })

  it('leaves imported rows unnumbered on a board without a prefix', async () => {
    const h = harness({ currentUser: ORG, boards: [board({ keyPrefix: null })] })

    await h.service.importBoardIdeas(BOARD_A, [row(1, 'One'), row(2, 'Two')])

    expect(h.added.map((i) => i.itemNumber)).toEqual([null, null])
  })

  it('counts each board separately', async () => {
    const h = harness({
      currentUser: ORG,
      boards: [board({ keyPrefix: 'AA' }), board({ boardId: BOARD_B, keyPrefix: 'BB' })],
    })

    await h.service.importBoardIdeas(BOARD_A, [row(1, 'One'), row(2, 'Two')])
    await h.service.importBoardIdeas(BOARD_B, [row(1, 'One')])

    expect(h.added.map((i) => [i.boardId, i.itemNumber])).toEqual([
      [BOARD_A, 1],
      [BOARD_A, 2],
      [BOARD_B, 1],
    ])
  })
})

describe('IdeaService item numbers: detach', () => {
  it('saves the idea with no number and no board', async () => {
    const h = harness({
      currentUser: ORG,
      boards: [board({ keyPrefix: 'CI' })],
      ideas: [idea({ itemNumber: 7 })],
    })

    await h.service.detachFromBoard('idea-1')

    expect(h.saved).toHaveLength(1)
    expect(h.saved[0]?.boardId).toBeNull()
    expect(h.saved[0]?.itemNumber).toBeNull()
  })

  it('answers no key for a detached idea', async () => {
    const h = harness({
      currentUser: ORG,
      boards: [board({ keyPrefix: 'CI' })],
      ideas: [idea({ boardId: null, itemNumber: null })],
    })

    expect((await h.service.getById('idea-1')).itemKey).toBeNull()
  })
})

describe('IdeaService item key projections', () => {
  it('keys numbered list items and leaves an unnumbered item null', async () => {
    const h = harness({
      currentUser: ORG,
      boards: [board({ keyPrefix: 'CI' })],
      ideas: [idea({ id: 'idea-1', itemNumber: 4 }), idea({ id: 'idea-2', itemNumber: null })],
    })

    const page = await h.service.listByBoard(BOARD_A, LIST_QUERY)

    expect(new Map(page.items.map((i) => [i.ideaId, i.itemKey]))).toEqual(
      new Map([
        ['idea-1', 'CI-4'],
        ['idea-2', null],
      ]),
    )
  })

  it('gives no key on a board without a prefix, even for a stale number', async () => {
    const h = harness({
      currentUser: ORG,
      boards: [board({ keyPrefix: null })],
      ideas: [idea({ itemNumber: 4 })],
    })

    const page = await h.service.listByBoard(BOARD_A, LIST_QUERY)

    expect(page.items.map((i) => i.itemKey)).toEqual([null])
    expect((await h.service.getById('idea-1')).itemKey).toBeNull()
  })

  it('keys the delivery card of a numbered issue', async () => {
    const h = harness({
      currentUser: ORG,
      boards: [board({ keyPrefix: 'CI' })],
      ideas: [promotedIdea({ itemNumber: 12 })],
    })

    const cards = await h.service.listDelivery(ORG.organizationId as string, {
      sprintId: null,
      deliveryStatus: null,
    })

    expect(cards.map((c) => c.itemKey)).toEqual(['CI-12'])
  })
})
