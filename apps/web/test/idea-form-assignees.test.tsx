import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IdeaForm } from '@/components/ideas/idea-form'
import type { IdeaDetail, IdeaFormOptions, MemberOption } from '@/lib/types'

/**
 * The idea form's Assignees field (slice 147, `20-feature-ideas-and-engagement.md` rule 12): a select
 * of the organization's active members, removable chips, at most five, an inactive person already
 * assigned stays removable and is never offered again, the field is read-only for anyone who may not
 * change the idea's content, and its refusals render beside it. The server action is the boundary.
 */
const saveIdea = vi.hoisted(() => vi.fn())
vi.mock('@/lib/server/idea-actions', () => ({
  boardAllowedIdeaTypeIds: async () => [],
  saveIdea,
}))

const MEMBERS: MemberOption[] = ['Ada', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay'].map((name) => ({
  id: `u-${name.toLowerCase()}`,
  name,
}))
const OPTIONS: IdeaFormOptions = {
  ideaTypes: [{ id: 'type-ci', name: 'Continuous Improvement', fields: [] }],
  businessImpacts: [{ id: 'impact-med', name: 'Medium' }],
  members: MEMBERS,
  tags: [],
}

function idea(assignees: MemberOption[] = []): IdeaDetail {
  return {
    id: 'idea-1',
    boardId: 'board-1',
    statusId: 'status-1',
    statusName: 'New',
    title: 'Reduce changeover time',
    priority: 'Medium',
    ideaType: 'Continuous Improvement',
    businessImpact: 'Medium',
    tag: null,
    tags: [],
    assigneeInitials: null,
    assignees: assignees.map((member) => ({
      ...member,
      initials: member.name.slice(0, 2).toUpperCase(),
    })),
    upvotes: 0,
    hasUpvoted: false,
    effort: null,
    itemKey: null,
    parentIdeaId: null,
    taskCounts: null,
    blockedBy: [],
    problem: 'Changeovers take two hours.',
    proposedSolutions: ['Pre-stage tooling'],
    impactRationale: 'Idle line.',
    description: null,
    ideaTypeId: 'type-ci',
    businessImpactId: 'impact-med',
    dueDate: null,
    authorUserId: 'author-1',
    author: null,
    createdOn: '27 Sep 2026',
    mentionEmails: [],
    fieldValues: [],
    formFields: [],
    comments: [],
    isFollowing: false,
    followerCount: 0,
    metrics: [],
  }
}

function renderForm(detail: IdeaDetail | null, contentLocked = false, members = MEMBERS) {
  const view = render(
    <IdeaForm
      formId="idea-form"
      idea={detail}
      options={{ ...OPTIONS, members }}
      boards={null}
      boardId="board-1"
      contentLocked={contentLocked}
      onSaved={() => {}}
      onPendingChange={() => {}}
    />,
  )
  return view.container.querySelector('form') as HTMLFormElement
}

const picker = () => screen.queryByLabelText('Add an assignee') as HTMLSelectElement | null
const add = (id: string) =>
  fireEvent.change(picker() as HTMLSelectElement, { target: { value: id } })
const offered = () => Array.from(picker()?.options ?? []).map((o) => o.textContent)
const chip = (name: string) => screen.queryByRole('button', { name: `Remove ${name}` })

function fillRequired() {
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Shorter changeovers' } })
  fireEvent.change(screen.getByLabelText('Problem'), { target: { value: 'Two hours each.' } })
  fireEvent.change(screen.getByLabelText('Solution 1'), { target: { value: 'Pre-stage.' } })
  fireEvent.change(screen.getByLabelText('Impact rationale'), { target: { value: 'Idle line.' } })
}

beforeEach(() => {
  saveIdea.mockReset()
  saveIdea.mockResolvedValue({ ok: true, ideaId: 'idea-1' })
})

describe('choosing assignees', () => {
  it('offers every active member and adds the chosen one as a chip', () => {
    renderForm(null)
    expect(offered()).toEqual(['Add an assignee…', ...MEMBERS.map((m) => m.name)])
    add('u-ben')
    expect(chip('Ben')).not.toBeNull()
  })

  it('stops offering a member once chosen', () => {
    renderForm(null)
    add('u-ben')
    expect(offered()).not.toContain('Ben')
  })

  it('removes an assignee with the chip’s button and offers them again', () => {
    renderForm(null)
    add('u-ben')
    fireEvent.click(chip('Ben') as HTMLElement)
    expect(chip('Ben')).toBeNull()
    expect(offered()).toContain('Ben')
  })

  it('refuses a sixth assignee: the picker disables and the hint says why', () => {
    renderForm(null)
    for (const member of MEMBERS.slice(0, 5)) add(member.id)
    expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(5)
    expect(picker()?.disabled).toBe(true)
    expect(
      screen.getByText('An idea can have at most 5 assignees. Remove one to add another.'),
    ).toBeTruthy()
  })

  it('re-enables the picker when one of five is removed', () => {
    renderForm(null)
    for (const member of MEMBERS.slice(0, 5)) add(member.id)
    fireEvent.click(chip('Cy') as HTMLElement)
    expect(picker()?.disabled).toBe(false)
  })

  it('says there is no one else to add when every member is already chosen', () => {
    renderForm(null, false, MEMBERS.slice(0, 1))
    add('u-ada')
    expect(picker()?.disabled).toBe(true)
    expect(offered()).toEqual(['No one else to add'])
  })
})

describe('an existing idea', () => {
  it('starts with its assignees as chips', () => {
    renderForm(idea([MEMBERS[0] as MemberOption, MEMBERS[2] as MemberOption]))
    expect(chip('Ada')).not.toBeNull()
    expect(chip('Cy')).not.toBeNull()
    expect(offered()).not.toContain('Ada')
  })

  it('keeps an inactive assignee as a removable chip and never offers them again', () => {
    const gone: MemberOption = { id: 'u-gone', name: 'Gus (inactive)' }
    renderForm(idea([gone]))
    expect(chip('Gus (inactive)')).not.toBeNull()
    expect(offered()).not.toContain('Gus (inactive)')
    fireEvent.click(chip('Gus (inactive)') as HTMLElement)
    expect(offered()).not.toContain('Gus (inactive)')
  })
})

describe('what is saved', () => {
  it('sends the assignee ids in the order they were added', async () => {
    const form = renderForm(null)
    fillRequired()
    add('u-cy')
    add('u-ada')
    fireEvent.submit(form)
    await waitFor(() => expect(saveIdea).toHaveBeenCalled())
    expect(saveIdea.mock.calls[0]?.[0].assigneeUserIds).toEqual(['u-cy', 'u-ada'])
  })

  it('sends an empty list when there are none', async () => {
    const form = renderForm(null)
    fillRequired()
    fireEvent.submit(form)
    await waitFor(() => expect(saveIdea).toHaveBeenCalled())
    expect(saveIdea.mock.calls[0]?.[0].assigneeUserIds).toEqual([])
  })

  it('sends the remaining list after one of two is removed', async () => {
    const form = renderForm(idea([MEMBERS[0] as MemberOption, MEMBERS[1] as MemberOption]))
    fireEvent.click(chip('Ada') as HTMLElement)
    fireEvent.submit(form)
    await waitFor(() => expect(saveIdea).toHaveBeenCalled())
    expect(saveIdea.mock.calls[0]?.[0].assigneeUserIds).toEqual(['u-ben'])
  })
})

describe('a refused save', () => {
  it('shows the assigneeUserIds message beside the field', async () => {
    saveIdea.mockResolvedValue({
      ok: false,
      error: null,
      errors: { assigneeUserIds: 'Assignee Gus is no longer active.' },
    })
    const form = renderForm(null)
    fillRequired()
    fireEvent.submit(form)
    const message = await screen.findByText('Assignee Gus is no longer active.')
    expect(message.closest('fieldset')?.textContent).toContain('Assignees (optional)')
  })
})

describe('when the content is locked', () => {
  it('shows the chips without remove buttons or a picker, and says who may change them', () => {
    renderForm(idea([MEMBERS[0] as MemberOption]), true)
    expect(screen.getByText('Ada')).toBeTruthy()
    expect(chip('Ada')).toBeNull()
    expect(picker()).toBeNull()
    const fieldset = screen.getByText('Assignees (optional)').closest('fieldset') as HTMLElement
    expect(
      within(fieldset).getByText('Only the author or an Org Admin can change this.'),
    ).toBeTruthy()
  })

  it('still sends the assignees back unchanged', async () => {
    const form = renderForm(idea([MEMBERS[0] as MemberOption]), true)
    fireEvent.submit(form)
    await waitFor(() => expect(saveIdea).toHaveBeenCalled())
    expect(saveIdea.mock.calls[0]?.[0].assigneeUserIds).toEqual(['u-ada'])
  })
})
