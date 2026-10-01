import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IdeaWorkspace } from '@/components/ideas/idea-workspace'
import type { Role } from '@/lib/roles'
import { reorderLanes } from '@/lib/server/board-actions'
import { SessionProvider } from '@/lib/session-client'
import type { CurrentUser, Idea, Status } from '@/lib/types'

/**
 * Reordering a board's lanes from its own page (slice 130,
 * `SPEC/20-feature-client-ui.md` "Reordering Columns"): the header's move left / move right and the
 * header drag are two inputs to one save; the order is optimistic and rolls back on a refusal; the
 * rail and arrows say a save is in flight; focus stays on the arrow just pressed; and the move is
 * announced. The server action and the router are the boundary and are replaced.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/boards/board-1',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/lib/server/idea-actions', () => ({
  deleteIdea: vi.fn(),
  saveIdea: vi.fn(),
  addComment: vi.fn(),
  toggleUpvote: vi.fn(),
  moveIdea: vi.fn(),
}))
vi.mock('@/lib/server/board-actions', () => ({ reorderLanes: vi.fn() }))

const save = vi.mocked(reorderLanes)

const LANES: Status[] = [
  { id: 'new', name: 'New', color: '#999999' },
  { id: 'review', name: 'Review', color: '#3366cc' },
  { id: 'doing', name: 'Doing', color: '#cc9933' },
  { id: 'done', name: 'Done', color: '#339966' },
]

function user(role: Role): CurrentUser {
  return {
    userId: `user-${role}`,
    displayName: role,
    initials: 'XX',
    role,
    roleLabel: role,
    organizationId: role === 'SiteAdmin' ? null : 'org-1',
    organizationName: role === 'SiteAdmin' ? null : 'Acme',
    viewingAs: null,
  }
}

function idea(id: string, statusId: string): Idea {
  return {
    id,
    boardId: 'board-1',
    statusId,
    statusName: statusId,
    title: `Idea ${id}`,
    priority: 'Medium',
    ideaType: 'Continuous Improvement',
    businessImpact: 'Medium',
    tag: null,
    tags: [],
    assigneeInitials: null,
    assignees: [],
    upvotes: 0,
    hasUpvoted: false,
    effort: null,
  }
}

function board(overrides: Partial<{ canReorder: boolean; isArchived: boolean; lanes: Status[] }>) {
  return {
    id: 'board-1',
    name: 'Assembly',
    lanes: LANES,
    isArchived: false,
    canMove: true,
    canReorder: true,
    ...overrides,
  }
}

function workspace(role: Role, b: ReturnType<typeof board>) {
  return (
    <SessionProvider user={user(role)}>
      <IdeaWorkspace
        rows={[idea('a', 'new'), idea('b', 'review')]}
        total={2}
        boards={[{ id: 'board-1', name: 'Assembly', isArchived: b.isArchived }]}
        statuses={b.lanes}
        tags={[]}
        board={b}
        drawer={{ mode: null, idea: null, formOptions: null }}
      />
    </SessionProvider>
  )
}

function renderBoard(overrides: Parameters<typeof board>[0] = {}, role: Role = 'OrgAdmin') {
  return render(workspace(role, board(overrides)))
}

/** A save the test settles by hand, so the in-flight state can be looked at. */
function deferredSave() {
  let settle: (result: { error: string | null }) => void = () => {}
  save.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        settle = resolve
      }),
  )
  return async (result: { error: string | null }) => {
    await act(async () => {
      settle(result)
    })
  }
}

/** The lanes in the order they are drawn. */
function laneOrder(): string[] {
  return screen
    .getAllByRole('region')
    .map((lane) => lane.getAttribute('aria-label') ?? '')
    .filter((name) => LANES.some((l) => l.name === name))
}

const arrow = (lane: string, dir: 'left' | 'right') =>
  screen.getByRole('button', { name: `Move the ${lane} lane ${dir}` })

async function press(button: HTMLElement) {
  button.focus()
  await act(async () => {
    fireEvent.click(button)
  })
}

function header(lane: string): HTMLElement {
  const header = within(screen.getByRole('region', { name: lane })).getByText(lane).parentElement
  if (!header) throw new Error('no header')
  return header
}

function dataTransfer() {
  return { setData: vi.fn(), effectAllowed: '' }
}

beforeEach(() => {
  save.mockReset()
  save.mockResolvedValue({ error: null })
})

describe('lane arrows', () => {
  it('post one dense order of every lane, with the pressed lane moved', async () => {
    renderBoard()
    await press(arrow('Review', 'left'))
    expect(save).toHaveBeenCalledExactlyOnceWith('board-1', ['review', 'new', 'doing', 'done'])
  })

  it('move a lane right by one place', async () => {
    renderBoard()
    await press(arrow('New', 'right'))
    expect(save).toHaveBeenCalledExactlyOnceWith('board-1', ['review', 'new', 'doing', 'done'])
  })

  it('show the new order at once, before the save answers', async () => {
    renderBoard()
    const answer = deferredSave()
    await press(arrow('Doing', 'left'))
    expect(laneOrder()).toEqual(['New', 'Doing', 'Review', 'Done'])
    await answer({ error: null })
  })

  it('put the lanes back and show the API’s message when the save is refused', async () => {
    renderBoard()
    const answer = deferredSave()
    await press(arrow('Doing', 'left'))
    await answer({ error: 'The list must name every swimlane on the board.' })
    expect(laneOrder()).toEqual(['New', 'Review', 'Doing', 'Done'])
    expect(screen.getByRole('alert').textContent).toContain(
      'The list must name every swimlane on the board.',
    )
  })

  it('clear a refusal after the next save succeeds', async () => {
    renderBoard()
    save.mockResolvedValueOnce({ error: 'Refused' })
    await press(arrow('Doing', 'left'))
    expect(screen.queryByRole('alert')).not.toBeNull()
    await press(arrow('Doing', 'left'))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('mark the rail busy and every arrow aria-disabled while the save runs', async () => {
    const { container } = renderBoard()
    const answer = deferredSave()
    await press(arrow('Review', 'right'))
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    for (const lane of LANES) {
      for (const dir of ['left', 'right'] as const) {
        expect(arrow(lane.name, dir).getAttribute('aria-disabled')).toBe('true')
      }
    }
    await answer({ error: null })
    expect(container.querySelector('[aria-busy]')).toBeNull()
    expect(arrow('Review', 'right').getAttribute('aria-disabled')).toBeNull()
  })

  it('ignore a second press while the first save is in flight', async () => {
    renderBoard()
    const answer = deferredSave()
    await press(arrow('Review', 'right'))
    await press(arrow('New', 'right'))
    expect(save).toHaveBeenCalledTimes(1)
    await answer({ error: null })
  })

  // A browser drops focus to the body when the focused node is moved in the DOM; jsdom does not.
  // Without this, no assertion about focus could fail, whatever the component did.
  function dropFocusWhenAFocusedNodeMoves() {
    for (const method of ['insertBefore', 'appendChild'] as const) {
      const original = Node.prototype[method] as (...args: unknown[]) => Node
      vi.spyOn(Node.prototype, method).mockImplementation(function (
        this: Node,
        ...args: unknown[]
      ) {
        const node = args[0] as Node
        const active = document.activeElement as HTMLElement | null
        const moving =
          node.parentNode !== null &&
          active !== null &&
          active !== document.body &&
          node.contains(active)
        const result = original.apply(this, args)
        if (moving) active?.blur()
        return result
      })
    }
  }

  it('keep focus on the arrow that was pressed after its lane moves', async () => {
    dropFocusWhenAFocusedNodeMoves()
    renderBoard()
    const answer = deferredSave()
    await press(arrow('Review', 'right'))
    expect(laneOrder()).toEqual(['New', 'Doing', 'Review', 'Done'])
    expect(document.activeElement).toBe(arrow('Review', 'right'))
    await answer({ error: null })
    expect(document.activeElement).toBe(arrow('Review', 'right'))
  })

  it('keep focus on the arrow that was pressed when its lane moves left', async () => {
    dropFocusWhenAFocusedNodeMoves()
    renderBoard()
    const answer = deferredSave()
    await press(arrow('Doing', 'left'))
    expect(document.activeElement).toBe(arrow('Doing', 'left'))
    await answer({ error: null })
    expect(document.activeElement).toBe(arrow('Doing', 'left'))
  })

  it('keep focus on the pressed arrow when the save is refused and the lanes move back', async () => {
    dropFocusWhenAFocusedNodeMoves()
    renderBoard()
    const answer = deferredSave()
    await press(arrow('Review', 'right'))
    await answer({ error: 'Refused' })
    expect(laneOrder()).toEqual(['New', 'Review', 'Doing', 'Done'])
    expect(document.activeElement).toBe(arrow('Review', 'right'))
  })

  it('stop restoring focus once the save has settled, so later focus is the reader’s own', async () => {
    dropFocusWhenAFocusedNodeMoves()
    renderBoard()
    await press(arrow('Review', 'right'))
    const elsewhere = arrow('Done', 'left')
    elsewhere.focus()
    elsewhere.blur()
    expect(document.activeElement).toBe(document.body)
    await press(arrow('Review', 'left'))
    expect(document.activeElement).toBe(arrow('Review', 'left'))
  })

  it('announce the new position politely once the save succeeds', async () => {
    renderBoard()
    const answer = deferredSave()
    await press(arrow('Doing', 'left'))
    const live = screen.getByRole('status')
    expect(live.textContent).toBe('')
    await answer({ error: null })
    expect(live.textContent).toBe('Doing moved to position 2 of 4')
  })

  it('clear the last announcement when the next move is refused', async () => {
    renderBoard()
    await press(arrow('Doing', 'left'))
    expect(screen.getByRole('status').textContent).toBe('Doing moved to position 2 of 4')
    save.mockResolvedValueOnce({ error: 'Refused' })
    await press(arrow('Review', 'right'))
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('announce nothing when the save is refused', async () => {
    renderBoard()
    save.mockResolvedValueOnce({ error: 'Refused' })
    await press(arrow('Doing', 'left'))
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('end aria-disabled on the first lane’s left and the last lane’s right, and do nothing', async () => {
    renderBoard()
    const first = arrow('New', 'left')
    const last = arrow('Done', 'right')
    expect(first.getAttribute('aria-disabled')).toBe('true')
    expect(last.getAttribute('aria-disabled')).toBe('true')
    expect(first.hasAttribute('disabled')).toBe(false)
    expect(first.getAttribute('aria-describedby')).toBeTruthy()
    expect(document.getElementById(first.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Already the first lane.',
    )
    expect(document.getElementById(last.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Already the last lane.',
    )
    await press(first)
    await press(last)
    expect(save).not.toHaveBeenCalled()
  })

  it('leave the inner arrows enabled', () => {
    renderBoard()
    expect(arrow('Review', 'left').getAttribute('aria-disabled')).toBeNull()
    expect(arrow('Doing', 'right').getAttribute('aria-disabled')).toBeNull()
  })

  it('take the saved order from the page once it revalidates', async () => {
    const { rerender } = renderBoard()
    await press(arrow('Review', 'left'))
    const [first, second, ...rest] = LANES
    rerender(workspace('OrgAdmin', board({ lanes: [second, first, ...rest] as Status[] })))
    expect(laneOrder()).toEqual(['Review', 'New', 'Doing', 'Done'])
  })
})

describe('lane drag', () => {
  async function drag(from: string, onto: string) {
    const transfer = dataTransfer()
    await act(async () => {
      fireEvent.dragStart(header(from), { dataTransfer: transfer })
    })
    await act(async () => {
      fireEvent.dragOver(screen.getByRole('region', { name: onto }), { dataTransfer: transfer })
    })
    await act(async () => {
      fireEvent.drop(screen.getByRole('region', { name: onto }), { dataTransfer: transfer })
    })
  }

  it('posts the same dense order when a lane is dropped onto another', async () => {
    renderBoard()
    await drag('New', 'Doing')
    expect(save).toHaveBeenCalledExactlyOnceWith('board-1', ['review', 'doing', 'new', 'done'])
  })

  it('moves a lane leftwards when dropped on an earlier one', async () => {
    renderBoard()
    await drag('Done', 'Review')
    expect(save).toHaveBeenCalledExactlyOnceWith('board-1', ['new', 'done', 'review', 'doing'])
  })

  it('sends nothing for a lane dropped on itself', async () => {
    renderBoard()
    await drag('Review', 'Review')
    expect(save).not.toHaveBeenCalled()
  })

  it('accepts a drop only while a lane is being dragged', async () => {
    renderBoard()
    const accepted = fireEvent.dragOver(screen.getByRole('region', { name: 'Doing' }))
    // fireEvent returns false when the handler called preventDefault, which is what accepts a drop.
    expect(accepted).toBe(true)
    await act(async () => {
      fireEvent.dragStart(header('New'), { dataTransfer: dataTransfer() })
    })
    expect(fireEvent.dragOver(screen.getByRole('region', { name: 'Doing' }))).toBe(false)
  })

  it('ignores a drop when no lane drag began, such as a card or a file', async () => {
    renderBoard()
    await act(async () => {
      fireEvent.drop(screen.getByRole('region', { name: 'Doing' }))
    })
    expect(save).not.toHaveBeenCalled()
  })

  it('stops tracking the drag when it ends without a drop', async () => {
    renderBoard()
    await act(async () => {
      fireEvent.dragStart(header('New'), { dataTransfer: dataTransfer() })
    })
    await act(async () => {
      fireEvent.dragEnd(header('New'))
    })
    await act(async () => {
      fireEvent.drop(screen.getByRole('region', { name: 'Doing' }))
    })
    expect(save).not.toHaveBeenCalled()
  })

  it('shows the dropped order at once and rolls it back on a refusal', async () => {
    renderBoard()
    const answer = deferredSave()
    await drag('New', 'Doing')
    expect(laneOrder()).toEqual(['Review', 'Doing', 'New', 'Done'])
    await answer({ error: 'Refused' })
    expect(laneOrder()).toEqual(['New', 'Review', 'Doing', 'Done'])
    expect(screen.getByRole('alert').textContent).toContain('Refused')
  })

  it('makes the header draggable when idle, and not while a save is in flight', async () => {
    renderBoard()
    expect(header('Review').getAttribute('draggable')).toBe('true')
    const answer = deferredSave()
    await press(arrow('Review', 'left'))
    expect(header('Review').getAttribute('draggable')).toBe('false')
    await answer({ error: null })
    expect(header('Review').getAttribute('draggable')).toBe('true')
  })
})

describe('who sees lane reordering', () => {
  it.each([['User'], ['ReadOnly'], ['SiteAdmin']] as const)(
    'hides the arrows, the announcement region and the drag from %s',
    (role) => {
      renderBoard({ canReorder: false }, role)
      expect(screen.queryAllByRole('button', { name: /^Move the .* lane (left|right)$/ })).toEqual(
        [],
      )
      expect(screen.queryByRole('status')).toBeNull()
      expect(header('Review').getAttribute('draggable')).not.toBe('true')
    },
  )

  it('shows the arrows to an Org Admin', () => {
    renderBoard()
    expect(screen.getAllByRole('button', { name: /^Move the .* lane (left|right)$/ })).toHaveLength(
      8,
    )
  })

  it('does not let a drop reorder a board whose admin controls are hidden', async () => {
    renderBoard({ canReorder: false }, 'User')
    await act(async () => {
      fireEvent.drop(screen.getByRole('region', { name: 'Doing' }))
    })
    expect(save).not.toHaveBeenCalled()
  })
})

describe('an archived board', () => {
  it('explains itself and keeps every arrow aria-disabled and pointing at the explanation', () => {
    renderBoard({ isArchived: true })
    const why = document.getElementById('why-reorder-lanes')
    expect(why?.textContent).toContain('archived')
    for (const lane of ['Review', 'Doing']) {
      for (const dir of ['left', 'right'] as const) {
        const button = arrow(lane, dir)
        expect(button.getAttribute('aria-disabled')).toBe('true')
        expect(button.getAttribute('aria-describedby')).toBe('why-reorder-lanes')
      }
    }
  })

  it('does not post a reorder when an arrow is pressed', async () => {
    renderBoard({ isArchived: true })
    await press(arrow('Review', 'left'))
    expect(save).not.toHaveBeenCalled()
  })

  it('does not make a header draggable', () => {
    renderBoard({ isArchived: true })
    expect(header('Review').getAttribute('draggable')).toBe('false')
  })

  it('does not show the archived note on a live board', () => {
    renderBoard()
    expect(document.getElementById('why-reorder-lanes')).toBeNull()
  })

  it('does not show the archived note to a role that cannot reorder anyway', () => {
    renderBoard({ isArchived: true, canReorder: false }, 'User')
    expect(document.getElementById('why-reorder-lanes')).toBeNull()
  })
})
