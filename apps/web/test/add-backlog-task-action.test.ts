import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiPost } from '@/lib/api/client'
import { addBacklogTask } from '@/lib/server/idea-actions'

/** `addBacklogTask`: one `POST /boards/{id}/tasks`, the API's refusal in the rule table's words. */
vi.mock('@/lib/api/client', async (original) => ({
  ...(await original<typeof import('@/lib/api/client')>()),
  apiPost: vi.fn(),
}))
vi.mock('@/lib/server/current-user', () => ({ actingOrganizationId: vi.fn() }))
const revalidatePath = vi.hoisted(() => vi.fn())
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`)
  },
}))

const post = vi.mocked(apiPost)
const input = { title: 'Wire it', description: 'd', assigneeUserIds: ['u-1'], tagNames: ['x'] }

beforeEach(() => {
  post.mockReset()
  revalidatePath.mockReset()
  post.mockResolvedValue(undefined as never)
})

describe('addBacklogTask', () => {
  it('posts the task with its parent when one is chosen', async () => {
    await addBacklogTask('b-1', { ...input, parentIdeaId: 'p-1' })
    expect(post).toHaveBeenCalledExactlyOnceWith('/boards/b-1/tasks', {
      title: 'Wire it',
      description: 'd',
      assigneeUserIds: ['u-1'],
      tagNames: ['x'],
      parentIdeaId: 'p-1',
    })
  })

  it('leaves parentIdeaId out entirely for a standalone task', async () => {
    await addBacklogTask('b-1', { ...input, parentIdeaId: null })
    expect(post.mock.calls[0]?.[1]).not.toHaveProperty('parentIdeaId')
  })

  it('escapes the board id in the path', async () => {
    await addBacklogTask('a/b c', { ...input, parentIdeaId: null })
    expect(post.mock.calls[0]?.[0]).toBe('/boards/a%2Fb%20c/tasks')
  })

  it('returns no error and revalidates the board page on success', async () => {
    expect(await addBacklogTask('b-1', { ...input, parentIdeaId: null })).toEqual({ error: null })
    expect(revalidatePath).toHaveBeenCalledWith('/boards/[boardId]', 'page')
  })

  it('shows the boardIsNotAWorkBoard refusal in words, and revalidates nothing', async () => {
    post.mockRejectedValue(new ApiError(422, '/boards/b-1/tasks', 'boardIsNotAWorkBoard'))
    const result = await addBacklogTask('b-1', { ...input, parentIdeaId: null })
    expect(result.error).toBe('No lane references this board, so it has no tasks to add.')
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('shows the parentNotInReferenceLane refusal in words', async () => {
    post.mockRejectedValue(new ApiError(422, '/boards/b-1/tasks', 'parentNotInReferenceLane'))
    const result = await addBacklogTask('b-1', { ...input, parentIdeaId: 'p-1' })
    expect(result.error).toMatch(/lane that references that board/)
  })

  it('rethrows what is not a rule refusal', async () => {
    post.mockRejectedValue(new Error('network'))
    await expect(addBacklogTask('b-1', { ...input, parentIdeaId: null })).rejects.toThrow('network')
  })
})
