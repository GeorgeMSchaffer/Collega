import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiPost, apiPut } from '@/lib/api/client'
import { startSprint } from '@/lib/server/delivery-actions'
import {
  addSprintTask,
  moveTasksToSprint,
  startBoardSprint,
} from '@/lib/server/sprint-planning-actions'

/**
 * The planning page's three writes (TB-5): `moveTasksToSprint` with a null sprint (Remove),
 * `addSprintTask` (`POST /boards/{id}/tasks` with a sprint id) and `startBoardSprint` (the existing
 * start call plus board revalidation). Request bodies, refusals and what is revalidated.
 */
vi.mock('@/lib/api/client', async (original) => ({
  ...(await original<typeof import('@/lib/api/client')>()),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
}))
vi.mock('@/lib/server/delivery-actions', () => ({ startSprint: vi.fn() }))
const revalidatePath = vi.hoisted(() => vi.fn())
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`)
  },
}))

const post = vi.mocked(apiPost)
const put = vi.mocked(apiPut)
const start = vi.mocked(startSprint)
const revalidated = () => revalidatePath.mock.calls.map((call) => call[0])

beforeEach(() => {
  post.mockReset().mockResolvedValue(undefined as never)
  put.mockReset().mockResolvedValue(undefined as never)
  start.mockReset().mockResolvedValue({ error: null })
  revalidatePath.mockReset()
})

describe('moveTasksToSprint with a null sprint', () => {
  it('puts a null sprintId, so the tasks return to the Backlog, and no statusId', async () => {
    expect(await moveTasksToSprint('b-1', null, ['i-1'])).toEqual({ error: null })
    expect(put).toHaveBeenCalledExactlyOnceWith('/boards/b-1/sprint-assignments', {
      ideaIds: ['i-1'],
      sprintId: null,
    })
    expect(put.mock.calls[0]?.[1]).not.toHaveProperty('statusId')
  })

  it('refreshes the board, the Tasks page and the delivery pages', async () => {
    await moveTasksToSprint('b-1', null, ['i-1'])
    expect(revalidated()).toEqual(
      expect.arrayContaining(['/boards/b-1', '/tasks', '/delivery/backlog', '/delivery/sprint']),
    )
  })

  it('revalidates nothing when the API refuses', async () => {
    put.mockRejectedValue(new ApiError(422, '/x', 'sprintItemOnOtherBoard'))
    expect((await moveTasksToSprint('b-1', null, ['i-1'])).error).toBeTruthy()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('addSprintTask', () => {
  it('posts the title and sprint id to the board’s tasks', async () => {
    expect(await addSprintTask('b-1', 's-9', 'Write docs')).toEqual({ error: null })
    expect(post).toHaveBeenCalledExactlyOnceWith('/boards/b-1/tasks', {
      title: 'Write docs',
      sprintId: 's-9',
    })
  })

  it('escapes the board id in the path', async () => {
    await addSprintTask('a/b c', 's-9', 'T')
    expect(post.mock.calls[0]?.[0]).toBe('/boards/a%2Fb%20c/tasks')
  })

  it('refreshes the board, the Tasks page and the delivery pages so counts move', async () => {
    await addSprintTask('b-1', 's-9', 'T')
    expect(revalidated()).toEqual(
      expect.arrayContaining(['/boards/b-1', '/tasks', '/delivery/backlog', '/delivery/sprint']),
    )
  })

  it('shows the first keyed field message when the API refuses the title', async () => {
    post.mockRejectedValue(
      new ApiError(400, '/x', 'Validation failed', { title: 'Title is required.' }),
    )
    expect(await addSprintTask('b-1', 's-9', '')).toEqual({ error: 'Title is required.' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('puts a 422 rule refusal in words rather than the raw key', async () => {
    post.mockRejectedValue(new ApiError(422, '/x', 'sprintItemOnOtherBoard'))
    const result = await addSprintTask('b-1', 's-9', 'T')
    expect(result.error).toBeTruthy()
    expect(result.error).not.toBe('sprintItemOnOtherBoard')
  })

  it('sends an expired session to sign-in', async () => {
    post.mockRejectedValue(new ApiError(401, '/x', 'expired'))
    await expect(addSprintTask('b-1', 's-9', 'T')).rejects.toThrow('NEXT_REDIRECT /login?expired=1')
  })

  it('rethrows what is not a refusal', async () => {
    post.mockRejectedValue(new Error('network'))
    await expect(addSprintTask('b-1', 's-9', 'T')).rejects.toThrow('network')
  })
})

describe('startBoardSprint', () => {
  it('starts the sprint in its organization', async () => {
    expect(await startBoardSprint('b-1', 'org-1', 's-9')).toEqual({ error: null })
    expect(start).toHaveBeenCalledExactlyOnceWith('org-1', 's-9')
  })

  it('refreshes the board page and the delivery pages after a start', async () => {
    await startBoardSprint('b-1', 'org-1', 's-9')
    expect(revalidated()).toEqual(
      expect.arrayContaining(['/boards/b-1', '/delivery/sprint', '/delivery/backlog']),
    )
  })

  it('returns the refusal and revalidates nothing when the start fails', async () => {
    start.mockResolvedValue({ error: 'Another sprint is already active.' })
    expect(await startBoardSprint('b-1', 'org-1', 's-9')).toEqual({
      error: 'Another sprint is already active.',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
