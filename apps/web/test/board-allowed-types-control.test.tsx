import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BoardDrawer, type BoardFormData } from '@/components/boards/board-drawer'
import { createBoardInPlace, saveBoardInPlace } from '@/lib/server/board-actions'

/**
 * The Allowed idea types checkbox group in the board drawer: present when the page supplies the
 * setup (always on create, on edit only when the caller `canSetAllowedIdeaTypes`), absent
 * otherwise, preticked from the stored list, and the refusal shown beside it. The page-level
 * gating is covered in `board-allowed-types-pages.test.tsx`.
 */
vi.mock('@/lib/server/board-actions', () => ({
  createBoardInPlace: vi.fn(),
  saveBoardInPlace: vi.fn(),
}))

const CHOICES = [
  { id: 't-idea', name: 'Idea' },
  { id: 't-ci', name: 'Continuous Improvement' },
]
const STATUSES = [
  { id: 's-new', name: 'New', color: '#111' },
  { id: 's-done', name: 'Complete', color: '#222' },
]

beforeEach(() => {
  vi.mocked(createBoardInPlace).mockReset().mockResolvedValue({ error: null, savedId: 'b-new' })
  vi.mocked(saveBoardInPlace).mockReset().mockResolvedValue({ error: null, savedId: 'b-1' })
})

function drawer(over: Partial<BoardFormData> = {}) {
  const form: BoardFormData = {
    boardId: null,
    name: 'Assembly',
    description: '',
    swimlaneIds: ['s-new', 's-done'],
    statuses: STATUSES,
    ...over,
  }
  return render(
    <BoardDrawer
      open={{ mode: form.boardId === null ? 'create' : 'edit', board: null }}
      form={form}
      isAdmin
      returnFocusTo={null}
      onClose={() => {}}
      onView={() => {}}
      onEdit={() => {}}
      onArchive={() => {}}
    />,
  )
}

const group = () => screen.queryByRole('group', { name: 'Allowed idea types' })
const box = (name: string) => screen.getByRole('checkbox', { name }) as HTMLInputElement

describe('the Allowed idea types control in the board drawer', () => {
  it('shows one unticked checkbox per idea type on create', () => {
    drawer({ allowedIdeaTypes: { choices: CHOICES, selectedIds: [] } })
    expect(group()).not.toBeNull()
    expect(box('Idea').checked).toBe(false)
    expect(box('Continuous Improvement').checked).toBe(false)
  })

  it('shows the stored list ticked on edit', () => {
    drawer({
      boardId: 'b-1',
      allowedIdeaTypes: { choices: CHOICES, selectedIds: ['t-ci'] },
    })
    expect(box('Idea').checked).toBe(false)
    expect(box('Continuous Improvement').checked).toBe(true)
  })

  it('leaves the group out when the page supplies no setup, as for a caller who may not set it', () => {
    drawer({ boardId: 'b-1' })
    expect(group()).toBeNull()
    expect(screen.queryByRole('checkbox', { name: 'Idea' })).toBeNull()
  })

  it('marks the form as having shown the control only when it is there', () => {
    const shown = drawer({ allowedIdeaTypes: { choices: CHOICES, selectedIds: [] } })
    expect(shown.container.querySelector('input[name="allowedIdeaTypesShown"]')).not.toBeNull()
    shown.unmount()
    const hidden = drawer({ boardId: 'b-1' })
    expect(hidden.container.querySelector('input[name="allowedIdeaTypesShown"]')).toBeNull()
  })

  it('submits the ticked boxes as allowedIdeaTypeIds', async () => {
    const view = drawer({ allowedIdeaTypes: { choices: CHOICES, selectedIds: ['t-idea'] } })
    const data = new FormData(view.container.querySelector('form') as HTMLFormElement)
    expect(data.getAll('allowedIdeaTypeIds')).toEqual(['t-idea'])
    expect(data.get('allowedIdeaTypesShown')).toBe('1')
  })

  it('shows a refusal keyed to the types beside the control and not in the banner', async () => {
    vi.mocked(saveBoardInPlace).mockResolvedValue({
      error: null,
      savedId: null,
      allowedIdeaTypes: "Idea type 'x' was not found.",
    })
    const view = drawer({
      boardId: 'b-1',
      allowedIdeaTypes: { choices: CHOICES, selectedIds: ['t-idea'] },
    })
    ;(view.container.querySelector('form') as HTMLFormElement).requestSubmit()
    const alert = await screen.findByText("Idea type 'x' was not found.")
    expect(group()?.contains(alert)).toBe(true)
  })
})
