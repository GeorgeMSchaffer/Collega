import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IdeaForm } from '@/components/ideas/idea-form'
import { ApiError, apiGet } from '@/lib/api/client'
import type { IdeaDetail, IdeaFormOptions } from '@/lib/types'

/**
 * The idea form's Idea type list against the board's Allowed idea types: on create it narrows to
 * the board's ids, stays whole when the list is empty, and falls to the first allowed type when
 * the current one is not allowed. An edit keeps the idea's own type and the full list.
 * `boardAllowedIdeaTypeIds` is the boundary here; its own behaviour is asserted at the end against
 * the API client.
 */
const allowedFor = vi.hoisted(() => vi.fn())
vi.mock('@/lib/server/idea-actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/server/idea-actions')>()),
  boardAllowedIdeaTypeIds: allowedFor,
  saveIdea: vi.fn(),
}))
vi.mock('@/lib/server/delivery-actions', () => ({ addIssue: vi.fn() }))
vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  apiGet: vi.fn(),
}))

const OPTIONS: IdeaFormOptions = {
  ideaTypes: [
    { id: 't-idea', name: 'Idea', fields: [] },
    { id: 't-ci', name: 'Continuous Improvement', fields: [] },
    { id: 't-safety', name: 'Safety', fields: [] },
  ],
  businessImpacts: [{ id: 'impact-med', name: 'Medium' }],
  members: [],
  tags: [],
}
const BOARDS = [
  { id: 'b-1', name: 'Assembly', isArchived: false, hasReferenceLane: false },
  { id: 'b-2', name: 'Packing', isArchived: false, hasReferenceLane: false },
]

beforeEach(() => allowedFor.mockReset().mockResolvedValue([]))

function createForm(boardId: string | null) {
  return render(
    <IdeaForm
      formId="f"
      idea={null}
      options={OPTIONS}
      boards={BOARDS}
      boardId={boardId}
      contentLocked={false}
      onSaved={() => {}}
      onPendingChange={() => {}}
    />,
  )
}

const typeSelect = () => screen.getByLabelText(/^Idea type/) as HTMLSelectElement
const typeNames = () =>
  [...typeSelect().options].map((option) => option.textContent).filter((name) => name !== 'Choose…')

describe('the idea form type list on create', () => {
  it('narrows to the types the board takes', async () => {
    allowedFor.mockResolvedValue(['t-ci', 't-safety'])
    createForm('b-1')
    await waitFor(() => expect(typeNames()).toEqual(['Continuous Improvement', 'Safety']))
    expect(allowedFor).toHaveBeenCalledWith('b-1')
  })

  it('stays the full list when the board takes every type', async () => {
    createForm('b-1')
    await waitFor(() => expect(allowedFor).toHaveBeenCalledWith('b-1'))
    expect(typeNames()).toEqual(['Idea', 'Continuous Improvement', 'Safety'])
  })

  it('falls to the first allowed type when the current one is not allowed', async () => {
    expect(OPTIONS.ideaTypes[0]?.id).toBe('t-idea')
    allowedFor.mockResolvedValue(['t-ci', 't-safety'])
    createForm('b-1')
    await waitFor(() => expect(typeSelect().value).toBe('t-ci'))
  })

  it('keeps the current type when the board allows it', async () => {
    allowedFor.mockResolvedValue(['t-idea', 't-safety'])
    createForm('b-1')
    await waitFor(() => expect(typeNames()).toEqual(['Idea', 'Safety']))
    expect(typeSelect().value).toBe('t-idea')
  })

  it('re-asks, and widens the list again, when the board is changed to one with no limit', async () => {
    allowedFor.mockImplementation(async (id: string) => (id === 'b-1' ? ['t-safety'] : []))
    createForm('b-1')
    await waitFor(() => expect(typeNames()).toEqual(['Safety']))
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(screen.getByLabelText(/^Board/), { target: { value: 'b-2' } })
    await waitFor(() => expect(typeNames()).toEqual(['Idea', 'Continuous Improvement', 'Safety']))
  })

  it('asks for no limit with no board chosen and offers the full list', async () => {
    createForm(null)
    await waitFor(() => expect(allowedFor).toHaveBeenCalledWith(''))
    expect(typeNames()).toEqual(['Idea', 'Continuous Improvement', 'Safety'])
  })
})

describe('the idea form type list on edit', () => {
  it('keeps the idea’s type and the full list and never asks the board', async () => {
    allowedFor.mockResolvedValue(['t-safety'])
    const idea = {
      id: 'idea-1',
      boardId: 'b-1',
      title: 'Faster changeovers',
      ideaTypeId: 't-ci',
      ideaType: 'Continuous Improvement',
      businessImpactId: 'impact-med',
      problem: 'p',
      proposedSolutions: [],
      impactRationale: 'r',
      description: null,
      priority: null,
      tags: [],
      assignees: [],
      blockedBy: [],
      mentionEmails: [],
      fieldValues: [],
      formFields: [],
      effort: null,
      parentIdeaId: null,
    } as unknown as IdeaDetail
    render(
      <IdeaForm
        formId="f"
        idea={idea}
        options={OPTIONS}
        boards={null}
        boardId="b-1"
        contentLocked={false}
        onSaved={() => {}}
        onPendingChange={() => {}}
      />,
    )
    expect(typeSelect().value).toBe('t-ci')
    expect(typeNames()).toEqual(['Idea', 'Continuous Improvement', 'Safety'])
    expect(allowedFor).not.toHaveBeenCalled()
  })
})

describe('boardAllowedIdeaTypeIds', () => {
  async function real() {
    const actual = await vi.importActual<typeof import('@/lib/server/idea-actions')>(
      '@/lib/server/idea-actions',
    )
    return actual.boardAllowedIdeaTypeIds
  }
  const detail = (over: Record<string, unknown>) => ({
    ideaFeaturesEnabled: true,
    allowedIdeaTypeIds: ['t-ci'],
    ...over,
  })

  it('answers the board’s list while Idea features are on', async () => {
    vi.mocked(apiGet).mockResolvedValue(detail({}))
    expect(await (await real())('b-1')).toEqual(['t-ci'])
  })

  it('answers empty, so no limit, while Idea features are off', async () => {
    vi.mocked(apiGet).mockResolvedValue(detail({ ideaFeaturesEnabled: false }))
    expect(await (await real())('b-1')).toEqual([])
  })

  it('answers empty for no board without asking the API', async () => {
    vi.mocked(apiGet).mockClear()
    expect(await (await real())('')).toEqual([])
    expect(apiGet).not.toHaveBeenCalled()
  })

  it('answers empty when the board read is refused, leaving the save to name the problem', async () => {
    vi.mocked(apiGet).mockRejectedValue(new ApiError(404, '/boards/b-1', 'Not found'))
    expect(await (await real())('b-1')).toEqual([])
  })
})
