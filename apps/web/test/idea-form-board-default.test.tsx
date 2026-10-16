import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { IdeaForm } from '@/components/ideas/idea-form'
import type { IdeaFormOptions } from '@/lib/types'

/**
 * The idea form's Board field (`20-feature-board-pull-in.md` rules 4 and 7): a select with a
 * *No board* choice, preselected from a board's page and empty from the Ideas list; archived boards
 * are not offered; an edit has no field at all.
 */
vi.mock('@/lib/server/idea-actions', () => ({ saveIdea: vi.fn() }))
vi.mock('@/lib/server/delivery-actions', () => ({ addIssue: vi.fn() }))

const OPTIONS: IdeaFormOptions = {
  ideaTypes: [{ id: 'type-ci', name: 'Continuous Improvement', fields: [] }],
  businessImpacts: [{ id: 'impact-med', name: 'Medium' }],
  members: [],
  tags: [],
}
const BOARDS = [
  { id: 'b-1', name: 'Assembly', isArchived: false },
  { id: 'b-2', name: 'Packing', isArchived: false },
  { id: 'b-old', name: 'Old plant', isArchived: true },
]

function form(props: Partial<React.ComponentProps<typeof IdeaForm>> = {}) {
  return render(
    <IdeaForm
      formId="f"
      idea={null}
      options={OPTIONS}
      boards={BOARDS}
      boardId={null}
      contentLocked={false}
      onSaved={() => {}}
      onPendingChange={() => {}}
      {...props}
    />,
  )
}

const board = () => screen.getByLabelText(/^Board/) as HTMLSelectElement
const optionNames = () => [...board().options].map((option) => option.textContent)

describe('IdeaForm Board field', () => {
  it('starts on No board when opened from the Ideas list', () => {
    form({ boardId: null })
    expect(board().value).toBe('')
    expect(board().selectedOptions[0]?.textContent).toBe('No board')
  })

  it('starts on the board when opened from that board', () => {
    form({ boardId: 'b-2' })
    expect(board().value).toBe('b-2')
    expect(board().selectedOptions[0]?.textContent).toBe('Packing')
  })

  it('lists No board first and leaves archived boards out', () => {
    form()
    expect(optionNames()).toEqual(['No board', 'Assembly', 'Packing'])
  })

  it('explains where an idea with no board waits, only while No board is chosen', () => {
    const { unmount } = form({ boardId: null })
    expect(screen.getByText(/Ideas with no board wait on the Ideas list/)).toBeTruthy()
    unmount()
    form({ boardId: 'b-1' })
    expect(screen.queryByText(/Ideas with no board wait on the Ideas list/)).toBeNull()
  })

  it('falls back to No board when the preselected board is archived and so not offered', () => {
    form({ boardId: 'b-old' })
    expect(optionNames()).not.toContain('Old plant')
    expect(board().selectedOptions[0]?.textContent).toBe('No board')
  })

  it('offers no Board field when editing', () => {
    form({ boards: null })
    expect(screen.queryByLabelText(/^Board/)).toBeNull()
  })
})
