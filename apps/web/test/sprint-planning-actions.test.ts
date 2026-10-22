import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiPost, apiPut } from '@/lib/api/client'
import { addTasksToSprint, createBoardSprint } from '@/lib/server/sprint-planning-actions'

/**
 * Sprint planning from a work board's Backlog (TB-4, TB-5): `POST /boards/{id}/sprints` with
 * `ideaIds`, and `PUT /boards/{id}/sprint-assignments` to add tasks. The request bodies, the
 * refusals in words (a keyed `ideaIds` message as the API wrote it), and what is revalidated.
 */
vi.mock('@/lib/api/client', async (original) => ({
  ...(await original<typeof import('@/lib/api/client')>()),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
}))
const revalidatePath = vi.hoisted(() => vi.fn())
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`)
  },
}))

const post = vi.mocked(apiPost)
const put = vi.mocked(apiPut)
const input = {
  name: 'Sprint 9',
  goal: 'Ship',
  startDate: '2026-11-02',
  endDate: '2026-11-13',
  ownerUserId: 'u-ada',
}

beforeEach(() => {
  post.mockReset().mockResolvedValue(undefined as never)
  put.mockReset().mockResolvedValue(undefined as never)
  revalidatePath.mockReset()
})

describe('createBoardSprint', () => {
  it('posts the sprint with the ticked ids to the board’s sprints', async () => {
    expect(await createBoardSprint('b-1', input, ['i-1', 'i-2'])).toEqual({ ok: true })
    expect(post).toHaveBeenCalledExactlyOnceWith('/boards/b-1/sprints', {
      name: 'Sprint 9',
      goal: 'Ship',
      startDate: '2026-11-02',
      endDate: '2026-11-13',
      ownerUserId: 'u-ada',
      ideaIds: ['i-1', 'i-2'],
    })
  })

  it('leaves ideaIds out for an empty sprint and sends blank goal and owner as null', async () => {
    await createBoardSprint('b-1', { ...input, goal: '', ownerUserId: '' }, [])
    const body = post.mock.calls[0]?.[1] as Record<string, unknown>
    expect(body).not.toHaveProperty('ideaIds')
    expect(body).toMatchObject({ goal: null, ownerUserId: null })
  })

  it('escapes the board id in the path', async () => {
    await createBoardSprint('a/b c', input, [])
    expect(post.mock.calls[0]?.[0]).toBe('/boards/a%2Fb%20c/sprints')
  })

  it('revalidates the board page and the delivery pages on success', async () => {
    await createBoardSprint('b-1', input, ['i-1'])
    const paths = revalidatePath.mock.calls.map((call) => call[0])
    expect(paths).toContain('/boards/b-1')
    expect(paths).toContain('/delivery/sprint')
  })

  it('returns a keyed ideaIds refusal as the API wrote it, with no rule message', async () => {
    post.mockRejectedValue(
      new ApiError(400, '/boards/b-1/sprints', 'validation', {
        ideaIds: 'W-3: that task is already in a sprint.',
      }),
    )
    expect(await createBoardSprint('b-1', input, ['i-3'])).toEqual({
      ok: false,
      error: null,
      errors: { ideaIds: 'W-3: that task is already in a sprint.' },
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('turns an unkeyed rule refusal into its plain-language message', async () => {
    post.mockRejectedValue(new ApiError(422, '/boards/b-1/sprints', 'sprintsNotEnabled'))
    expect(await createBoardSprint('b-1', input, [])).toEqual({
      ok: false,
      error: 'Sprints are switched off on this board.',
      errors: {},
    })
  })

  it('sends an expired session to sign-in', async () => {
    post.mockRejectedValue(new ApiError(401, '/boards/b-1/sprints', 'unauthorized'))
    await expect(createBoardSprint('b-1', input, [])).rejects.toThrow('NEXT_REDIRECT /login?expired=1')
  })

  it('rethrows what is not a refusal', async () => {
    post.mockRejectedValue(new Error('network'))
    await expect(createBoardSprint('b-1', input, [])).rejects.toThrow('network')
  })
})

describe('addTasksToSprint', () => {
  it('puts sprintId and ideaIds, and no statusId, to the assignment route', async () => {
    expect(await addTasksToSprint('b-1', 's-1', ['i-1', 'i-2'])).toEqual({ error: null })
    expect(put).toHaveBeenCalledExactlyOnceWith('/boards/b-1/sprint-assignments', {
      ideaIds: ['i-1', 'i-2'],
      sprintId: 's-1',
    })
    expect(put.mock.calls[0]?.[1]).not.toHaveProperty('statusId')
  })

  it('revalidates the board page on success only', async () => {
    await addTasksToSprint('b-1', 's-1', ['i-1'])
    expect(revalidatePath.mock.calls.map((call) => call[0])).toContain('/boards/b-1')
    revalidatePath.mockReset()
    put.mockRejectedValue(new ApiError(400, 'p', 'x', { ideaIds: 'W-1: no.' }))
    await addTasksToSprint('b-1', 's-1', ['i-1'])
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('shows the keyed ideaIds message as the API wrote it', async () => {
    put.mockRejectedValue(
      new ApiError(400, 'p', 'validation', { ideaIds: 'W-3: that task is on another board.' }),
    )
    expect(await addTasksToSprint('b-1', 's-1', ['i-3'])).toEqual({
      error: 'W-3: that task is on another board.',
    })
  })

  it('falls back to another keyed message, such as a completed sprint', async () => {
    put.mockRejectedValue(
      new ApiError(400, 'p', 'validation', { sprintId: 'A completed sprint cannot take new issues.' }),
    )
    expect(await addTasksToSprint('b-1', 's-1', ['i-3'])).toEqual({
      error: 'A completed sprint cannot take new issues.',
    })
  })

  it('falls back to the rule message when nothing is keyed', async () => {
    put.mockRejectedValue(new ApiError(422, 'p', 'sprintItemOnOtherBoard'))
    expect(await addTasksToSprint('b-1', 's-1', ['i-3'])).toEqual({
      error: 'A sprint holds tasks from its own board only.',
    })
  })

  it('shows a 403 in the API’s words', async () => {
    put.mockRejectedValue(new ApiError(403, 'p', 'Only an Org Admin can plan sprints.'))
    expect((await addTasksToSprint('b-1', 's-1', ['i-3'])).error).toBe(
      'Only an Org Admin can plan sprints.',
    )
  })

  it('sends an expired session to sign-in and rethrows the unexpected', async () => {
    put.mockRejectedValue(new ApiError(401, 'p', 'unauthorized'))
    await expect(addTasksToSprint('b-1', 's-1', ['i'])).rejects.toThrow('NEXT_REDIRECT')
    put.mockRejectedValue(new Error('boom'))
    await expect(addTasksToSprint('b-1', 's-1', ['i'])).rejects.toThrow('boom')
  })
})
