import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiPut } from '@/lib/api/client'
import { moveTasksToSprint } from '@/lib/server/sprint-planning-actions'

/**
 * `moveTasksToSprint`: one `PUT /boards/{id}/sprint-assignments` with `ideaIds` and a required
 * `sprintId`; the API's keyed refusal is shown as it came (`contracts/sprints.md`).
 */
vi.mock('@/lib/api/client', async (original) => ({
  ...(await original<typeof import('@/lib/api/client')>()),
  apiPut: vi.fn(),
}))
const revalidatePath = vi.hoisted(() => vi.fn())
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`)
  },
}))

const put = vi.mocked(apiPut)
const PATH = '/boards/b-1/sprint-assignments'

beforeEach(() => {
  put.mockReset()
  revalidatePath.mockReset()
  put.mockResolvedValue(undefined as never)
})

describe('moveTasksToSprint', () => {
  it('puts the ids and the sprint id to the board’s sprint-assignments', async () => {
    expect(await moveTasksToSprint('b-1', 's-9', ['i-1', 'i-2'])).toEqual({ error: null })
    expect(put).toHaveBeenCalledExactlyOnceWith(PATH, { ideaIds: ['i-1', 'i-2'], sprintId: 's-9' })
  })

  it('sends a sprintId and no statusId when no lane is named (the Add button)', async () => {
    await moveTasksToSprint('b-1', 's-9', ['i-1'])
    const body = put.mock.calls[0]?.[1] as Record<string, unknown>
    expect(body.sprintId).toBe('s-9')
    expect(body).not.toHaveProperty('statusId')
  })

  it('adds the lane’s statusId to the same single write when given one (a lane drop)', async () => {
    await moveTasksToSprint('b-1', 's-9', ['i-1'], 'l-2')
    expect(put).toHaveBeenCalledExactlyOnceWith(PATH, {
      ideaIds: ['i-1'],
      sprintId: 's-9',
      statusId: 'l-2',
    })
  })

  it('omits an empty statusId rather than sending it', async () => {
    await moveTasksToSprint('b-1', 's-9', ['i-1'], '')
    expect(put.mock.calls[0]?.[1]).not.toHaveProperty('statusId')
  })

  it('escapes the board id in the path', async () => {
    await moveTasksToSprint('a/b c', 's-9', ['i-1'])
    expect(put.mock.calls[0]?.[0]).toBe('/boards/a%2Fb%20c/sprint-assignments')
  })

  it('refreshes the Tasks page, the board and the delivery pages after a move', async () => {
    await moveTasksToSprint('b-1', 's-9', ['i-1'])
    const paths = revalidatePath.mock.calls.map((call) => call[0])
    expect(paths).toContain('/tasks')
    expect(paths).toContain('/boards/b-1')
    expect(paths).toContain('/delivery/backlog')
  })

  it('shows the sentence the API keyed under ideaIds, as it came, and revalidates nothing', async () => {
    const sentence = 'T-4 is on another board.'
    put.mockRejectedValue(
      new ApiError(400, PATH, 'Validation failed', { ideaIds: sentence }, { ideaIds: [sentence] }),
    )
    const result = await moveTasksToSprint('b-1', 's-9', ['i-1'])
    expect(result).toEqual({ error: sentence })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('joins several keyed messages into one sentence line', async () => {
    put.mockRejectedValue(
      new ApiError(400, PATH, 'x', { ideaIds: 'A' }, { ideaIds: ['T-1 is gone.', 'T-2 is gone.'] }),
    )
    expect((await moveTasksToSprint('b-1', 's-9', ['i-1', 'i-2'])).error).toBe(
      'T-1 is gone. T-2 is gone.',
    )
  })

  it('puts a 422 rule refusal in words rather than the raw key', async () => {
    put.mockRejectedValue(new ApiError(422, PATH, 'sprintItemOnOtherBoard'))
    const result = await moveTasksToSprint('b-1', 's-9', ['i-1'])
    expect(result.error).toBeTruthy()
    expect(result.error).not.toBe('sprintItemOnOtherBoard')
  })

  it('sends an expired session to sign-in', async () => {
    put.mockRejectedValue(new ApiError(401, PATH, 'expired'))
    await expect(moveTasksToSprint('b-1', 's-9', ['i-1'])).rejects.toThrow(
      'NEXT_REDIRECT /login?expired=1',
    )
  })

  it('rethrows what is not a refusal', async () => {
    put.mockRejectedValue(new Error('network'))
    await expect(moveTasksToSprint('b-1', 's-9', ['i-1'])).rejects.toThrow('network')
  })
})
