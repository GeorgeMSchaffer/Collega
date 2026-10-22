import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiPostReturning } from '@/lib/api/client'
import { quickAddBoard } from '@/lib/server/board-actions'
import { actingOrganizationId } from '@/lib/server/current-user'

/**
 * The Boards list's quick-add save: one `POST /organizations/{id}/boards` with the name, an empty
 * description, user status moves off and the page's first two statuses as lanes 0 and 1. The HTTP
 * client and the acting organization are the boundary.
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
const org = vi.mocked(actingOrganizationId)

beforeEach(() => {
  post.mockReset()
  org.mockReset()
  revalidatePath.mockReset()
  org.mockResolvedValue('org-1')
})

describe('quickAddBoard', () => {
  it('posts the board with an empty description, user moves on and the two lanes in order', async () => {
    post.mockResolvedValue({ boardId: 'b-9' })
    await quickAddBoard('Assembly', ['st-1', 'st-2'])
    expect(post).toHaveBeenCalledExactlyOnceWith('/organizations/org-1/boards', {
      name: 'Assembly',
      description: '',
      allowUserStatusUpdate: true,
      swimlanes: [
        { statusId: 'st-1', order: 0 },
        { statusId: 'st-2', order: 1 },
      ],
    })
  })

  it('escapes the organization id in the path', async () => {
    org.mockResolvedValue('a/b c')
    post.mockResolvedValue({ boardId: 'b-9' })
    await quickAddBoard('Assembly', ['st-1', 'st-2'])
    expect(post.mock.calls[0]?.[0]).toBe('/organizations/a%2Fb%20c/boards')
  })

  it('returns the new board id and revalidates the layout', async () => {
    post.mockResolvedValue({ boardId: 'b-9' })
    expect(await quickAddBoard('Assembly', ['st-1', 'st-2'])).toEqual({ ok: true, boardId: 'b-9' })
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('maps a 400 on the name to a name field error, keeping other messages as the general error', async () => {
    post.mockRejectedValue(
      new ApiError(400, '/organizations/org-1/boards', 'One or more validation errors occurred.', {
        name: 'A board with this name already exists.',
        swimlanes: 'Add at least two swimlanes.',
      }),
    )
    expect(await quickAddBoard('Assembly', ['st-1', 'st-2'])).toEqual({
      ok: false,
      error: 'Add at least two swimlanes.',
      errors: { name: 'A board with this name already exists.' },
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('maps a name-only 400 to just the field error', async () => {
    post.mockRejectedValue(
      new ApiError(400, '/organizations/org-1/boards', 'One or more validation errors occurred.', {
        name: 'Name is too long.',
      }),
    )
    expect(await quickAddBoard('x', ['st-1', 'st-2'])).toEqual({
      ok: false,
      error: null,
      errors: { name: 'Name is too long.' },
    })
  })

  it('does not call a 400 on some other field a name error', async () => {
    post.mockRejectedValue(
      new ApiError(400, '/organizations/org-1/boards', 'One or more validation errors occurred.', {
        swimlanes: 'Add at least two swimlanes.',
      }),
    )
    const result = await quickAddBoard('Assembly', ['st-1'])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors).toEqual({})
  })

  it('turns a 403 into a general error with no field', async () => {
    post.mockRejectedValue(new ApiError(403, '/organizations/org-1/boards', 'Not allowed.', {}))
    expect(await quickAddBoard('Assembly', ['st-1', 'st-2'])).toEqual({
      ok: false,
      error: 'Not allowed.',
      errors: {},
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('lets a server failure propagate rather than showing it as a refusal', async () => {
    post.mockRejectedValue(new ApiError(500, '/organizations/org-1/boards', 'Boom', {}))
    await expect(quickAddBoard('Assembly', ['st-1', 'st-2'])).rejects.toBeInstanceOf(ApiError)
  })

  it('sends an expired session to the sign-in page', async () => {
    post.mockRejectedValue(new ApiError(401, '/organizations/org-1/boards', 'Expired', {}))
    await expect(quickAddBoard('Assembly', ['st-1', 'st-2'])).rejects.toThrow(
      'NEXT_REDIRECT /login?expired=1',
    )
  })

  it('refuses without calling the API when the actor belongs to no organization', async () => {
    org.mockResolvedValue(null)
    const result = await quickAddBoard('Assembly', ['st-1', 'st-2'])
    expect(post).not.toHaveBeenCalled()
    expect(result).toMatchObject({ ok: false, errors: {} })
    if (!result.ok) expect(result.error).toMatch(/View As/)
  })
})
