import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiPostReturning } from '@/lib/api/client'
import { actingOrganizationId } from '@/lib/server/current-user'
import { addIssue, type IssueInput } from '@/lib/server/delivery-actions'

/**
 * `addIssue` posts the idea form to `POST /organizations/{id}/issues`: what it sends, what it hands
 * back for a refusal, and where a 401 goes. The HTTP client and the cache are the boundaries.
 */
vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  apiPostReturning: vi.fn(),
}))
vi.mock('@/lib/server/current-user', () => ({ actingOrganizationId: vi.fn() }))
const revalidatePath = vi.hoisted(() => vi.fn())
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`)
  },
}))

const post = vi.mocked(apiPostReturning)

const INPUT: IssueInput = {
  title: 'Fix the dock door',
  problem: 'It jams.',
  proposedSolutions: ['Replace the track'],
  impactRationale: 'Two hours a week.',
  description: '',
  priority: 'High',
  ideaTypeId: 'type-1',
  businessImpactId: 'impact-1',
  dueDate: '',
  tagNames: ['dock'],
  assigneeUserIds: ['user-2'],
  mentionEmails: ['a@example.com'],
  fieldValues: [{ fieldDefinitionId: 'f-1', value: 'x' }],
  effort: 'Medium',
  sprintId: '',
}

beforeEach(() => {
  post.mockReset()
  revalidatePath.mockReset()
  post.mockResolvedValue({ ideaId: 'idea-9' } as never)
  vi.mocked(actingOrganizationId).mockResolvedValue('org-1')
})

describe('addIssue request', () => {
  it('posts to the acting organization’s issues route with the form mapped to the body', async () => {
    await addIssue(INPUT)

    expect(post).toHaveBeenCalledExactlyOnceWith('/organizations/org-1/issues', {
      title: 'Fix the dock door',
      problem: 'It jams.',
      proposedSolutions: ['Replace the track'],
      impactRationale: 'Two hours a week.',
      description: '',
      priority: 'High',
      ideaTypeId: 'type-1',
      businessImpactId: 'impact-1',
      dueDate: null,
      tagNames: ['dock'],
      assigneeUserIds: ['user-2'],
      mentionEmails: ['a@example.com'],
      fieldValues: [{ fieldDefinitionId: 'f-1', value: 'x' }],
      effort: 'Medium',
      sprintId: null,
    })
  })

  it('sends an empty Sprint as null (the Backlog) and a chosen one as its id', async () => {
    await addIssue({ ...INPUT, sprintId: '' })
    expect(post.mock.calls[0]?.[1]).toMatchObject({ sprintId: null })
    post.mockClear()
    await addIssue({ ...INPUT, sprintId: 'sprint-3' })
    expect(post.mock.calls[0]?.[1]).toMatchObject({ sprintId: 'sprint-3' })
  })

  it('sends a due date as given', async () => {
    await addIssue({ ...INPUT, dueDate: '2026-11-01' })
    expect(post.mock.calls[0]?.[1]).toMatchObject({ dueDate: '2026-11-01' })
  })

  it('sends the effort chosen, unchanged', async () => {
    await addIssue({ ...INPUT, effort: 'High' })
    expect(post.mock.calls[0]?.[1]).toMatchObject({ effort: 'High' })
  })

  it('escapes an organization id that is not a plain segment', async () => {
    vi.mocked(actingOrganizationId).mockResolvedValue('org/1')
    await addIssue(INPUT)
    expect(post.mock.calls[0]?.[0]).toBe('/organizations/org%2F1/issues')
  })

  it('posts nothing for an App Admin, who belongs to no organization, and says to use View As', async () => {
    vi.mocked(actingOrganizationId).mockResolvedValue(null)

    const result = await addIssue(INPUT)

    expect(post).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: false,
      error: 'An App Admin belongs to no organization. Use View As to act as a member of one.',
      errors: {},
    })
  })
})

describe('addIssue success', () => {
  it('returns the new idea’s id', async () => {
    expect(await addIssue(INPUT)).toEqual({ ok: true, ideaId: 'idea-9' })
  })

  it('re-reads the delivery screens, the Ideas list and the layout’s counts', async () => {
    await addIssue(INPUT)

    const paths = revalidatePath.mock.calls.map((call) => call.join(' '))
    expect(paths).toEqual(
      expect.arrayContaining([
        '/delivery/sprint',
        '/delivery/backlog',
        '/delivery/roadmap',
        '/ideas',
        '/ layout',
      ]),
    )
  })
})

describe('addIssue refusals', () => {
  it('hands a validation 400’s field errors back for the form and no top-level message', async () => {
    post.mockRejectedValue(
      new ApiError(400, '/x', 'Validation failed.', {
        effort: 'Effort is required.',
        sprintId: 'Sprint not found.',
      }),
    )

    expect(await addIssue(INPUT)).toEqual({
      ok: false,
      error: null,
      errors: { effort: 'Effort is required.', sprintId: 'Sprint not found.' },
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it.each([
    [400, 'Title is too long.'],
    [403, 'Read Only members cannot add issues.'],
    [404, 'Organization not found.'],
    [409, 'That sprint is completed.'],
  ])('shows the API’s own sentence for a %i with no field errors', async (status, detail) => {
    post.mockRejectedValue(new ApiError(status, '/x', detail))

    expect(await addIssue(INPUT)).toEqual({ ok: false, error: detail, errors: {} })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('sends a 401 back to sign-in', async () => {
    post.mockRejectedValue(new ApiError(401, '/x', 'Unauthorized'))
    await expect(addIssue(INPUT)).rejects.toThrow('NEXT_REDIRECT /login?expired=1')
  })

  it('rethrows what is not an answer, so a 500 lands on the error boundary', async () => {
    post.mockRejectedValue(new ApiError(500, '/x', 'boom'))
    await expect(addIssue(INPUT)).rejects.toThrow('answered 500')
  })

  it('rethrows a network failure', async () => {
    post.mockRejectedValue(new TypeError('fetch failed'))
    await expect(addIssue(INPUT)).rejects.toThrow('fetch failed')
  })
})
