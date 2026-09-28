// Sprint 11's additions to IdeaService (SPEC/30-Contracts.md 2026-09-28): a tag created inline takes
// a random palette colour from the injected source (ideas Tags rule 10) on create, update and CSV
// import; idea reads carry `tags` with colours in `tagNames`' order and list items carry `effort`;
// and `GET /ideas/{ideaId}/delivery` answers one Issue's card, composed as the list's is.

import { EffortLevel, IdeaPhase } from '@collega/domain/enums'
import { TAG_COLOR_PALETTE } from '@collega/domain/tags'
import { describe, expect, it } from 'vitest'
import { NotFoundError, type RandomSource, UnauthorizedError } from '../../src/common/index.js'
import type { IdeaImportRow } from '../../src/ideas/models.js'
import {
  anonymous,
  member,
  ORG_A,
  ORG_B,
  orgAdmin,
  readOnly,
  siteAdmin,
} from '../support/fixtures.js'
import {
  AUTHOR,
  BOARD_A,
  CREATE,
  harness,
  idea,
  LIST_QUERY,
  ORG_LIST_QUERY,
  promotedIdea,
  updateFrom,
} from './idea-service-harness.js'

const EXISTING = { id: 'tag-existing', name: 'Existing', color: '#2F9E8F' }

/** Always draws `index`, and records the bound it was asked for. */
function drawing(index: number): RandomSource & { bounds: number[] } {
  const bounds: number[] = []
  return {
    bounds,
    nextInt(maxExclusive) {
      bounds.push(maxExclusive)
      return index
    },
  }
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('expected a rejection')
    },
    (error: unknown) => error,
  )
}

describe('IdeaService inline tag creation takes a random palette colour', () => {
  it('on create, draws once per new tag from the palette and not for an existing one', async () => {
    const random = drawing(7)
    const h = harness({ currentUser: member(ORG_A, AUTHOR), tags: [EXISTING], random })

    await h.service.create(BOARD_A, { ...CREATE, tagNames: ['Brand new', 'existing'] })

    expect(h.createdTags).toEqual([
      { id: 'tag-Brand new', name: 'Brand new', color: TAG_COLOR_PALETTE[7] },
    ])
    expect(random.bounds).toEqual([TAG_COLOR_PALETTE.length])
    expect(h.added[0]?.tagIds).toEqual(['tag-Brand new', EXISTING.id])
  })

  it('on update', async () => {
    const random = drawing(2)
    const existing = idea({ authorUserId: AUTHOR })
    const h = harness({ currentUser: member(ORG_A, AUTHOR), ideas: [existing], random })

    await h.service.update(existing.id, { ...updateFrom(existing), tagNames: ['Later'] })

    expect(h.createdTags.map((t) => t.color)).toEqual([TAG_COLOR_PALETTE[2]])
  })

  it('on CSV import, for each new tag in the row', async () => {
    const random = drawing(9)
    const h = harness({ currentUser: member(ORG_A, AUTHOR), tags: [EXISTING], random })
    // One tag per row, so the test holds whatever the Tags cell's delimiter turns out to be (the
    // spec says a pipe; the parser splits on commas - an open follow-up).
    const rows: IdeaImportRow[] = ['Alpha', 'Existing', 'Beta'].map((tags, index) => ({
      rowNumber: index + 1,
      cells: new Map(
        Object.entries({
          title: `Imported ${index + 1}`,
          priority: 'Medium',
          'idea type': 'Improvement',
          'business impact': 'Medium',
          tags,
        }),
      ),
    }))

    const result = await h.service.importBoardIdeas(BOARD_A, rows)

    expect(result.createdCount).toBe(3)
    expect(h.createdTags.map((t) => [t.name, t.color])).toEqual([
      ['Alpha', '#94A3B8'],
      ['Beta', '#94A3B8'],
    ])
    expect(random.bounds).toEqual([10, 10])
  })
})

describe('IdeaService idea reads carry coloured tags and effort', () => {
  const tags = [
    { id: 't-ux', name: 'ux', color: '#E879A6' },
    { id: 't-api', name: 'API', color: '#6B9BF2' },
    { id: 't-gone', name: 'Gone', color: '#000000' },
  ]
  const discovery = idea({ id: 'idea-d', tagIds: ['t-ux', 't-api', 't-missing'] })
  const issue = promotedIdea({ id: 'idea-i', tagIds: [] })

  it('on board list items: tags in tagNames order, and effort only once set', async () => {
    const h = harness({ currentUser: member(), ideas: [discovery, issue], tags })

    const page = await h.service.listByBoard(BOARD_A, LIST_QUERY)
    const d = page.items.find((i) => i.ideaId === 'idea-d')
    const i = page.items.find((x) => x.ideaId === 'idea-i')

    expect(d?.tagNames).toEqual(['API', 'ux'])
    expect(d?.tags).toEqual([
      { tagId: 't-api', name: 'API', color: '#6B9BF2' },
      { tagId: 't-ux', name: 'ux', color: '#E879A6' },
    ])
    expect(d?.effort).toBeNull()
    expect(i?.tags).toEqual([])
    expect(i?.effort).toBe(EffortLevel.Medium)
  })

  it('on organization list items and the detail', async () => {
    const h = harness({ currentUser: member(), ideas: [discovery], tags })

    const page = await h.service.listByOrganization(ORG_A, ORG_LIST_QUERY)
    expect(page.items[0]?.tags.map((t) => t.name)).toEqual(['API', 'ux'])
    expect(page.items[0]?.effort).toBeNull()

    const detail = await h.service.getById(discovery.id)
    expect(detail.tags).toEqual(page.items[0]?.tags)
    expect(detail.tagNames).toEqual(['API', 'ux'])
  })
})

describe('IdeaService.getDelivery', () => {
  const tags = [{ id: 't-api', name: 'API', color: '#6B9BF2' }]
  const issue = promotedIdea({ id: 'issue-1', tagIds: ['t-api'] })
  const other = promotedIdea({ id: 'issue-2' })

  it('answers the same card the delivery list composes for it', async () => {
    const h = harness({ currentUser: member(), ideas: [issue, other], tags })

    const list = await h.service.listDelivery(ORG_A, { sprintId: null, deliveryStatus: null })
    const card = await h.service.getDelivery(issue.id)

    expect(card).toEqual(list.find((c) => c.ideaId === issue.id))
    expect(card).toMatchObject({
      phase: IdeaPhase.Delivery,
      effort: EffortLevel.Medium,
      tags: [{ tagId: 't-api', name: 'API', color: '#6B9BF2' }],
    })
  })

  it.each([
    ['Read Only', readOnly()],
    ['a member', member()],
    ['an Org Admin', orgAdmin()],
    ['a Site Admin', siteAdmin()],
  ])('is readable by %s', async (_label, currentUser) => {
    const h = harness({ currentUser, ideas: [issue] })
    await expect(h.service.getDelivery(issue.id)).resolves.toMatchObject({ ideaId: issue.id })
  })

  it.each([
    ['a missing idea', 'nope', [issue]],
    ['a Discovery idea', 'idea-1', [idea()]],
    ['a soft-deleted Issue', issue.id, [{ ...issue, isDeleted: true }]],
  ])('is a 404 for %s', async (_label, ideaId, ideas) => {
    const h = harness({ currentUser: orgAdmin(), ideas })
    expect(await rejection(h.service.getDelivery(ideaId))).toBeInstanceOf(NotFoundError)
  })

  it("is a 404 for another organization's Issue, for every role there", async () => {
    for (const currentUser of [orgAdmin(ORG_B), member(ORG_B), readOnly(ORG_B)]) {
      const h = harness({ currentUser, ideas: [issue] })
      expect(await rejection(h.service.getDelivery(issue.id))).toBeInstanceOf(NotFoundError)
    }
  })

  it('is a 401 anonymously', async () => {
    const h = harness({ currentUser: anonymous, ideas: [issue] })
    expect(await rejection(h.service.getDelivery(issue.id))).toBeInstanceOf(UnauthorizedError)
  })
})
