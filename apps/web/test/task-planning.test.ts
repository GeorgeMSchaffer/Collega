import { describe, expect, it } from 'vitest'
import type { OpenSprint, WorkBoard } from '@/lib/data/tasks'
import { moveToSprintState } from '@/lib/task-planning'

/**
 * "Move to sprint" availability on the Tasks page (TB-8): enabled only while the selection sits on
 * one board that has sprints on and a Planned or Active sprint, and always with a reason when not.
 */
const ON: WorkBoard = { id: 'b-1', name: 'Engineering', sprintsEnabled: true }
const OTHER: WorkBoard = { id: 'b-2', name: 'Platform', sprintsEnabled: true }
const OFF: WorkBoard = { id: 'b-3', name: 'Design', sprintsEnabled: false }
const SPRINT: OpenSprint = { id: 's-1', name: 'Sprint 1', state: 'Planned' }
const SPRINTS = {
  'b-1': [SPRINT],
  'b-2': [{ id: 's-2', name: 'Sprint 2', state: 'Active' as const }],
}

describe('moveToSprintState', () => {
  it('is enabled for a selection on one board, offering that board’s open sprints', () => {
    const state = moveToSprintState(['b-1', 'b-1', 'b-1'], [ON, OTHER], SPRINTS)
    expect(state).toEqual({
      enabled: true,
      boardId: 'b-1',
      boardName: 'Engineering',
      sprints: [SPRINT],
    })
  })

  it('is disabled with the two-board reason when the selection spans two boards', () => {
    const state = moveToSprintState(['b-1', 'b-2', 'b-1'], [ON, OTHER], SPRINTS)
    expect(state.enabled).toBe(false)
    if (state.enabled) return
    expect(state.reason).toBe(
      'Selected tasks are on 2 boards. A sprint belongs to one board, so select tasks from one board.',
    )
  })

  it('counts distinct boards, not selected tasks, in the reason', () => {
    const three = moveToSprintState(['b-1', 'b-2', 'b-3', 'b-3'], [ON, OTHER, OFF], SPRINTS)
    expect(three.enabled === false && three.reason).toMatch(/on 3 boards/)
  })

  it('is disabled with a reason when nothing is selected', () => {
    const state = moveToSprintState([], [ON], SPRINTS)
    expect(state).toEqual({ enabled: false, reason: 'Select tasks to move.' })
  })

  it('is disabled and names the board when sprints are turned off on it', () => {
    const state = moveToSprintState(['b-3'], [ON, OFF], { 'b-3': [SPRINT] })
    expect(state).toEqual({ enabled: false, reason: 'Sprints are turned off on Design.' })
  })

  it('is disabled and names the board when it has no Planned or Active sprint', () => {
    const state = moveToSprintState(['b-1'], [ON], { 'b-1': [] })
    expect(state.enabled).toBe(false)
    if (state.enabled) return
    expect(state.reason).toBe('Engineering has no Planned or Active sprint to move tasks into.')
  })

  it('treats a board with no sprint entry at all as having no open sprint', () => {
    const state = moveToSprintState(['b-1'], [ON], {})
    expect(state.enabled).toBe(false)
  })

  it('falls back to a generic name for a selected board it does not know', () => {
    const state = moveToSprintState(['gone'], [ON], SPRINTS)
    expect(state).toEqual({ enabled: false, reason: 'Sprints are turned off on this board.' })
  })
})
