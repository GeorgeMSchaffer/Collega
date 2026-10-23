import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IdeaCard, PLAIN_CARD } from '@/components/ideas/idea-card'
import { IdeaWorkspace } from '@/components/ideas/idea-workspace'
import type { Role } from '@/lib/roles'
import { moveIdea } from '@/lib/server/idea-actions'
import { SessionProvider } from '@/lib/session-client'
import type { CurrentUser, Idea, Status } from '@/lib/types'

/**
 * Moving a card between lanes: by dragging the card (slice 142; the whole card since 2026-10-22) and by pressing ← → on its focused
 * title (slice 146). Both go through the same optimistic `moveCard` and the same `moveIdea`
 * action, so one rule decides what a move may do. The server action and the router are the
 * boundary and are replaced.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/boards/board-1',
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

const move = vi.mocked(moveIdea)

const LANES: Status[] = [
  { id: 'new', name: 'New', color: '#999999' },
  { id: 'review', name: 'Review', color: '#3366cc' },
  { id: 'done', name: 'Done', color: '#339966' },
]

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

function idea(id: string, statusId: string): Idea {
  return {
    id,
    boardId: 'board-1',
    authorUserId: null,
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
    itemKey: null,
    parentIdeaId: null,
    taskCounts: null,
    blockedBy: [],
  }
}

function renderBoard({ canMove = true, role = 'OrgAdmin' as Role } = {}) {
  return render(
    <SessionProvider user={user(role)}>
      <IdeaWorkspace
        rows={[idea('a', 'new'), idea('b', 'review'), idea('c', 'done')]}
        total={3}
        boards={[
          { id: 'board-1', name: 'Assembly', isArchived: !canMove, hasReferenceLane: false },
        ]}
        statuses={LANES}
        tags={[]}
        board={{
          id: 'board-1',
          name: 'Assembly',
          lanes: LANES,
          isArchived: !canMove,
          canMove,
          canReorder: false,
        }}
        drawer={{ mode: null, idea: null, formOptions: null }}
      />
    </SessionProvider>,
  )
}

const lane = (name: string) => screen.getByRole('region', { name })
const title = (id: string) => document.querySelector<HTMLButtonElement>(`[data-idea-title="${id}"]`)
const laneOf = (id: string) => {
  const node = title(id)
  return LANES.find((l) => within(lane(l.name)).queryByText(`Idea ${id}`) === node)?.name ?? null
}
const card = (id: string) => title(id)?.closest<HTMLElement>('[data-idea-card]') ?? null

function dataTransfer() {
  return { setData: vi.fn(), setDragImage: vi.fn(), effectAllowed: '' }
}

async function drag(id: string, ontoLane: string) {
  const transfer = dataTransfer()
  const node = card(id)
  if (!node) throw new Error('no card')
  await act(async () => {
    fireEvent.dragStart(node, { dataTransfer: transfer })
  })
  await act(async () => {
    fireEvent.dragOver(lane(ontoLane), { dataTransfer: transfer })
  })
  await act(async () => {
    fireEvent.drop(lane(ontoLane), { dataTransfer: transfer })
  })
}

function deferredMove() {
  let settle: (result: { error: string | null }) => void = () => {}
  move.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        settle = resolve
      }),
  )
  return (result: { error: string | null }) =>
    act(async () => {
      settle(result)
    })
}

function posted(call = 0) {
  const form = move.mock.calls[call]?.[1] as FormData
  return {
    boardId: form.get('boardId'),
    ideaId: form.get('ideaId'),
    statusId: form.get('statusId'),
  }
}

async function key(id: string, name: string, init: Record<string, unknown> = {}) {
  const button = title(id)
  if (!button) throw new Error('no title')
  button.focus()
  await act(async () => {
    fireEvent.keyDown(button, { key: name, ...init })
  })
}

beforeEach(() => {
  move.mockReset()
  move.mockResolvedValue({ error: null })
})

describe('dragging a card between lanes', () => {
  it('moves the card with one status change through the move action', async () => {
    renderBoard()
    await drag('a', 'Review')
    expect(move).toHaveBeenCalledTimes(1)
    expect(posted()).toEqual({ boardId: 'board-1', ideaId: 'a', statusId: 'review' })
  })

  it('shows the card in the new lane at once, before the save answers', async () => {
    renderBoard()
    const answer = deferredMove()
    await drag('a', 'Done')
    expect(laneOf('a')).toBe('Done')
    await answer({ error: null })
  })

  it('puts the card back and shows the API message when the move is refused', async () => {
    renderBoard()
    const answer = deferredMove()
    await drag('a', 'Done')
    await answer({ error: 'That status is not on this board.' })
    expect(laneOf('a')).toBe('New')
    expect(screen.getByRole('alert').textContent).toContain('That status is not on this board.')
  })

  it('does not offer, and does not save, a drop on the card’s own lane', async () => {
    renderBoard()
    const transfer = dataTransfer()
    await act(async () => {
      fireEvent.dragStart(card('a') as HTMLElement, { dataTransfer: transfer })
    })
    let notCancelled = false
    await act(async () => {
      notCancelled = fireEvent.dragOver(lane('New'), { dataTransfer: transfer })
    })
    expect(notCancelled).toBe(true) // preventDefault not called: no drop is offered
    await act(async () => {
      fireEvent.drop(lane('New'), { dataTransfer: transfer })
    })
    expect(move).not.toHaveBeenCalled()
  })

  it('offers a drop on another lane', async () => {
    renderBoard()
    const transfer = dataTransfer()
    await act(async () => {
      fireEvent.dragStart(card('a') as HTMLElement, { dataTransfer: transfer })
    })
    let notCancelled = true
    await act(async () => {
      notCancelled = fireEvent.dragOver(lane('Review'), { dataTransfer: transfer })
    })
    expect(notCancelled).toBe(false) // preventDefault was called: the lane accepts the drop
  })

  it('makes the whole card draggable, carrying the card as the drag image', async () => {
    renderBoard()
    const node = card('a') as HTMLElement
    expect(node.getAttribute('draggable')).toBe('true')
    const transfer = dataTransfer()
    await act(async () => {
      fireEvent.dragStart(node, { dataTransfer: transfer })
    })
    expect(transfer.setDragImage).toHaveBeenCalledWith(node, 16, 16)
    expect(transfer.setData).toHaveBeenCalledWith('application/x-collega-idea', 'a')
  })

  it('does not make a card draggable where the role may not move cards', () => {
    renderBoard({ canMove: false })
    expect(card('a')?.getAttribute('draggable')).toBe('false')
  })

  it('clears a refusal once the next move succeeds', async () => {
    renderBoard()
    move.mockResolvedValueOnce({ error: 'Refused' })
    await drag('a', 'Done')
    expect(screen.queryByRole('alert')).not.toBeNull()
    await drag('b', 'Done')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('moving a focused card with the arrow keys', () => {
  it('moves the card one lane right on →, posting the neighbouring status', async () => {
    renderBoard()
    await key('a', 'ArrowRight')
    expect(move).toHaveBeenCalledTimes(1)
    expect(posted()).toEqual({ boardId: 'board-1', ideaId: 'a', statusId: 'review' })
  })

  it('moves the card one lane left on ←', async () => {
    renderBoard()
    await key('b', 'ArrowLeft')
    expect(posted()).toEqual({ boardId: 'board-1', ideaId: 'b', statusId: 'new' })
  })

  it('does nothing at the first lane on ←', async () => {
    renderBoard()
    await key('a', 'ArrowLeft')
    expect(move).not.toHaveBeenCalled()
  })

  it('does nothing at the last lane on →', async () => {
    renderBoard()
    await key('c', 'ArrowRight')
    expect(move).not.toHaveBeenCalled()
  })

  it('keeps focus on the card’s title in its new lane', async () => {
    renderBoard()
    const answer = deferredMove()
    await key('a', 'ArrowRight')
    expect(laneOf('a')).toBe('Review')
    expect(document.activeElement).toBe(title('a'))
    await answer({ error: null })
  })

  it('announces the move politely once the save succeeds', async () => {
    const { container } = renderBoard()
    await key('a', 'ArrowRight')
    const live = container.querySelector('[aria-live="polite"]')
    expect(live?.textContent).toBe('Idea a moved to Review')
  })

  it('puts the card back and shows the API message when the move is refused', async () => {
    renderBoard()
    const answer = deferredMove()
    await key('a', 'ArrowRight')
    expect(laneOf('a')).toBe('Review')
    await answer({ error: 'Cannot move an idea on an archived board.' })
    expect(laneOf('a')).toBe('New')
    expect(screen.getByRole('alert').textContent).toContain('archived board')
  })

  it('moves a card on from its optimistic lane when pressed again before the save settles', async () => {
    renderBoard()
    const answer = deferredMove()
    await key('a', 'ArrowRight')
    await key('a', 'ArrowRight')
    expect(posted(1).statusId).toBe('done')
    await answer({ error: null })
  })

  it('ignores auto-repeat so one press is one move', async () => {
    renderBoard()
    await key('a', 'ArrowRight', { repeat: true })
    expect(move).not.toHaveBeenCalled()
  })

  it.each(['shiftKey', 'ctrlKey', 'altKey', 'metaKey'])(
    'ignores the arrow with %s held',
    async (modifier) => {
      renderBoard()
      await key('a', 'ArrowRight', { [modifier]: true })
      expect(move).not.toHaveBeenCalled()
    },
  )

  it('ignores other keys', async () => {
    renderBoard()
    await key('a', 'ArrowDown')
    expect(move).not.toHaveBeenCalled()
  })

  it('does not move cards on a board the role cannot move cards on', async () => {
    renderBoard({ canMove: false })
    await key('a', 'ArrowRight')
    expect(move).not.toHaveBeenCalled()
  })
})

describe('a draggable card', () => {
  function renderCard(work = PLAIN_CARD, onOpen = vi.fn()) {
    render(
      <SessionProvider user={user('OrgAdmin')}>
        <IdeaCard
          idea={idea('a', 'new')}
          boardId="board-1"
          previousStatusId={null}
          nextStatusId="review"
          canMove
          upvoteDenial={null}
          work={work}
          selected={false}
          onOpen={onOpen}
        />
      </SessionProvider>,
    )
    return onOpen
  }

  it('still opens on a click of its title', () => {
    const onOpen = renderCard()
    fireEvent.click(title('a') as HTMLButtonElement)
    expect(onOpen).toHaveBeenCalledWith(title('a'))
  })

  it('does not drag while the reference lock holds it, and the lock says why', () => {
    renderCard({ ...PLAIN_CARD, lockText: 'Waiting on 2 open tasks' })
    expect(card('a')?.getAttribute('draggable')).toBe('false')
    expect(screen.getByRole('img', { name: 'Waiting on 2 open tasks' })).not.toBeNull()
  })

  it('does not drag while a blocker holds it', () => {
    renderCard({ ...PLAIN_CARD, blockedText: 'Blocked', blockedTip: 'Blocked by IDEA-2' })
    expect(card('a')?.getAttribute('draggable')).toBe('false')
    expect(screen.getByRole('img', { name: 'Blocked by IDEA-2' })).not.toBeNull()
  })
})
