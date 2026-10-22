import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TasksPage from '@/app/(desk)/tasks/page'
import type { Role } from '@/lib/roles'
import { actAs } from './support/acting-role'

/**
 * The /tasks page (TB-8, TB-10): which tab it opens on, what each tab asks for, who gets planning
 * controls, and the states for a direct Site Admin and an organization with no work board.
 */
const mocks = vi.hoisted(() => ({
  boards: [] as { id: string; name: string; sprintsEnabled: boolean }[],
  getTasks: vi.fn(),
  tableProps: vi.fn(),
}))

vi.mock('next/navigation', () => ({ notFound: vi.fn(), usePathname: () => '/tasks' }))
vi.mock('@/lib/server/current-user', async () => {
  const { currentUser } = await import('@/lib/session')
  return { requireCurrentUser: async () => currentUser() }
})
vi.mock('@/components/nav/topbar', () => ({ Topbar: () => null }))
vi.mock('@/components/tasks/tasks-table', () => ({
  TasksTable: (props: Record<string, unknown>) => {
    mocks.tableProps(props)
    return <div data-testid="tasks-table" />
  },
}))
vi.mock('@/lib/data', () => ({
  getWorkBoards: async () => mocks.boards,
  getOpenSprintsByBoard: async () => ({}),
  getTasks: (...args: unknown[]) => mocks.getTasks(...args),
}))

async function open(role: Role, query: Record<string, string> = {}) {
  actAs(role)
  render(await TasksPage({ searchParams: Promise.resolve(query) }))
}
const tabOn = () =>
  screen
    .getAllByRole('link')
    .find((link) => link.getAttribute('aria-current') === 'page')
    ?.textContent?.replace(/\d+$/, '')

beforeEach(() => {
  mocks.boards = [{ id: 'b-1', name: 'Engineering', sprintsEnabled: true }]
  mocks.getTasks.mockReset()
  mocks.tableProps.mockReset()
  mocks.getTasks.mockResolvedValue({ ideas: [], page: 1, pageSize: 100, totalCount: 5 })
})

describe('the Tasks page', () => {
  it('opens on the Backlog and asks for it', async () => {
    await open('OrgAdmin')
    expect(tabOn()).toBe('Backlog')
    expect(mocks.getTasks.mock.calls[0]?.[0]).toBe('backlog')
  })

  it.each([
    ['mine', 'My tasks'],
    ['sprint', 'In sprint'],
    ['all', 'All'],
  ])('opens ?tab=%s on %s and asks for that tab', async (tab, label) => {
    await open('OrgAdmin', { tab })
    expect(tabOn()).toBe(label)
    expect(mocks.getTasks.mock.calls[0]?.[0]).toBe(tab)
  })

  it('falls back to the Backlog for an unknown tab', async () => {
    await open('OrgAdmin', { tab: 'bogus' })
    expect(tabOn()).toBe('Backlog')
  })

  it('shows the Backlog count on another tab by asking for the count alone', async () => {
    await open('OrgAdmin', { tab: 'all' })
    const countCall = mocks.getTasks.mock.calls.find((call) => call[0] === 'backlog')
    expect(countCall?.[3]).toBe(1)
    expect(screen.getByRole('link', { name: /^Backlog\s*5$/ })).toBeTruthy()
  })

  it('offers planning to an Org Admin only', async () => {
    await open('OrgAdmin')
    expect(mocks.tableProps.mock.calls[0]?.[0].canPlan).toBe(true)
  })

  it.each(['User', 'ReadOnly'] as const)('hands %s the list without planning', async (role) => {
    await open(role)
    expect(mocks.tableProps.mock.calls[0]?.[0].canPlan).toBe(false)
    expect(screen.getByText(/Only administrators plan sprints/)).toBeTruthy()
  })

  it('explains that there are no work boards instead of an empty table', async () => {
    mocks.boards = []
    await open('OrgAdmin')
    expect(screen.getByText('No work boards yet')).toBeTruthy()
    expect(screen.queryByTestId('tasks-table')).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Task views' })).toBeNull()
  })

  it('tells a Site Admin acting directly that tasks belong to an organization, and reads nothing', async () => {
    await open('SiteAdmin')
    expect(screen.getByText('Tasks belong to an organization')).toBeTruthy()
    expect(screen.getByText(/View As/)).toBeTruthy()
    expect(screen.queryByTestId('tasks-table')).toBeNull()
    expect(mocks.getTasks).not.toHaveBeenCalled()
  })
})
