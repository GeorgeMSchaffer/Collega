import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type BoardFormData, BoardDrawer } from '@/components/boards/board-drawer'
import type { PullSetup } from '@/components/settings/pull-step'
import { createBoardInPlace, saveBoardInPlace } from '@/lib/server/board-actions'
import type { PullCandidate } from '@/lib/types'

/**
 * The Boards screen's board drawer with the pull step (`20-feature-board-pull-in.md` rules 9, 11,
 * 12 and 17), the surface a User reaches (Settings is admin-only): the step's tabs by role, the
 * save button naming the pull, the 100-item cap stopping the save, what the save posts, and the
 * API's refusal shown beside the items and not duplicated in the banner. The server actions and
 * the pull-candidates route are the boundary.
 */
vi.mock('@/lib/server/board-actions', () => ({
  createBoardInPlace: vi.fn(),
  saveBoardInPlace: vi.fn(),
}))

const create = vi.mocked(createBoardInPlace)
const save = vi.mocked(saveBoardInPlace)

const STATUSES = [
  { id: 's-new', name: 'New', color: '#111' },
  { id: 's-done', name: 'Complete', color: '#222' },
]

function item(index: number): PullCandidate {
  return {
    id: `i-${index}`,
    title: `Idea ${index}`,
    authorUserId: 'u-1',
    authorName: 'Ada',
    boardId: null,
    boardName: null,
    statusId: 's-new',
    statusName: 'New',
    phase: 'Discovery',
    tags: [],
    isMine: true,
  }
}

let pool: PullCandidate[] = []

beforeEach(() => {
  pool = [item(1), item(2)]
  create.mockReset().mockResolvedValue({ error: null, savedId: 'b-new' })
  save.mockReset().mockResolvedValue({ error: null, savedId: 'b-1' })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const source = new URL(input, 'http://web.test').searchParams.get('source')
      const items = source === 'unassigned' ? pool : []
      return Response.json({ items, page: 1, pageSize: 20, totalCount: items.length })
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

const setup = (over: Partial<PullSetup> = {}): PullSetup => ({
  isAdmin: false,
  tags: [],
  members: [],
  archivedBoardIds: [],
  archived: false,
  ...over,
})

function drawer(pull: PullSetup | undefined, over: Partial<BoardFormData> = {}) {
  const form: BoardFormData = {
    boardId: null,
    name: '',
    description: '',
    userStatusMoves: true,
    swimlaneIds: ['s-new', 's-done'],
    statuses: STATUSES,
    ...(pull ? { pull } : {}),
    ...over,
  }
  return render(
    <BoardDrawer
      open={{ mode: form.boardId === null ? 'create' : 'edit', board: null }}
      form={form}
      isAdmin={pull?.isAdmin ?? false}
      returnFocusTo={null}
      onClose={() => {}}
      onView={() => {}}
      onEdit={() => {}}
      onArchive={() => {}}
    />,
  )
}

const step = () => screen.getByRole('button', { name: /Add existing items/ })
const submitButton = () => screen.getByRole('button', { name: /^Create board|^Save changes|Saving/ })

// The row's accessible name runs the title into "by Ada" with no space, so `\b` would not match.
const ideaNamed = (index: number) => new RegExp(`Idea ${index}(?!\\d)`)

async function selectFirst(count: number) {
  fireEvent.click(step())
  for (let index = 1; index <= count; index++) {
    fireEvent.click(await screen.findByRole('checkbox', { name: ideaNamed(index) }))
  }
}

describe('the board drawer pull step by role', () => {
  it('gives a User creating a board two tabs and no Backlog Issues', () => {
    drawer(setup({ isAdmin: false }))
    fireEvent.click(step())
    expect(screen.queryByRole('tab', { name: /Backlog Issues/ })).toBeNull()
    expect(screen.getByRole('tab', { name: /Unassigned ideas/ })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Ideas on other boards/ })).toBeTruthy()
  })

  it('gives an Org Admin creating a board all three tabs', () => {
    drawer(setup({ isAdmin: true }))
    fireEvent.click(step())
    expect(screen.getByRole('tab', { name: /Backlog Issues/ })).toBeTruthy()
  })

  it('gives an Org Admin editing a live board the step, with the board excluded from the lists', async () => {
    drawer(setup({ isAdmin: true }), { boardId: 'b-1', name: 'Assembly' })
    fireEvent.click(step())
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled())
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain('excludeBoardId=b-1')
  })

  it('locks the step on an archived board and says why', () => {
    drawer(setup({ isAdmin: true, archived: true }), { boardId: 'b-1', name: 'Old plant' })
    expect(step().getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText(/Archived boards take no pull/)).toBeTruthy()
  })

  it('leaves the step out when the page supplies no pull setup', () => {
    drawer(undefined)
    expect(screen.queryByRole('button', { name: /Add existing items/ })).toBeNull()
  })
})

describe('the save button and the pull', () => {
  it('names the pull in the label, singular then plural', async () => {
    drawer(setup())
    expect(submitButton().textContent).toBe('Create board')
    await selectFirst(1)
    expect(submitButton().textContent).toBe('Create board and add 1 item')
    fireEvent.click(await screen.findByRole('checkbox', { name: ideaNamed(2) }))
    expect(submitButton().textContent).toBe('Create board and add 2 items')
  })

  it('uses the edit wording on an existing board', async () => {
    drawer(setup({ isAdmin: true }), { boardId: 'b-1', name: 'Assembly' })
    await selectFirst(1)
    expect(submitButton().textContent).toBe('Save changes and add 1 item')
  })

  it('posts the chosen ids as pullItemIds with the board', async () => {
    drawer(setup(), { name: 'Assembly' })
    await selectFirst(2)
    fireEvent.click(submitButton())
    await waitFor(() => expect(create).toHaveBeenCalled())
    const posted = create.mock.calls[0]?.[1] as FormData
    expect(posted.getAll('pullItemIds')).toEqual(['i-1', 'i-2'])
    expect(posted.get('name')).toBe('Assembly')
  })

  it('posts no pullItemIds when nothing was chosen', async () => {
    drawer(setup(), { name: 'Assembly' })
    fireEvent.click(submitButton())
    await waitFor(() => expect(create).toHaveBeenCalled())
    expect((create.mock.calls[0]?.[1] as FormData).getAll('pullItemIds')).toEqual([])
  })
})

describe('the 100-item cap on save', () => {
  it('refuses to save 101 items, says so, and sends nothing; 100 is saved', async () => {
    pool = Array.from({ length: 101 }, (_, index) => item(index + 1))
    drawer(setup(), { name: 'Assembly' })
    fireEvent.click(step())
    // Plain DOM lookups: computing 101 accessible names would dominate the test.
    const boxes = () =>
      [...document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].filter(
        (box) => box.closest('[hidden]') === null && box.name === '',
      )
    await waitFor(() => expect(boxes()).toHaveLength(101))
    for (const box of boxes().slice(0, 100)) fireEvent.click(box)
    expect(screen.queryByText(/Can’t save/)).toBeNull()
    fireEvent.click(boxes()[100] as HTMLInputElement)

    const button = submitButton()
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText('Can’t save: 101 items selected, the limit is 100.')).toBeTruthy()
    fireEvent.click(button)
    await Promise.resolve()
    expect(create).not.toHaveBeenCalled()

    fireEvent.click(boxes()[100] as HTMLInputElement)
    fireEvent.click(submitButton())
    await waitFor(() => expect(create).toHaveBeenCalled())
    expect((create.mock.calls[0]?.[1] as FormData).getAll('pullItemIds')).toHaveLength(100)
  }, 30_000)
})

describe('a refused pull', () => {
  it('shows each message beside the items, keeps the typed name, and shows no banner', async () => {
    create.mockResolvedValue({
      error: null,
      savedId: null,
      pullErrors: ["'Idea 1' was moved to another board.", 'You may pull only ideas you created.'],
    })
    drawer(setup(), { name: 'Assembly' })
    await selectFirst(2)
    fireEvent.click(submitButton())

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Nothing was saved.')
    expect(alert.textContent).toContain('The board was not created.')
    expect(alert.textContent).toContain("'Idea 1' was moved to another board.")
    expect(alert.textContent).toContain('You may pull only ideas you created.')
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe('Assembly')
    expect(screen.getByText('Refused')).toBeTruthy()
  })

  it('shows the banner for a refusal that is not about the pull, and no pull alert', async () => {
    create.mockResolvedValue({ error: 'A board with that name exists.', savedId: null })
    drawer(setup(), { name: 'Assembly' })
    fireEvent.click(submitButton())
    expect(await screen.findByText('A board with that name exists.')).toBeTruthy()
    expect(screen.queryByText('Nothing was saved.')).toBeNull()
  })
})
