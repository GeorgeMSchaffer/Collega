import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IssueDrawerData } from '@/components/delivery/load-issue-drawer'
import { SprintBoard } from '@/components/delivery/sprint-board'
import type { Role } from '@/lib/roles'
import {
  completeSprint,
  createSprint,
  setDeliveryStatus,
  startSprint,
} from '@/lib/server/delivery-actions'
import { SessionProvider } from '@/lib/session-client'
import type { CurrentUser, IdeaDetail, Issue, Sprint } from '@/lib/types'
import { stubDialogMethods } from './support/dialog'

/**
 * The Sprint board and the Issue drawer (`20-feature-issues-and-delivery.md` "Sprint board (comp R)"
 * and "The Issue in the drawer"): the sprint actions by state and role, moving a card with revert,
 * the drawer's status select by role, per-Issue state in the drawer, focus back on a moved card,
 * and Add New Sprint's checks. The server actions and the router are the boundary.
 */
stubDialogMethods()

const nav = vi.hoisted(() => ({ params: new URLSearchParams(), push: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/delivery/sprint',
  useSearchParams: () => nav.params,
}))
vi.mock('@/lib/server/delivery-actions', () => ({
  setDeliveryStatus: vi.fn(),
  startSprint: vi.fn(),
  completeSprint: vi.fn(),
  createSprint: vi.fn(),
  addTask: vi.fn(),
  updateTask: vi.fn(),
  setTaskState: vi.fn(),
  reorderTasks: vi.fn(),
  deleteTask: vi.fn(),
}))
vi.mock('@/lib/server/idea-actions', () => ({
  deleteIdea: vi.fn(),
  saveIdea: vi.fn(),
  addComment: vi.fn(),
  toggleUpvote: vi.fn(),
  moveIdea: vi.fn(),
}))

beforeEach(() => {
  nav.params = new URLSearchParams()
  nav.push.mockReset()
})

function user(role: Role, userId = `user-${role}`): CurrentUser {
  return {
    userId,
    displayName: role,
    initials: 'XX',
    role,
    roleLabel: role,
    organizationId: role === 'SiteAdmin' ? null : 'org-1',
    organizationName: role === 'SiteAdmin' ? null : 'Acme',
    viewingAs: null,
  }
}

function sprint(state: Sprint['state']): Sprint {
  return {
    id: 's1',
    name: 'Sprint 7',
    goal: 'Ship the line',
    startsOn: '28 Sep',
    endsOn: '9 Oct 2026',
    startDate: '2099-09-28',
    endDate: '2099-10-09',
    window: '28 SEP – 9 OCT',
    state,
    issueCount: 2,
    doneCount: 1,
  }
}

function issue(id: string, deliveryStatusId: string, overrides: Partial<Issue> = {}): Issue {
  return {
    id,
    title: `Issue ${id}`,
    deliveryStatusId,
    sprintId: 's1',
    outcomeId: null,
    effort: 'Medium',
    assigneeInitials: null,
    upvotesAtPromotion: 2,
    boardId: 'b1',
    authorUserId: 'author',
    assignees: [],
    tags: [],
    sprint: { id: 's1', name: 'Sprint 7', window: '28 SEP – 9 OCT' },
    upvotes: 3,
    taskSummary: { done: 0, total: 0 },
    promotedOn: null,
    promotedBy: null,
    ...overrides,
  }
}

function ideaFor(item: Issue): IdeaDetail {
  return {
    id: item.id,
    boardId: 'b1',
    statusId: 'st',
    statusName: 'Approved',
    title: item.title,
    priority: 'Medium',
    ideaType: 'Continuous Improvement',
    businessImpact: 'Medium',
    tag: null,
    tags: [],
    assigneeInitials: null,
    assignees: [],
    upvotes: 3,
    hasUpvoted: false,
    effort: null,
    problem: 'A problem',
    proposedSolutions: [],
    impactRationale: 'Because',
    description: null,
    ideaTypeId: 'it',
    businessImpactId: 'bi',
    dueDate: null,
    authorUserId: item.authorUserId,
    author: null,
    createdOn: 'Sep 1, 2026',
    mentionEmails: [],
    fieldValues: [],
    formFields: [],
    comments: [],
  }
}

const drawerFor = (item: Issue): IssueDrawerData => ({
  issue: item,
  idea: ideaFor(item),
  tasks: [],
  members: [],
  boardArchived: false,
  formOptions: null,
})

type Props = Parameters<typeof SprintBoard>[0]

function board(role: Role, props: Partial<Props> = {}, userId?: string): ReactNode {
  return (
    <SessionProvider user={user(role, userId)}>
      <SprintBoard
        sprint={sprint('Active')}
        issues={[issue('a', 'Pending'), issue('b', 'Complete')]}
        backlogCount={4}
        organizationId="org-1"
        organizationName="Acme"
        adminDenial={role === 'OrgAdmin' ? null : 'Administrators only'}
        members={[]}
        drawer={null}
        editing={false}
        missing={false}
        {...props}
      />
    </SessionProvider>
  )
}

const lane = (name: string) => screen.getByRole('region', { name })
const button = (name: string) => screen.getByRole('button', { name })

describe('Sprint board header actions', () => {
  it('offers an Org Admin Complete sprint on an Active sprint, and no Start', () => {
    render(board('OrgAdmin'))
    expect(button('Complete sprint').getAttribute('aria-disabled')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Start sprint' })).toBeNull()
    expect(button('Plan next sprint')).toBeTruthy()
  })

  it('offers Start sprint in place of Complete on a Planned sprint', () => {
    render(board('OrgAdmin', { sprint: sprint('Planned') }))
    expect(button('Start sprint').getAttribute('aria-disabled')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Complete sprint' })).toBeNull()
    expect(screen.getByText('PLANNED')).toBeTruthy()
  })

  for (const role of ['User', 'ReadOnly'] as const) {
    it(`disables the sprint actions for ${role} with the reason`, () => {
      render(board(role, { sprint: sprint('Planned') }))
      expect(button('Start sprint').getAttribute('aria-disabled')).toBe('true')
      expect(button('Plan next sprint').getAttribute('aria-disabled')).toBe('true')
      expect(screen.getAllByText('Administrators only').length).toBeGreaterThan(0)
    })
  }

  it('shows the empty state with neither an Active nor a Planned sprint', () => {
    render(board('OrgAdmin', { sprint: null, issues: [] }))
    expect(screen.getByRole('heading', { name: 'No sprint is running' })).toBeTruthy()
    expect(screen.getByText(/has 4 issues in the/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Start sprint' })).toBeNull()
  })
})

describe('Complete and Start sprint', () => {
  it('asks before completing, counting the unfinished issues, then reports them', async () => {
    vi.mocked(completeSprint).mockResolvedValue({ error: null })
    render(board('OrgAdmin'))
    fireEvent.click(button('Complete sprint'))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain(
      '1 unfinished issue returns to the backlog. Completed issues stay with the sprint.',
    )
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Complete sprint' }))
    })
    expect(completeSprint).toHaveBeenCalledWith('org-1', 's1')
    expect(await screen.findByText('Sprint completed · 1 issue back in the backlog')).toBeTruthy()
  })

  it('asks before starting, naming the sprint and its issues', async () => {
    vi.mocked(startSprint).mockResolvedValue({ error: null })
    render(board('OrgAdmin', { sprint: sprint('Planned') }))
    fireEvent.click(button('Start sprint'))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('“Sprint 7” becomes the running sprint, 2 issues.')
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Start sprint' }))
    })
    expect(startSprint).toHaveBeenCalledWith('org-1', 's1')
    expect(await screen.findByText('Sprint started')).toBeTruthy()
  })

  it('shows a refusal and no toast', async () => {
    vi.mocked(startSprint).mockResolvedValue({ error: 'Another sprint is active.' })
    render(board('OrgAdmin', { sprint: sprint('Planned') }))
    fireEvent.click(button('Start sprint'))
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Start sprint' }),
      )
    })
    expect(screen.getByRole('alert').textContent).toContain('Another sprint is active.')
    expect(screen.queryByText('Sprint started')).toBeNull()
  })
})

describe('Moving a card by drag', () => {
  const drag = (title: string, to: string) => {
    const card = screen.getByRole('button', { name: title }).closest('article') as HTMLElement
    const dataTransfer = { setData: vi.fn(), effectAllowed: '' }
    fireEvent.dragStart(card, { dataTransfer })
    fireEvent.dragOver(lane(to))
    fireEvent.drop(lane(to))
  }

  it('puts the card back in its lane and says why when the API refuses', async () => {
    let answer: (value: { error: string | null }) => void = () => {}
    vi.mocked(setDeliveryStatus).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve
      }),
    )
    render(board('OrgAdmin'))
    drag('Issue a', 'Review')
    // Optimistic: the card is in the new lane while the save is in flight.
    expect(within(lane('Review')).queryByRole('button', { name: 'Issue a' })).not.toBeNull()
    await act(async () => answer({ error: 'Not allowed.' }))
    expect(within(lane('Pending')).queryByRole('button', { name: 'Issue a' })).not.toBeNull()
    expect(within(lane('Review')).queryByRole('button', { name: 'Issue a' })).toBeNull()
    expect(screen.getByRole('alert').textContent).toContain('“Issue a” was not moved: Not allowed.')
    expect(setDeliveryStatus).toHaveBeenCalledWith('a', 'Review')
  })

  it('lets a User drag their own issue and not someone else’s', () => {
    render(
      board(
        'User',
        { issues: [issue('mine', 'Pending'), issue('theirs', 'Pending', { authorUserId: 'x' })] },
        'author',
      ),
    )
    const cards = within(lane('Pending')).getAllByRole('article')
    expect(cards.map((c) => c.getAttribute('draggable'))).toEqual(['true', 'false'])
  })

  it('does not let a Read Only account drag, even its own issue', () => {
    render(board('ReadOnly', {}, 'author'))
    const card = screen.getByRole('button', { name: 'Issue a' }).closest('article')
    expect(card?.getAttribute('draggable')).toBe('false')
  })
})

describe('The Issue drawer’s status', () => {
  const statusSelect = () => screen.queryByRole('combobox', { name: 'Status' })

  const cases: [Role, string, Partial<Issue>, boolean][] = [
    ['OrgAdmin', 'anyone', {}, true],
    ['User', 'author', {}, true],
    ['User', 'helper', { assignees: [{ id: 'helper', name: 'H', initials: 'H' }] }, true],
    ['User', 'stranger', {}, false],
    ['ReadOnly', 'author', {}, false],
  ]
  for (const [role, userId, overrides, select] of cases) {
    it(`is ${select ? 'a select' : 'text'} for ${role} ${userId}`, () => {
      const item = issue('a', 'Pending', overrides)
      render(board(role, { issues: [item], drawer: drawerFor(item) }, userId))
      expect(statusSelect() !== null).toBe(select)
    })
  }

  it('moves the card through the select and shows a refusal beside it', async () => {
    vi.mocked(setDeliveryStatus).mockResolvedValue({ error: 'Not allowed.' })
    const item = issue('a', 'Pending')
    render(board('OrgAdmin', { issues: [item], drawer: drawerFor(item) }))
    await act(async () => {
      fireEvent.change(statusSelect() as HTMLElement, { target: { value: 'Review' } })
    })
    expect(setDeliveryStatus).toHaveBeenCalledWith('a', 'Review')
    expect(screen.getByRole('alert').textContent).toBe('Not allowed.')
    expect((statusSelect() as HTMLSelectElement).value).toBe('Pending')
  })
})

describe('The Issue drawer starts afresh for each Issue', () => {
  const a = issue('a', 'Pending')
  const b = issue('b', 'Review')

  it('drops the status refusal when another Issue opens', async () => {
    vi.mocked(setDeliveryStatus).mockResolvedValue({ error: 'Not allowed.' })
    const { rerender } = render(board('OrgAdmin', { issues: [a, b], drawer: drawerFor(a) }))
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: 'Status' }), {
        target: { value: 'Scoping' },
      })
    })
    expect(screen.getByText('Not allowed.')).toBeTruthy()
    rerender(board('OrgAdmin', { issues: [a, b], drawer: drawerFor(b) }))
    expect(screen.queryByText('Not allowed.')).toBeNull()
  })

  it('drops a half-typed task when another Issue opens', () => {
    const { rerender } = render(board('OrgAdmin', { issues: [a, b], drawer: drawerFor(a) }))
    fireEvent.change(screen.getByRole('textbox', { name: 'New task' }), {
      target: { value: 'Half typed' },
    })
    rerender(board('OrgAdmin', { issues: [a, b], drawer: drawerFor(b) }))
    expect((screen.getByRole('textbox', { name: 'New task' }) as HTMLInputElement).value).toBe('')
  })
})

describe('Focus after the drawer closes', () => {
  it('returns to the Issue’s card after it moved lanes', () => {
    const a = issue('a', 'Pending')
    const { rerender } = render(board('OrgAdmin', { issues: [a] }))
    const card = screen.getByRole('button', { name: 'Issue a' })
    card.focus()
    fireEvent.click(card)
    expect(nav.push).toHaveBeenCalled()

    // The page re-reads: the drawer is open and the Issue now sits in Review.
    const moved = { ...a, deliveryStatusId: 'Review' }
    rerender(board('OrgAdmin', { issues: [moved], drawer: drawerFor(moved) }))
    const newCard = within(lane('Review')).getByRole('button', { name: 'Issue a' })
    expect(newCard).not.toBe(card)

    fireEvent.keyDown(document, { key: 'Escape' })
    rerender(board('OrgAdmin', { issues: [moved], drawer: null }))
    expect(document.activeElement).toBe(newCard)
  })
})

describe('Add New Sprint', () => {
  const openForm = () => {
    render(board('OrgAdmin'))
    fireEvent.click(button('Plan next sprint'))
  }
  const field = (name: RegExp) => screen.getByLabelText(name) as HTMLInputElement
  const submit = async () => {
    await act(async () => {
      fireEvent.click(button('Create sprint'))
    })
  }

  it('requires a name, a start and an end, and sends nothing', async () => {
    openForm()
    await submit()
    expect(screen.getByText('Name is required.')).toBeTruthy()
    expect(screen.getByText('Start is required.')).toBeTruthy()
    expect(screen.getByText('End is required.')).toBeTruthy()
    expect(createSprint).not.toHaveBeenCalled()
  })

  it('treats a blank name as missing', async () => {
    openForm()
    fireEvent.change(field(/^Name/), { target: { value: '   ' } })
    await submit()
    expect(screen.getByText('Name is required.')).toBeTruthy()
  })

  it('refuses an end before the start', async () => {
    openForm()
    fireEvent.change(field(/^Name/), { target: { value: 'Sprint 8' } })
    fireEvent.change(field(/^Start/), { target: { value: '2026-10-12' } })
    fireEvent.change(field(/^End/), { target: { value: '2026-10-11' } })
    await submit()
    expect(screen.getByText('End must be on or after the start.')).toBeTruthy()
    expect(createSprint).not.toHaveBeenCalled()
  })

  it('caps the name at 100 and the goal at 500', () => {
    openForm()
    expect(field(/^Name/).maxLength).toBe(100)
    expect((screen.getByLabelText(/^Goal/) as HTMLTextAreaElement).maxLength).toBe(500)
  })

  it('accepts a one-day sprint, trims the name, closes and says so', async () => {
    vi.mocked(createSprint).mockResolvedValue({ ok: true })
    openForm()
    fireEvent.change(field(/^Name/), { target: { value: '  Sprint 8 ' } })
    fireEvent.change(field(/^Start/), { target: { value: '2026-10-12' } })
    fireEvent.change(field(/^End/), { target: { value: '2026-10-12' } })
    await submit()
    expect(createSprint).toHaveBeenCalledWith('org-1', {
      name: 'Sprint 8',
      goal: '',
      startDate: '2026-10-12',
      endDate: '2026-10-12',
      ownerUserId: '',
    })
    expect(await screen.findByText('Sprint created')).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Create sprint' })).toBeNull())
  })

  it('puts the API’s field errors beside their fields', async () => {
    vi.mocked(createSprint).mockResolvedValue({
      ok: false,
      error: null,
      errors: { name: 'A sprint with this name exists.', goal: 'Goal is too long.' },
    })
    openForm()
    fireEvent.change(field(/^Name/), { target: { value: 'Sprint 7' } })
    fireEvent.change(field(/^Start/), { target: { value: '2026-10-12' } })
    fireEvent.change(field(/^End/), { target: { value: '2026-10-20' } })
    await submit()
    expect(field(/^Name/).getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('A sprint with this name exists.')).toBeTruthy()
    expect(screen.getByText('Goal is too long.')).toBeTruthy()
  })
})
