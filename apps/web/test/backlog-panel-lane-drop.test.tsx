import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IdeaWorkspace } from '@/components/ideas/idea-workspace'
import type { Role } from '@/lib/roles'
import { moveTasksToSprint } from '@/lib/server/sprint-planning-actions'
import { SessionProvider } from '@/lib/session-client'
import type { CurrentUser, Sprint } from '@/lib/types'
import { BACKLOG_LANES, backlogTask, sprint } from './support/backlog-fixtures'

/**
 * The board's Backlog side panel and the lane drop (TB-7, TB-10, slice 330): a drop sets the
 * Active sprint and the lane's status in one write; Add sends no status; a refusal (no Active
 * sprint, a non-admin, a blocked task) leaves the task in the backlog and makes no call; the
 * server's own refusal shows in the inline alert. The server actions and the router are the
 * boundary and are replaced.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/boards/b-1',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/lib/server/idea-actions', () => ({
  boardAllowedIdeaTypeIds: async () => [],
  deleteIdea: vi.fn(),
  saveIdea: vi.fn(),
  addComment: vi.fn(),
  toggleUpvote: vi.fn(),
  moveIdea: vi.fn(),
}))
vi.mock('@/lib/server/board-actions', () => ({ reorderLanes: vi.fn() }))
vi.mock('@/lib/server/sprint-planning-actions', () => ({
  moveTasksToSprint: vi.fn(),
  createBoardSprint: vi.fn(),
}))

const move = vi.mocked(moveTasksToSprint)

function user(role: Role): CurrentUser {
  return {
    userId: `user-${role}`,
    displayName: role,
    initials: 'XX',
    role,
    roleLabel: role,
    organizationId: 'org-1',
    organizationName: 'Acme',
    viewingAs: null,
  }
}

const ACTIVE = sprint('s-act', 'Active', 'Sprint 7')
const PLANNED = sprint('s-plan', 'Planned', 'Sprint 8')
const DONE = sprint('s-done', 'Completed', 'Sprint 6')

function renderBoard({
  role = 'OrgAdmin' as Role,
  sprints = [ACTIVE] as Sprint[],
  tasks = [backlogTask('1'), backlogTask('2')],
  withPanel = true,
} = {}) {
  render(
    <SessionProvider user={user(role)}>
      <IdeaWorkspace
        rows={[]}
        total={0}
        boards={[{ id: 'b-1', name: 'Implementation', isArchived: false, hasReferenceLane: false }]}
        statuses={BACKLOG_LANES}
        tags={[]}
        board={{
          id: 'b-1',
          name: 'Implementation',
          lanes: BACKLOG_LANES,
          isArchived: false,
          canMove: true,
          canReorder: role === 'OrgAdmin',
        }}
        drawer={{ mode: null, idea: null, formOptions: null }}
        backlog={withPanel ? { rows: tasks, total: tasks.length, sprints } : null}
      />
    </SessionProvider>,
  )
}

const openPanel = () => fireEvent.click(screen.getByRole('button', { name: /backlog \(/i }))
const panel = () => screen.getByRole('complementary', { name: 'Backlog' })
const lane = (name: string) => screen.getByRole('region', { name })
const row = (id: string) =>
  document.querySelector<HTMLElement>(`[data-row-key="${id}"]`) as HTMLElement
const transfer = () => ({ setData: vi.fn(), setDragImage: vi.fn(), effectAllowed: '' })

async function startDrag(id: string) {
  const dt = transfer()
  await act(async () => {
    fireEvent.dragStart(row(id), { dataTransfer: dt })
  })
  return dt
}

async function dragTask(id: string, onto: string) {
  const dt = await startDrag(id)
  await act(async () => {
    fireEvent.dragOver(lane(onto), { dataTransfer: dt })
  })
  await act(async () => {
    fireEvent.drop(lane(onto), { dataTransfer: dt })
  })
}

beforeEach(() => {
  move.mockReset()
  move.mockResolvedValue({ error: null })
})

describe('the Backlog panel toggle', () => {
  it('is closed at first, shows the count, and opens and closes the panel', () => {
    renderBoard()
    expect(screen.queryByRole('complementary', { name: 'Backlog' })).toBeNull()
    openPanel()
    expect(within(panel()).getByText('Task 1')).toBeTruthy()
    const toggle = screen.getByRole('button', { name: /hide backlog \(2\)/i })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(within(panel()).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('complementary', { name: 'Backlog' })).toBeNull()
  })

  it('is absent when the page hands over no panel', () => {
    renderBoard({ withPanel: false })
    expect(screen.queryByRole('button', { name: /backlog/i })).toBeNull()
  })
})

describe('dropping a backlog task on a lane', () => {
  it('sets the Active sprint and the lane status in exactly one write', async () => {
    renderBoard({ sprints: [PLANNED, ACTIVE] })
    openPanel()
    await dragTask('1', 'Doing')
    expect(move).toHaveBeenCalledExactlyOnceWith('b-1', 's-act', ['1'], 'doing')
  })

  it('moves nothing on screen itself: the task stays in the panel while the write is pending', async () => {
    renderBoard()
    openPanel()
    let settle: (result: { error: string | null }) => void = () => {}
    move.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settle = resolve
        }),
    )
    await dragTask('1', 'Doing')
    expect(within(lane('Doing')).queryByText('Task 1')).toBeNull()
    expect(within(panel()).getByText('Task 1')).toBeTruthy()
    await act(async () => settle({ error: null }))
    // The refreshed page, not the client, moves the card.
    expect(within(lane('Doing')).queryByText('Task 1')).toBeNull()
  })

  it('shows the server refusal (taskBlocked) in the inline alert and keeps the task listed', async () => {
    renderBoard()
    openPanel()
    move.mockResolvedValueOnce({ error: 'Blocked by W-9.' })
    await dragTask('1', 'Doing')
    expect(screen.getByRole('alert').textContent).toContain('Blocked by W-9.')
    expect(within(panel()).getByText('Task 1')).toBeTruthy()
  })

  it('clears a previous refusal when the next drop is tried', async () => {
    renderBoard()
    openPanel()
    move.mockResolvedValueOnce({ error: 'Blocked by W-9.' })
    await dragTask('1', 'Doing')
    await dragTask('2', 'Doing')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('refuses with the reason, offers no drop and calls nothing when no sprint is Active', async () => {
    renderBoard({ sprints: [PLANNED, DONE] })
    openPanel()
    const dt = await startDrag('1')
    let notCancelled = true
    await act(async () => {
      notCancelled = fireEvent.dragOver(lane('Doing'), { dataTransfer: dt })
    })
    expect(notCancelled).toBe(true) // preventDefault not called: no drop is offered
    expect(within(lane('Doing')).getByRole('tooltip').textContent).toBe('No active sprint.')
    await act(async () => {
      fireEvent.drop(lane('Doing'), { dataTransfer: dt })
    })
    expect(move).not.toHaveBeenCalled()
    expect(within(panel()).getByText('Task 1')).toBeTruthy()
  })

  it('refuses a task blocked in the first lane, naming the blocker, and calls nothing', async () => {
    const blocked = backlogTask('1', {
      blockedBy: [{ ideaId: 'x', itemKey: 'W-9', isFinal: false }],
    })
    renderBoard({ tasks: [blocked, backlogTask('2')] })
    openPanel()
    const dt = await startDrag('1')
    await act(async () => {
      fireEvent.dragOver(lane('Doing'), { dataTransfer: dt })
    })
    expect(within(lane('Doing')).getByRole('tooltip').textContent).toBe('Blocked by W-9')
    await act(async () => {
      fireEvent.drop(lane('Doing'), { dataTransfer: dt })
    })
    expect(move).not.toHaveBeenCalled()
    expect(within(panel()).getByText('Task 1')).toBeTruthy()
  })

  it('lets a blocked task drop on the first lane, which is not leaving it', async () => {
    const blocked = backlogTask('1', {
      blockedBy: [{ ideaId: 'x', itemKey: 'W-9', isFinal: false }],
    })
    renderBoard({ tasks: [blocked] })
    openPanel()
    await dragTask('1', 'To do')
    expect(move).toHaveBeenCalledExactlyOnceWith('b-1', 's-act', ['1'], 'todo')
  })

  it('shows a User the panel and drag handles, but the lane refuses a task they did not author, with the reason and no call', async () => {
    renderBoard({ role: 'User' })
    openPanel()
    expect(row('1').getAttribute('draggable')).toBe('true')
    const dt = await startDrag('1')
    await act(async () => {
      fireEvent.dragOver(lane('Doing'), { dataTransfer: dt })
    })
    expect(within(lane('Doing')).getByRole('tooltip').textContent).toBe(
      'Only the task’s author or an Org Admin can put it in a sprint.',
    )
    await act(async () => {
      fireEvent.drop(lane('Doing'), { dataTransfer: dt })
    })
    expect(move).not.toHaveBeenCalled()
  })

  it('lets a User drop a task they authored', async () => {
    renderBoard({ role: 'User', tasks: [backlogTask('1', { authorUserId: 'user-User' })] })
    openPanel()
    await dragTask('1', 'To do')
    expect(move).toHaveBeenCalledExactlyOnceWith('b-1', 's-act', ['1'], 'todo')
  })

  it('removes the refusal tooltip once the drag ends', async () => {
    renderBoard({ sprints: [] })
    openPanel()
    await dragTask('1', 'Doing')
    await act(async () => {
      fireEvent.dragEnd(row('1'))
    })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})

describe('Add in the panel', () => {
  it('sends the sprint and no status, to the Active sprint', async () => {
    renderBoard({ sprints: [PLANNED, ACTIVE] })
    openPanel()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add W-2 to Sprint 7' }))
    })
    expect(move).toHaveBeenCalledExactlyOnceWith('b-1', 's-act', ['2'])
  })

  it('sends it to the sprint picked when more than one is open', async () => {
    renderBoard({ sprints: [ACTIVE, PLANNED, DONE] })
    openPanel()
    const select = screen.getByRole('combobox', { name: 'Sprint to add to' })
    expect(within(select).queryByText(/Sprint 6/)).toBeNull() // a Completed sprint is not offered
    fireEvent.change(select, { target: { value: 's-plan' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add W-1 to Sprint 8' }))
    })
    expect(move).toHaveBeenCalledExactlyOnceWith('b-1', 's-plan', ['1'])
  })

  it('works with no Active sprint, onto the open one', async () => {
    renderBoard({ sprints: [PLANNED] })
    openPanel()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add W-1 to Sprint 8' }))
    })
    expect(move).toHaveBeenCalledExactlyOnceWith('b-1', 's-plan', ['1'])
  })

  it('shows a server refusal in an alert and keeps the task listed', async () => {
    renderBoard()
    openPanel()
    move.mockResolvedValueOnce({ error: 'Blocked by W-9.' })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add W-1 to Sprint 7' }))
    })
    expect(within(panel()).getByRole('alert').textContent).toBe('Blocked by W-9.')
    expect(row('1')).toBeTruthy()
  })

  it('is not offered on a task a User did not author', () => {
    renderBoard({ role: 'User' })
    openPanel()
    expect(screen.queryByRole('button', { name: /^Add W-/ })).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'Sprint to add to' })).toBeNull()
  })

  it('is not offered when no sprint is open', () => {
    renderBoard({ sprints: [DONE] })
    openPanel()
    expect(screen.queryByRole('button', { name: /^Add W-/ })).toBeNull()
  })
})
