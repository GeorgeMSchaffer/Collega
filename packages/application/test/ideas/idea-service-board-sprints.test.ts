// Board sprints (Board References Ruling 8): an item joins a sprint of its own board in any phase;
// an item from another board is refused with 422.

import { EffortLevel, SprintState } from '@collega/domain/enums'
import { type Idea, promoteIdeaToIssue } from '@collega/domain/ideas'
import { describe, expect, it } from 'vitest'
import { ForbiddenError, UnprocessableError, ValidationError } from '../../src/common/index.js'
import { member, NOW, ORG_A, ORG_B, orgAdmin } from '../support/fixtures.js'
import { BOARD_A, BOARD_B, CREATE, harness, idea } from './idea-service-harness.js'

function boardSprint(boardId: string) {
  return {
    id: 'sprint-board',
    organizationId: ORG_A,
    name: 'Board sprint',
    startDate: '2026-09-21',
    endDate: '2026-10-04',
    state: SprintState.Planned,
    isDeleted: false,
    boardId,
  }
}

describe('IdeaService.assignToSprint on a board sprint', () => {
  it('assigns a Discovery-phase item of the same board', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [idea()],
      sprints: [boardSprint(BOARD_A)],
    })

    await service.assignToSprint('idea-1', { sprintId: 'sprint-board' })

    expect(saved[0]?.sprintId).toBe('sprint-board')
  })

  it('refuses an item from another board with sprintItemOnOtherBoard', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [idea()],
      sprints: [boardSprint(BOARD_B)],
    })

    const error = await service
      .assignToSprint('idea-1', { sprintId: 'sprint-board' })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(UnprocessableError)
    expect(error).toMatchObject({ code: 'sprintItemOnOtherBoard' })
    expect(saved).toHaveLength(0)
  })

  it('unassigns a non-Delivery item from a board sprint', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [idea({ sprintId: 'sprint-board' })],
      sprints: [boardSprint(BOARD_A)],
    })

    await service.assignToSprint('idea-1', { sprintId: null })

    expect(saved[0]?.sprintId).toBeNull()
  })
})

describe('board sprints on the legacy paths', () => {
  it('refuses promoting an idea of another board into a board sprint', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [idea()],
      sprints: [boardSprint(BOARD_B)],
    })

    const error = await service
      .promote('idea-1', { effort: 'Medium', sprintId: 'sprint-board', note: null })
      .catch((e: unknown) => e)

    expect(error).toMatchObject({ code: 'sprintItemOnOtherBoard' })
    expect(saved).toHaveLength(0)
  })

  it('refuses adding an Issue (no board) into a board sprint', async () => {
    const { boardId: _b, statusId: _s, ...pool } = CREATE as typeof CREATE & { boardId?: string }
    const { service, added } = harness({
      currentUser: orgAdmin(ORG_A),
      sprints: [boardSprint(BOARD_A)],
    })

    const error = await service
      .addIssue(ORG_A, () => ({ ...pool, effort: 'Medium', sprintId: 'sprint-board' }))
      .catch((e: unknown) => e)

    expect(error).toMatchObject({ code: 'sprintItemOnOtherBoard' })
    expect(added).toHaveLength(0)
  })
})

// QA for plan Ruling 9: membership is same-board only, whatever the phase; legacy sprints keep the
// Delivery-phase rule.
describe('IdeaService.assignToSprint: board sprint membership rules', () => {
  const legacySprint = { ...boardSprint(BOARD_A), id: 'sprint-legacy', boardId: null }
  const otherBoardSprint = { ...boardSprint(BOARD_B), id: 'sprint-b' }

  function delivered(overrides: Partial<Idea> = {}): Idea {
    return promoteIdeaToIssue(
      idea(overrides),
      { effort: EffortLevel.Medium, sprintId: null, currentUpvoteCount: 0 },
      NOW,
      'author-1',
    )
  }

  it('refuses an item with no board', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [idea({ boardId: null })],
      sprints: [boardSprint(BOARD_A)],
    })

    await expect(
      service.assignToSprint('idea-1', { sprintId: 'sprint-board' }),
    ).rejects.toMatchObject({ code: 'sprintItemOnOtherBoard' })
    expect(saved).toHaveLength(0)
  })

  it('accepts a Delivery-phase item of the same board', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [delivered()],
      sprints: [boardSprint(BOARD_A)],
    })

    await service.assignToSprint('idea-1', { sprintId: 'sprint-board' })

    expect(saved[0]?.sprintId).toBe('sprint-board')
  })

  it('refuses a Delivery-phase item of another board', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [delivered()],
      sprints: [otherBoardSprint],
    })

    await expect(service.assignToSprint('idea-1', { sprintId: 'sprint-b' })).rejects.toMatchObject({
      code: 'sprintItemOnOtherBoard',
    })
    expect(saved).toHaveLength(0)
  })

  it('moves an item between two sprints of its own board', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [idea({ sprintId: 'sprint-board' })],
      sprints: [boardSprint(BOARD_A), { ...boardSprint(BOARD_A), id: 'sprint-board-2' }],
    })

    await service.assignToSprint('idea-1', { sprintId: 'sprint-board-2' })

    expect(saved[0]?.sprintId).toBe('sprint-board-2')
  })

  it('refuses moving an item from its board sprint into a sprint of another board', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [idea({ sprintId: 'sprint-board' })],
      sprints: [boardSprint(BOARD_A), otherBoardSprint],
    })

    await expect(service.assignToSprint('idea-1', { sprintId: 'sprint-b' })).rejects.toMatchObject({
      code: 'sprintItemOnOtherBoard',
    })
    expect(saved).toHaveLength(0)
  })

  it('assigning to the sprint it is already in changes nothing', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [idea({ sprintId: 'sprint-board' })],
      sprints: [boardSprint(BOARD_A)],
    })

    await service.assignToSprint('idea-1', { sprintId: 'sprint-board' })

    expect(saved).toHaveLength(0)
  })

  it('refuses a completed board sprint and a sprint of another organization', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [idea()],
      sprints: [
        { ...boardSprint(BOARD_A), id: 'sprint-done', state: SprintState.Completed },
        { ...boardSprint(BOARD_A), id: 'sprint-foreign', organizationId: ORG_B },
      ],
    })

    await expect(
      service.assignToSprint('idea-1', { sprintId: 'sprint-done' }),
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      service.assignToSprint('idea-1', { sprintId: 'sprint-foreign' }),
    ).rejects.toBeInstanceOf(ValidationError)
    expect(saved).toHaveLength(0)
  })

  it('refuses a Member assigning into a board sprint', async () => {
    const { service, saved } = harness({
      currentUser: member(ORG_A),
      ideas: [idea()],
      sprints: [boardSprint(BOARD_A)],
    })

    await expect(
      service.assignToSprint('idea-1', { sprintId: 'sprint-board' }),
    ).rejects.toBeInstanceOf(ForbiddenError)
    expect(saved).toHaveLength(0)
  })

  it('a legacy sprint still refuses an item that is not in the Delivery phase', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [idea()],
      sprints: [legacySprint],
    })

    const error = await service
      .assignToSprint('idea-1', { sprintId: 'sprint-legacy' })
      .catch((e: unknown) => e)

    expect(error).toBeDefined()
    expect(error).not.toMatchObject({ code: 'sprintItemOnOtherBoard' })
    expect(saved).toHaveLength(0)
  })

  it('a legacy sprint takes a Delivery item whatever its board', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [delivered({ boardId: BOARD_B })],
      sprints: [legacySprint],
    })

    await service.assignToSprint('idea-1', { sprintId: 'sprint-legacy' })
    expect(saved[0]?.sprintId).toBe('sprint-legacy')
  })

  it('unassigning a Delivery item from a legacy sprint still works', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [{ ...delivered(), sprintId: 'sprint-legacy' }],
      sprints: [legacySprint],
    })

    await service.assignToSprint('idea-1', { sprintId: null })

    expect(saved[0]?.sprintId).toBeNull()
  })

  it('promote into a sprint of the idea own board is accepted', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [idea()],
      sprints: [boardSprint(BOARD_A)],
    })

    await service.promote('idea-1', { effort: 'Medium', sprintId: 'sprint-board', note: null })

    expect(saved[0]?.sprintId).toBe('sprint-board')
  })
})

describe('IdeaService.listDelivery on a board sprint', () => {
  it('reads any phase for a board sprint and Delivery only for a legacy sprint', async () => {
    const { service, deliveryFilters } = harness({
      currentUser: orgAdmin(ORG_A),
      sprints: [
        boardSprint(BOARD_A),
        { ...boardSprint(BOARD_A), id: 'sprint-legacy', boardId: null },
      ],
    })

    await service.listDelivery(ORG_A, { sprintId: 'sprint-board', deliveryStatus: null })
    await service.listDelivery(ORG_A, { sprintId: 'sprint-legacy', deliveryStatus: null })
    await service.listDelivery(ORG_A, { sprintId: null, deliveryStatus: null })

    expect(deliveryFilters.map((f) => f.anyPhase ?? false)).toEqual([true, false, false])
  })
})
