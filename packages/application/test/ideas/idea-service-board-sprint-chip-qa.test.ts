// QA for the work board sprint chip (SPEC/contracts/ideas.md, 2026-10-19): the `sprint` object on
// every list item and delivery card, the `sprintId` filter the board list hands the repository, and
// who may put an item into a board sprint. In-memory ports only; the SQL half of the filter is
// pinned against a live database in the infrastructure suite.

import { SprintState } from '@collega/domain/enums'
import { describe, expect, it } from 'vitest'
import { ForbiddenError } from '../../src/common/index.js'
import { member, ORG_A, orgAdmin, readOnly, siteAdmin } from '../support/fixtures.js'
import {
  BOARD_A,
  BOARD_B,
  harness,
  idea,
  LIST_QUERY,
  ORG_LIST_QUERY,
  promotedIdea,
} from './idea-service-harness.js'

function sprintRow(id: string, boardId: string | null, name = `Sprint ${id}`) {
  return {
    id,
    organizationId: ORG_A,
    name,
    startDate: '2026-10-05',
    endDate: '2026-10-18',
    state: SprintState.Active,
    isDeleted: false,
    boardId,
  }
}

describe('IdeaService.listByBoard: the sprintId filter reaches the repository', () => {
  const run = async (
    query: Partial<typeof LIST_QUERY & { sprintId: string; noSprint: boolean }>,
  ) => {
    const { service, boardFilters } = harness({
      currentUser: member(ORG_A),
      ideas: [idea()],
    })
    await service.listByBoard(BOARD_A, { ...LIST_QUERY, ...query })
    return boardFilters[0]
  }

  it('applies no sprint filter when the query names none', async () => {
    expect(await run({})).toMatchObject({ sprintId: null, noSprint: false })
  })

  it('hands a sprint id through as the sprint filter', async () => {
    expect(await run({ sprintId: 'sprint-1' })).toMatchObject({
      sprintId: 'sprint-1',
      noSprint: false,
    })
  })

  it('hands the backlog flag through as noSprint with no sprint id', async () => {
    expect(await run({ noSprint: true })).toMatchObject({
      sprintId: null,
      noSprint: true,
    })
  })

  it('keeps the board list Discovery-phase only whichever sprint filter is set', async () => {
    expect((await run({ sprintId: 'sprint-1' }))?.phase).toBe('Discovery')
    expect((await run({ noSprint: true }))?.phase).toBe('Discovery')
  })

  it('builds no filter for a board the organization does not have', async () => {
    const { service, boardFilters } = harness({
      currentUser: member(ORG_A),
      boards: [],
      ideas: [],
    }) // no board in the harness: the read is refused before any filter is built
    await expect(service.listByBoard(BOARD_B, LIST_QUERY)).rejects.toThrow()
    expect(boardFilters).toHaveLength(0)
  })
})

describe('the sprint object on a board list item', () => {
  it('carries sprintId, name, startDate and endDate for an item in a sprint', async () => {
    const { service } = harness({
      currentUser: member(ORG_A),
      ideas: [idea({ sprintId: 'sprint-1' })],
      sprints: [sprintRow('sprint-1', BOARD_A, 'Sprint One')],
    })

    const page = await service.listByBoard(BOARD_A, LIST_QUERY)

    expect(page.items[0]?.sprint).toEqual({
      sprintId: 'sprint-1',
      name: 'Sprint One',
      startDate: '2026-10-05',
      endDate: '2026-10-18',
    })
  })

  it('is null for an item in no sprint, not absent', async () => {
    const { service } = harness({ currentUser: member(ORG_A), ideas: [idea()] })

    const page = await service.listByBoard(BOARD_A, LIST_QUERY)

    expect(page.items[0]).toHaveProperty('sprint', null)
  })

  it('is null when the item points at a sprint the lookup no longer returns', async () => {
    const { service } = harness({
      currentUser: member(ORG_A),
      ideas: [idea({ sprintId: 'gone' })],
      sprints: [],
    })

    const page = await service.listByBoard(BOARD_A, LIST_QUERY)

    expect(page.items[0]?.sprint).toBeNull()
  })

  it('is read the same way for a Read Only member', async () => {
    const { service } = harness({
      currentUser: readOnly(ORG_A),
      ideas: [idea({ sprintId: 'sprint-1' })],
      sprints: [sprintRow('sprint-1', BOARD_A)],
    })

    const page = await service.listByBoard(BOARD_A, LIST_QUERY)

    expect(page.items[0]?.sprint?.sprintId).toBe('sprint-1')
  })

  it('does one batched sprint lookup per page, however many items share sprints', async () => {
    const { service, sprintLookups } = harness({
      currentUser: member(ORG_A),
      ideas: [
        idea({ id: 'i1', sprintId: 'sprint-1' }),
        idea({ id: 'i2', sprintId: 'sprint-1' }),
        idea({ id: 'i3', sprintId: 'sprint-2' }),
        idea({ id: 'i4', sprintId: null }),
      ],
      sprints: [sprintRow('sprint-1', BOARD_A), sprintRow('sprint-2', BOARD_A)],
    })

    const page = await service.listByBoard(BOARD_A, LIST_QUERY)

    expect(sprintLookups).toHaveLength(1)
    expect([...(sprintLookups[0] ?? [])].sort()).toEqual(['sprint-1', 'sprint-2'])
    expect(
      Object.fromEntries(page.items.map((i) => [i.ideaId, i.sprint?.sprintId ?? null])),
    ).toEqual({
      i1: 'sprint-1',
      i2: 'sprint-1',
      i3: 'sprint-2',
      i4: null,
    })
  })

  it('asks for no more than one lookup when nothing on the page is in a sprint', async () => {
    const { service, sprintLookups } = harness({
      currentUser: member(ORG_A),
      ideas: [idea({ id: 'i1' }), idea({ id: 'i2' })],
    })

    await service.listByBoard(BOARD_A, LIST_QUERY)

    expect(sprintLookups.length).toBeLessThanOrEqual(1)
  })
})

describe('the sprint object on the organization list and the delivery card', () => {
  it('is on every organization list item, null where there is none', async () => {
    const { service, sprintLookups } = harness({
      currentUser: member(ORG_A),
      ideas: [idea({ id: 'in', sprintId: 'sprint-1' }), idea({ id: 'out' })],
      sprints: [sprintRow('sprint-1', BOARD_A, 'Sprint One')],
    })

    const page = await service.listByOrganization(ORG_A, ORG_LIST_QUERY)

    const byId = new Map(page.items.map((i) => [i.ideaId, i.sprint] as const))
    expect(byId.get('in')).toMatchObject({ sprintId: 'sprint-1', name: 'Sprint One' })
    expect(byId.get('out')).toBeNull()
    expect(sprintLookups).toHaveLength(1)
  })

  it('stays on the delivery card with the same shape, and null with none', async () => {
    const { service, sprintLookups } = harness({
      currentUser: member(ORG_A),
      ideas: [
        // Promotion resets the sprint, so the membership is set on the promoted item.
        { ...promotedIdea({ id: 'd1' }), sprintId: 'sprint-1' },
        promotedIdea({ id: 'd2' }),
      ],
      sprints: [sprintRow('sprint-1', null, 'Legacy sprint')],
    })

    const cards = await service.listDelivery(ORG_A, { sprintId: null, deliveryStatus: null })

    const byId = new Map(cards.map((c) => [c.ideaId, c.sprint] as const))
    expect(byId.get('d1')).toEqual({
      sprintId: 'sprint-1',
      name: 'Legacy sprint',
      startDate: '2026-10-05',
      endDate: '2026-10-18',
    })
    expect(byId.get('d2')).toBeNull()
    expect(sprintLookups).toHaveLength(1)
  })

  it('is on the single delivery card read as well', async () => {
    const { service } = harness({
      currentUser: member(ORG_A),
      ideas: [{ ...promotedIdea({ id: 'd1' }), sprintId: 'sprint-1' }],
      sprints: [sprintRow('sprint-1', null)],
    })

    expect((await service.getDelivery('d1')).sprint?.sprintId).toBe('sprint-1')
  })
})

describe('IdeaService.assignToSprint: who may put an item in a board sprint', () => {
  const assign = (currentUser: ReturnType<typeof member>) =>
    harness({
      currentUser,
      ideas: [idea()],
      sprints: [sprintRow('sprint-board', BOARD_A)],
    })

  it('lets an Org Admin do it, in any phase', async () => {
    const h = assign(orgAdmin(ORG_A))
    await h.service.assignToSprint('idea-1', { sprintId: 'sprint-board' })
    expect(h.saved[0]?.sprintId).toBe('sprint-board')
  })

  it('refuses a Member and a Read Only member, and saves nothing', async () => {
    for (const user of [member(ORG_A), readOnly(ORG_A)]) {
      const h = assign(user)
      await expect(
        h.service.assignToSprint('idea-1', { sprintId: 'sprint-board' }),
      ).rejects.toBeInstanceOf(ForbiddenError)
      expect(h.saved).toHaveLength(0)
    }
  })

  it('refuses a direct Site Admin, and saves nothing', async () => {
    const h = assign(siteAdmin())

    await expect(
      h.service.assignToSprint('idea-1', { sprintId: 'sprint-board' }),
    ).rejects.toBeInstanceOf(ForbiddenError)
    expect(h.saved).toHaveLength(0)
  })

  it('refuses a task of one board going into a sprint of another with sprintItemOnOtherBoard', async () => {
    const h = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [idea({ parentIdeaId: 'parent-1' })],
      sprints: [sprintRow('sprint-b', BOARD_B)],
    })

    await expect(
      h.service.assignToSprint('idea-1', { sprintId: 'sprint-b' }),
    ).rejects.toMatchObject({
      code: 'sprintItemOnOtherBoard',
    })
    expect(h.saved).toHaveLength(0)
  })

  it('puts a task (an item with a parent) of the same board into the sprint', async () => {
    const h = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [idea({ parentIdeaId: 'parent-1' })],
      sprints: [sprintRow('sprint-board', BOARD_A)],
    })

    await h.service.assignToSprint('idea-1', { sprintId: 'sprint-board' })

    expect(h.saved[0]).toMatchObject({ sprintId: 'sprint-board', parentIdeaId: 'parent-1' })
  })
})
