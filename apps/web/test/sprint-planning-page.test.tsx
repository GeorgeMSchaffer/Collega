import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SprintPlanningPage from '@/app/(desk)/boards/[boardId]/sprints/[sprintId]/page'
import type { Role } from '@/lib/roles'
import { actAs } from './support/acting-role'

/**
 * The planning page's route (TB-5, TB-10): 404 for a board with sprints off or a sprint that is not
 * this board's, and what an admin, a non-admin and a Completed sprint are each read for. The data
 * seam is the boundary; the planning body reports the props it was handed.
 */
const mocks = vi.hoisted(() => ({
  board: null as Record<string, unknown> | null,
  sprints: [] as { id: string; name: string; state: string }[],
  getBacklog: vi.fn(),
  getSprintTasks: vi.fn(),
  getBoardSprints: vi.fn(),
  props: vi.fn(),
}))
class NotFound extends Error {}
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new NotFound('notFound')
  },
}))
vi.mock('@/lib/server/current-user', () => ({ requireCurrentUser: async () => undefined }))
vi.mock('@/components/nav/topbar', () => ({ Topbar: () => null }))
vi.mock('@/components/boards/sprint-planning', () => ({
  SprintPlanning: (props: Record<string, unknown>) => {
    mocks.props(props)
    return <div data-testid="planning" />
  },
}))
vi.mock('@/lib/data', () => ({
  getBoard: async () => mocks.board,
  getBoardSprints: (...args: unknown[]) => mocks.getBoardSprints(...args),
  getBacklog: (...args: unknown[]) => mocks.getBacklog(...args),
  getSprintTasks: (...args: unknown[]) => mocks.getSprintTasks(...args),
}))

const open = async (role: Role = 'OrgAdmin', sprintId = 's-1') => {
  actAs(role)
  render(await SprintPlanningPage({ params: Promise.resolve({ boardId: 'b-1', sprintId }) }))
}
const handed = () => mocks.props.mock.calls.at(-1)?.[0] as Record<string, unknown>

beforeEach(() => {
  mocks.board = {
    id: 'b-1',
    name: 'Implementation',
    isArchived: false,
    sprintsEnabled: true,
    lanes: [{ id: 'l-1', name: 'To do' }],
  }
  mocks.sprints = [{ id: 's-1', name: 'Sprint 1', state: 'Planned' }]
  mocks.getBoardSprints.mockReset().mockImplementation(async () => mocks.sprints)
  mocks.getBacklog.mockReset().mockResolvedValue({ ideas: [{ id: 'k' }], totalCount: 7 })
  mocks.getSprintTasks.mockReset().mockResolvedValue({ ideas: [{ id: 't' }], totalCount: 1 })
  mocks.props.mockReset()
})

describe('sprint planning page not found', () => {
  it('404s when the board has sprints switched off, reading nothing further', async () => {
    mocks.board = { ...mocks.board, sprintsEnabled: false }
    await expect(open()).rejects.toBeInstanceOf(NotFound)
    expect(mocks.getBoardSprints).not.toHaveBeenCalled()
  })

  it('404s when the board does not exist', async () => {
    mocks.board = null
    await expect(open()).rejects.toBeInstanceOf(NotFound)
  })

  it('404s for a sprint that belongs to another board, and reads no tasks for it', async () => {
    mocks.sprints = [{ id: 's-other', name: 'Elsewhere', state: 'Planned' }]
    await expect(open('OrgAdmin', 's-1')).rejects.toBeInstanceOf(NotFound)
    expect(mocks.getBoardSprints).toHaveBeenCalledWith('b-1')
    expect(mocks.getSprintTasks).not.toHaveBeenCalled()
    expect(mocks.getBacklog).not.toHaveBeenCalled()
  })
})

describe('sprint planning page reads and gating', () => {
  it('gives an Org Admin the Backlog, the sprint’s tasks and a scheduler', async () => {
    await open('OrgAdmin')
    expect(mocks.getBacklog).toHaveBeenCalledWith('b-1')
    expect(mocks.getSprintTasks).toHaveBeenCalledWith('b-1', 's-1')
    expect(handed()).toMatchObject({
      boardId: 'b-1',
      backlog: [{ id: 'k' }],
      backlogTotal: 7,
      inSprint: [{ id: 't' }],
      scheduler: { isAdmin: true },
    })
    expect(screen.getByRole('heading', { name: 'Sprint 1' })).toBeTruthy()
  })

  it('gives a User the Backlog and the sprint’s tasks, as a non-admin scheduler', async () => {
    await open('User')
    expect(mocks.getBacklog).toHaveBeenCalledWith('b-1')
    expect(handed()).toMatchObject({ backlog: [{ id: 'k' }], scheduler: { isAdmin: false } })
    expect(handed().inSprint).toEqual([{ id: 't' }])
  })

  it.each([['ReadOnly'], ['SiteAdmin']] as const)(
    '%s gets the sprint’s tasks, no Backlog read and no scheduler',
    async (role) => {
      await open(role)
      expect(mocks.getBacklog).not.toHaveBeenCalled()
      expect(handed()).toMatchObject({ backlog: [], backlogTotal: 0, scheduler: null })
      expect(handed().inSprint).toEqual([{ id: 't' }])
    },
  )

  it('reads no Backlog for a Completed sprint even for an admin, and passes the sprint on', async () => {
    mocks.sprints = [{ id: 's-1', name: 'Sprint 1', state: 'Completed' }]
    await open('OrgAdmin')
    expect(mocks.getBacklog).not.toHaveBeenCalled()
    expect(handed()).toMatchObject({ backlog: [] })
    expect((handed().sprint as { state: string }).state).toBe('Completed')
  })

  it('does not let an admin plan on an archived board', async () => {
    mocks.board = { ...mocks.board, isArchived: true }
    await open('OrgAdmin')
    expect(handed()).toMatchObject({ scheduler: null })
    expect(mocks.getBacklog).not.toHaveBeenCalled()
  })

  it('hands the planning body the signed-in organization for Start sprint', async () => {
    await open('OrgAdmin')
    expect(handed().organizationId).toBe('acme-robotics')
  })
})
