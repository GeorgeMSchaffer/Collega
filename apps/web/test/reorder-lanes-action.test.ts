import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiPost } from '@/lib/api/client'
import { reorderLanes } from '@/lib/server/board-actions'

/**
 * The save behind both lane-reorder inputs (`SPEC/20-feature-client-ui.md` "Reordering Columns"):
 * one `POST /boards/{id}/swimlanes/reorder` naming every lane with a dense `order` from zero, and
 * how the API's refusals read back. The HTTP client is the boundary.
 */
vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
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

beforeEach(() => {
  post.mockReset()
  revalidatePath.mockReset()
})

describe('reorderLanes', () => {
  it('posts every lane with a dense order from zero, in the order given', async () => {
    post.mockResolvedValue(undefined)
    await reorderLanes('b-1', ['c', 'a', 'd', 'b'])
    expect(post).toHaveBeenCalledExactlyOnceWith('/boards/b-1/swimlanes/reorder', {
      swimlanes: [
        { statusId: 'c', order: 0 },
        { statusId: 'a', order: 1 },
        { statusId: 'd', order: 2 },
        { statusId: 'b', order: 3 },
      ],
    })
  })

  it('escapes the board id in the path', async () => {
    post.mockResolvedValue(undefined)
    await reorderLanes('a/b c', ['x', 'y'])
    expect(post.mock.calls[0]?.[0]).toBe('/boards/a%2Fb%20c/swimlanes/reorder')
  })

  it('revalidates the board page and the Boards list on success', async () => {
    post.mockResolvedValue(undefined)
    expect(await reorderLanes('b-1', ['a', 'b'])).toEqual({ error: null })
    expect(revalidatePath).toHaveBeenCalledWith('/boards/b-1')
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('returns the field message of a 400 rather than its generic title', async () => {
    post.mockRejectedValue(
      new ApiError(
        400,
        '/boards/b-1/swimlanes/reorder',
        'One or more validation errors occurred.',
        {
          swimlanes: 'Name every swimlane on the board exactly once.',
        },
      ),
    )
    expect(await reorderLanes('b-1', ['a'])).toEqual({
      error: 'Name every swimlane on the board exactly once.',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it.each([[400], [403], [404], [409]])(
    'returns the detail of a %i with no field message',
    async (status) => {
      post.mockRejectedValue(new ApiError(status, '/p', 'The API’s own words.'))
      expect(await reorderLanes('b-1', ['a', 'b'])).toEqual({ error: 'The API’s own words.' })
    },
  )

  it('sends a 401 to the expired sign-in', async () => {
    post.mockRejectedValue(new ApiError(401, '/p', 'No.'))
    await expect(reorderLanes('b-1', ['a', 'b'])).rejects.toThrow('NEXT_REDIRECT /login?expired=1')
  })

  it('lets an unexpected failure through rather than reading it as a refusal', async () => {
    post.mockRejectedValue(new ApiError(500, '/p', 'boom'))
    await expect(reorderLanes('b-1', ['a', 'b'])).rejects.toBeInstanceOf(ApiError)
  })
})
