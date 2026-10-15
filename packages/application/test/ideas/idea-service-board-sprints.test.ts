// Board sprints (Board References Ruling 8): an item joins a sprint of its own board in any phase;
// an item from another board is refused with 422.

import { SprintState } from '@collega/domain/enums'
import { describe, expect, it } from 'vitest'
import { UnprocessableError } from '../../src/common/index.js'
import { ORG_A, orgAdmin } from '../support/fixtures.js'
import { BOARD_A, BOARD_B, harness, idea } from './idea-service-harness.js'

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
