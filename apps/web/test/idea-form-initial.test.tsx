import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { IdeaForm } from '@/components/ideas/idea-form'
import type { IdeaFormOptions } from '@/lib/types'

/** The `initial` prop the quick-add hand-off uses: what it seeds, and that absent it changes nothing. */
vi.mock('@/lib/server/idea-actions', () => ({
  boardAllowedIdeaTypeIds: async () => [],
  saveIdea: vi.fn(),
}))
vi.mock('@/lib/server/delivery-actions', () => ({ addIssue: vi.fn() }))

const OPTIONS: IdeaFormOptions = {
  ideaTypes: [{ id: 'type-ci', name: 'Continuous Improvement', fields: [] }],
  businessImpacts: [{ id: 'impact-med', name: 'Medium' }],
  members: [],
  tags: [],
}
const SPRINTS = [
  { id: 'sp-1', name: 'Sprint 14', state: 'Active' as const },
  { id: 'sp-2', name: 'Sprint 15', state: 'Planned' as const },
]

function form(props: Partial<React.ComponentProps<typeof IdeaForm>> = {}) {
  return render(
    <IdeaForm
      formId="f"
      idea={null}
      options={OPTIONS}
      boards={null}
      boardId={null}
      contentLocked={false}
      onSaved={() => {}}
      onPendingChange={() => {}}
      {...props}
    />,
  )
}

const title = () => screen.getByLabelText(/^Title/) as HTMLInputElement
const sprint = () => screen.getByLabelText(/^Sprint/) as HTMLSelectElement
const checkedEffort = () =>
  document.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.value ?? null

describe('IdeaForm initial', () => {
  it('starts with an empty title when no initial is given', () => {
    form()
    expect(title().value).toBe('')
  })

  it('starts with the given title', () => {
    form({ initial: { title: 'From the row' } })
    expect(title().value).toBe('From the row')
  })

  it('keeps the default empty title when the given title is empty', () => {
    form({ initial: { title: '' } })
    expect(title().value).toBe('')
  })

  it('applies effort and sprint when adding an Issue', () => {
    form({
      addingIssue: { sprints: SPRINTS },
      initial: { title: 'T', effort: 'Medium', sprintId: 'sp-2' },
    })
    expect(title().value).toBe('T')
    expect(checkedEffort()).toBe('Medium')
    expect(sprint().value).toBe('sp-2')
  })

  it('leaves effort unchosen and Sprint on Backlog when adding an Issue with no initial', () => {
    form({ addingIssue: { sprints: SPRINTS } })
    expect(checkedEffort()).toBeNull()
    expect(sprint().value).toBe('')
  })

  it('leaves effort unchosen when initial carries an empty effort', () => {
    form({ addingIssue: { sprints: SPRINTS }, initial: { title: 'T', effort: '', sprintId: '' } })
    expect(checkedEffort()).toBeNull()
    expect(sprint().value).toBe('')
  })

  it('shows no Sprint and an unchosen Effort on a plain idea form even when initial carries them', () => {
    form({ initial: { title: 'T', effort: 'High', sprintId: 'sp-1' } })
    expect(screen.queryByLabelText(/^Sprint/)).toBeNull()
    expect(checkedEffort()).toBeNull()
  })
})
