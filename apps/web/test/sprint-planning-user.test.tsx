import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SprintPlanning } from '@/components/boards/sprint-planning'
import type { Sprint } from '@/lib/types'
import { backlogTask } from './support/backlog-fixtures'

/**
 * The sprint planning page for a User scheduler (TB-5, TB-10): Add and Remove appear only on the
 * tasks they wrote, and Start sprint is the Org Admin's alone.
 */
vi.mock('@/lib/server/sprint-planning-actions', () => ({
  moveTasksToSprint: vi.fn(),
  addSprintTask: vi.fn(),
  startBoardSprint: vi.fn(),
}))

const USER = { userId: 'u-me', isAdmin: false }
const ADMIN = { userId: 'u-admin', isAdmin: true }
const sprint: Sprint = {
  id: 's-9',
  name: 'Sprint 9',
  goal: null,
  startsOn: '',
  endsOn: '',
  startDate: '2026-11-02',
  endDate: '2026-11-13',
  window: '',
  state: 'Planned',
  issueCount: 0,
  doneCount: 0,
}
const BACKLOG = [
  backlogTask('1', { itemKey: 'W-1', authorUserId: 'u-me' }),
  backlogTask('2', { itemKey: 'W-2', authorUserId: 'u-ada' }),
]
const IN_SPRINT = [
  backlogTask('7', { itemKey: 'W-7', authorUserId: 'u-me' }),
  backlogTask('8', { itemKey: 'W-8', authorUserId: 'u-ada' }),
]

const planning = (scheduler = USER) =>
  render(
    <SprintPlanning
      boardId="b-1"
      organizationId="org-1"
      sprint={sprint}
      backlog={BACKLOG}
      backlogTotal={BACKLOG.length}
      inSprint={IN_SPRINT}
      lanes={[{ id: 'todo', name: 'To do', color: '#111111', isFinal: false }]}
      scheduler={scheduler}
    />,
  )
const backlogCol = () => within(screen.getByRole('region', { name: 'Backlog' }))
const sprintCol = () => within(screen.getByRole('region', { name: 'In this sprint' }))

describe('sprint planning for a User', () => {
  it('offers Add only on the Backlog tasks they wrote, and still lists the others', () => {
    planning()

    expect(backlogCol().getByRole('button', { name: 'Add W-1 to Sprint 9' })).toBeTruthy()
    expect(backlogCol().queryByRole('button', { name: 'Add W-2 to Sprint 9' })).toBeNull()
    expect(backlogCol().getAllByRole('listitem')).toHaveLength(2)
  })

  it('offers Remove only on the sprint tasks they wrote, and still lists the others', () => {
    planning()

    expect(sprintCol().getByRole('button', { name: 'Remove W-7 from Sprint 9' })).toBeTruthy()
    expect(sprintCol().queryByRole('button', { name: 'Remove W-8 from Sprint 9' })).toBeNull()
    expect(sprintCol().getAllByRole('listitem')).toHaveLength(2)
  })

  it('has no Start sprint, which is the Org Admin’s', () => {
    planning()

    expect(screen.queryByRole('button', { name: 'Start sprint' })).toBeNull()
  })

  it('gives an Org Admin Add, Remove and Start sprint on every task', () => {
    planning(ADMIN)

    expect(screen.getAllByRole('button', { name: /^Add W-/ })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /^Remove W-/ })).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Start sprint' })).toBeTruthy()
  })
})
