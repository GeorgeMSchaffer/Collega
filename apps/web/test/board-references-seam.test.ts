import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiPost, apiPut } from '@/lib/api/client'
import { saveBoardInPlace } from '@/lib/server/board-actions'
import { moveIdea } from '@/lib/server/idea-actions'

/**
 * The two live defects behind slice 260, with the HTTP client as the boundary: a board save must
 * send each lane's Board References flags back (the API rebuilds lanes from the request, so absent
 * flags are cleared), and a 422 is a refusal to show rather than an error to throw.
 */
vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
}))
vi.mock('@/lib/server/current-user', () => ({ actingOrganizationId: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`)
  },
}))

const put = vi.mocked(apiPut)
const post = vi.mocked(apiPost)

const IDLE = { error: null, savedId: null }

function boardForm(laneFlags: Record<string, unknown> | null) {
  const data = new FormData()
  data.set('boardId', 'b-1')
  data.set('name', 'Renamed')
  data.set('description', '')
  data.append('swimlaneIds', 's-1')
  data.append('swimlaneIds', 's-2')
  data.append('swimlaneIds', 's-3')
  if (laneFlags) data.set('laneFlags', JSON.stringify(laneFlags))
  return data
}

beforeEach(() => {
  put.mockReset()
  post.mockReset()
})

describe('a board save and the lane flags', () => {
  it('sends each lane its own flags back, so renaming a board clears none of them', async () => {
    put.mockResolvedValue(undefined)
    const result = await saveBoardInPlace(
      IDLE,
      boardForm({
        's-1': { isFinal: false, referencesBoardId: null, autoCreateTask: false },
        's-2': { isFinal: false, referencesBoardId: 'b-tasks', autoCreateTask: true },
        's-3': { isFinal: true, referencesBoardId: null, autoCreateTask: false },
      }),
    )
    expect(result).toEqual({ error: null, savedId: 'b-1' })
    expect(put.mock.calls[0]?.[1]).toMatchObject({
      name: 'Renamed',
      swimlanes: [
        {
          statusId: 's-1',
          order: 0,
          isFinal: false,
          referencesBoardId: null,
          autoCreateTask: false,
        },
        {
          statusId: 's-2',
          order: 1,
          isFinal: false,
          referencesBoardId: 'b-tasks',
          autoCreateTask: true,
        },
        {
          statusId: 's-3',
          order: 2,
          isFinal: true,
          referencesBoardId: null,
          autoCreateTask: false,
        },
      ],
    })
  })

  it('sends the defaults for a lane the form has no flags for', async () => {
    put.mockResolvedValue(undefined)
    await saveBoardInPlace(IDLE, boardForm(null))
    const body = put.mock.calls[0]?.[1] as { swimlanes: unknown[] }
    expect(body.swimlanes[0]).toEqual({
      statusId: 's-1',
      order: 0,
      isFinal: false,
      referencesBoardId: null,
      autoCreateTask: false,
    })
  })
})

describe('a 422 refusal', () => {
  it('comes back from a board save as the message to show, not a throw', async () => {
    put.mockRejectedValue(new ApiError(422, '/boards/b-1', 'referencesBoardInvalid'))
    expect(await saveBoardInPlace(IDLE, boardForm(null))).toEqual({
      error: 'A lane can reference only an active board of this organization.',
      savedId: null,
      pullErrors: [],
    })
  })

  it('comes back from an idea move as the message to show, not a throw', async () => {
    post.mockRejectedValue(new ApiError(422, '/ideas/i-1/status', 'parentHasOpenTasks'))
    const data = new FormData()
    data.set('ideaId', 'i-1')
    data.set('boardId', 'b-1')
    data.set('statusId', 's-2')
    expect(await moveIdea({ error: null }, data)).toEqual({
      error: 'This card is waiting on open tasks, so it cannot be moved.',
    })
  })

  it('still lets a 500 through', async () => {
    post.mockRejectedValue(new ApiError(500, '/ideas/i-1/status', 'boom'))
    const data = new FormData()
    data.set('ideaId', 'i-1')
    await expect(moveIdea({ error: null }, data)).rejects.toBeInstanceOf(ApiError)
  })
})
