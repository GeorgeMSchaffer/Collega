import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiPost, apiPostReturning, apiPut } from '@/lib/api/client'
import { createBoardInPlace, saveBoard, saveBoardInPlace } from '@/lib/server/board-actions'

/**
 * A board's access on the save path (`contracts/boards.md` "Board access"), with the HTTP client as
 * the boundary: create carries visibility and both lists in the board POST, an edit sets them with
 * `PUT /boards/{id}/access` after the board PUT, only from a form that showed the section, and a
 * 400 on either surfaces in the banner without hiding that the board itself was saved.
 */
vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  apiPost: vi.fn(),
  apiPostReturning: vi.fn(),
  apiPut: vi.fn(),
}))
vi.mock('@/lib/server/current-user', () => ({ actingOrganizationId: vi.fn(async () => 'org-1') }))
const revalidatePath = vi.hoisted(() => vi.fn())
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`)
  },
}))

const put = vi.mocked(apiPut)
const create = vi.mocked(apiPostReturning)
const IDLE = { error: null, savedId: null }

type Shape = {
  boardId?: string | null
  shown?: boolean
  visibility?: string
  users?: string[]
  groups?: string[]
}

function form(over: Shape = {}) {
  const data = new FormData()
  if (over.boardId !== null) data.set('boardId', over.boardId ?? 'b-1')
  data.set('name', 'Board')
  data.set('description', '')
  data.append('swimlaneIds', 's-1')
  data.append('swimlaneIds', 's-2')
  if (over.shown) {
    data.set('accessShown', '1')
    data.set('visibility', over.visibility ?? 'Restricted')
  }
  for (const id of over.users ?? []) data.append('accessUserIds', id)
  for (const id of over.groups ?? []) data.append('accessGroupIds', id)
  return data
}

const refusal = (path: string, errors: Record<string, string>) =>
  new ApiError(400, path, 'One or more fields are invalid.', errors)
const putPaths = () => put.mock.calls.map((call) => String(call[0]))
const accessCall = () => put.mock.calls.find((call) => String(call[0]).endsWith('/access'))

beforeEach(() => {
  vi.mocked(apiPost).mockReset()
  put.mockReset().mockResolvedValue(undefined)
  create.mockReset().mockResolvedValue({ boardId: 'b-new' })
  revalidatePath.mockReset()
})

describe('creating a Restricted board', () => {
  it('sends visibility and both lists in the create request', async () => {
    await createBoardInPlace(
      IDLE,
      form({ boardId: null, shown: true, users: ['u-1', 'u-2'], groups: ['g-1'] }),
    )
    expect(create.mock.calls[0]?.[1]).toMatchObject({
      visibility: 'Restricted',
      accessUserIds: ['u-1', 'u-2'],
      accessGroupIds: ['g-1'],
    })
  })

  it('sends an Organization board with a kept list as written, for the API to hold', async () => {
    await createBoardInPlace(
      IDLE,
      form({ boardId: null, shown: true, visibility: 'Organization', users: ['u-1'] }),
    )
    expect(create.mock.calls[0]?.[1]).toMatchObject({
      visibility: 'Organization',
      accessUserIds: ['u-1'],
      accessGroupIds: [],
    })
  })

  it('leaves the access fields out when the form did not show the section', async () => {
    await createBoardInPlace(IDLE, form({ boardId: null, shown: false, users: ['u-1'] }))
    const body = create.mock.calls[0]?.[1]
    expect(body).not.toHaveProperty('visibility')
    expect(body).not.toHaveProperty('accessUserIds')
    expect(body).not.toHaveProperty('accessGroupIds')
  })

  it('makes no separate access request on create', async () => {
    await createBoardInPlace(IDLE, form({ boardId: null, shown: true, users: ['u-1'] }))
    expect(putPaths()).toEqual([])
  })

  it.each(['userIds', 'groupIds', 'visibility', 'accessUserIds', 'accessGroupIds'])(
    'shows a 400 keyed %s in the banner',
    async (key) => {
      create.mockRejectedValue(refusal('/boards', { [key]: 'Those people are not in this organization.' }))
      const result = await createBoardInPlace(
        IDLE,
        form({ boardId: null, shown: true, users: ['x'] }),
      )
      expect(result).toMatchObject({
        error: 'Those people are not in this organization.',
        savedId: null,
      })
    },
  )
})

describe('saving a board with its access', () => {
  it('writes the board, then PUTs the access, keeping access out of the board body', async () => {
    const result = await saveBoardInPlace(
      IDLE,
      form({ shown: true, users: ['u-1'], groups: ['g-1', 'g-2'] }),
    )
    expect(putPaths()).toEqual(['/boards/b-1', '/boards/b-1/access'])
    const body = put.mock.calls[0]?.[1]
    expect(body).not.toHaveProperty('visibility')
    expect(body).not.toHaveProperty('accessUserIds')
    expect(body).not.toHaveProperty('userIds')
    expect(accessCall()?.[1]).toEqual({
      visibility: 'Restricted',
      userIds: ['u-1'],
      groupIds: ['g-1', 'g-2'],
    })
    expect(result).toEqual({ error: null, savedId: 'b-1' })
  })

  it('sends Organization with the kept list when the board was switched back to Everyone', async () => {
    await saveBoardInPlace(IDLE, form({ shown: true, visibility: 'Organization', users: ['u-1'] }))
    expect(accessCall()?.[1]).toEqual({
      visibility: 'Organization',
      userIds: ['u-1'],
      groupIds: [],
    })
  })

  it('makes no access request when the form did not show the section', async () => {
    await saveBoardInPlace(IDLE, form({ shown: false, users: ['u-1'] }))
    expect(putPaths()).toEqual(['/boards/b-1'])
  })

  it('stops after a refused board write without calling the access route', async () => {
    put.mockRejectedValueOnce(new ApiError(409, '/boards/b-1', 'The board is archived.'))
    const result = await saveBoardInPlace(IDLE, form({ shown: true, users: ['u-1'] }))
    expect(putPaths()).toEqual(['/boards/b-1'])
    expect(result.error).toBe('The board is archived.')
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it.each(['userIds', 'groupIds', 'visibility'])(
    'says the board was saved and shows a 400 keyed %s in the banner',
    async (key) => {
      put
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(refusal('/boards/b-1/access', { [key]: 'Group g-9 was not found.' }))
      const result = await saveBoardInPlace(IDLE, form({ shown: true, groups: ['g-9'] }))
      expect(result.savedId).toBeNull()
      expect(result.error).toBe(
        'The board was saved, but who can see it was not. Group g-9 was not found.',
      )
      expect(revalidatePath).toHaveBeenCalledWith('/boards/b-1')
      expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
    },
  )

  it('prefixes a non-field refusal of the access write the same way', async () => {
    put
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new ApiError(403, '/boards/b-1/access', 'Not allowed.'))
    const result = await saveBoardInPlace(IDLE, form({ shown: true }))
    expect(result.error).toBe('The board was saved, but who can see it was not. Not allowed.')
  })

  it('serves the Settings save the same way: board PUT, access PUT, then the redirect', async () => {
    await expect(saveBoard({ error: null }, form({ shown: true, users: ['u-1'] }))).rejects.toThrow(
      'NEXT_REDIRECT /settings/boards',
    )
    expect(putPaths()).toEqual(['/boards/b-1', '/boards/b-1/access'])
  })

  it('keeps the Settings form open with the refusal when only the access is refused', async () => {
    put
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(refusal('/boards/b-1/access', { userIds: 'User u-9 was not found.' }))
    const result = await saveBoard({ error: null }, form({ shown: true, users: ['u-9'] }))
    expect(result.error).toBe('The board was saved, but who can see it was not. User u-9 was not found.')
  })
})
