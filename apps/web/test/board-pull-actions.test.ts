import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiPostReturning, apiPut } from '@/lib/api/client'
import { createBoard, saveBoard } from '@/lib/server/board-actions'
import { actingOrganizationId } from '@/lib/server/current-user'

/**
 * What the board form's save sends and shows for a pull (`20-feature-board-pull-in.md` rules 9 and
 * 12; `contracts/boards.md` `pullItemIds`): the ids ride in the same body as the board, are left out
 * when empty, and a refusal comes back as one message per item beside the banner. The HTTP client
 * and the acting organization are the boundary.
 */
vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  apiPostReturning: vi.fn(),
  apiPut: vi.fn(),
}))
vi.mock('@/lib/server/current-user', () => ({ actingOrganizationId: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`)
  },
}))

const post = vi.mocked(apiPostReturning)
const put = vi.mocked(apiPut)

function form(pull: string[] = []) {
  const data = new FormData()
  data.set('name', 'Assembly')
  data.set('description', '')
  data.append('swimlaneIds', 's-1')
  data.append('swimlaneIds', 's-2')
  for (const id of pull) data.append('pullItemIds', id)
  return data
}

const IDLE = { error: null }

beforeEach(() => {
  post.mockReset()
  put.mockReset()
  vi.mocked(actingOrganizationId).mockResolvedValue('org-1')
})

describe('creating a board with a pull', () => {
  it('sends the chosen ids as pullItemIds in the create body', async () => {
    post.mockResolvedValue({ boardId: 'b-1' })
    await expect(createBoard(IDLE, form(['i-1', 'i-2']))).rejects.toThrow('NEXT_REDIRECT')
    expect(post.mock.calls[0]?.[1]).toMatchObject({ pullItemIds: ['i-1', 'i-2'] })
  })

  it('leaves pullItemIds out when nothing is chosen, so the request is what it was before the step', async () => {
    post.mockResolvedValue({ boardId: 'b-1' })
    await expect(createBoard(IDLE, form())).rejects.toThrow('NEXT_REDIRECT')
    expect(post.mock.calls[0]?.[1]).not.toHaveProperty('pullItemIds')
  })

  it('returns every per-item refusal as pullErrors and no banner when only pullItemIds was refused', async () => {
    const messages = [
      "'Slow conveyor' is on another board.",
      'You may pull only ideas you created.',
    ]
    post.mockRejectedValue(
      new ApiError(
        400,
        '/organizations/org-1/boards',
        'Validation failed',
        {},
        { pullItemIds: messages },
      ),
    )
    expect(await createBoard(IDLE, form(['i-1', 'i-2']))).toEqual({
      error: null,
      pullErrors: messages,
    })
  })

  it('keeps the other field messages in the banner beside the pull refusals', async () => {
    post.mockRejectedValue(
      new ApiError(
        400,
        '/organizations/org-1/boards',
        'Validation failed',
        { name: 'A board with that name exists.', pullItemIds: 'x' },
        { name: ['A board with that name exists.'], pullItemIds: ['No more than 100 items.'] },
      ),
    )
    const result = await createBoard(IDLE, form(['i-1']))
    expect(result).toMatchObject({ pullErrors: ['No more than 100 items.'] })
    expect((result as { error: string | null }).error).toContain('A board with that name exists.')
  })

  it('does not redirect when the pull is refused', async () => {
    post.mockRejectedValue(
      new ApiError(400, '/x', 'Validation failed', {}, { pullItemIds: ['nope'] }),
    )
    await expect(createBoard(IDLE, form(['i-1']))).resolves.toBeDefined()
  })
})

describe('editing a board with a pull', () => {
  it('sends pullItemIds in the PUT body beside the lane moves', async () => {
    put.mockResolvedValue(undefined)
    const data = form(['i-3'])
    data.set('boardId', 'b-9')
    await expect(saveBoard(IDLE, data)).rejects.toThrow('NEXT_REDIRECT')
    expect(put.mock.calls[0]?.[0]).toBe('/boards/b-9')
    expect(put.mock.calls[0]?.[1]).toMatchObject({ pullItemIds: ['i-3'], ideaMoves: [] })
  })

  it('returns the per-item refusals for an edit too', async () => {
    put.mockRejectedValue(
      new ApiError(
        400,
        '/boards/b-9',
        'Validation failed',
        {},
        {
          pullItemIds: ['Idea i-3 is already on this board.'],
        },
      ),
    )
    const data = form(['i-3'])
    data.set('boardId', 'b-9')
    expect(await saveBoard(IDLE, data)).toEqual({
      error: null,
      pullErrors: ['Idea i-3 is already on this board.'],
    })
  })
})
