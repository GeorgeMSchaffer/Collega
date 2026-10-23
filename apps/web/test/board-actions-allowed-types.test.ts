import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiPost, apiPostReturning, apiPut } from '@/lib/api/client'
import { createBoardInPlace, saveBoard, saveBoardInPlace } from '@/lib/server/board-actions'

/**
 * A board's Allowed idea types on the save path (`contracts/boards.md` "Allowed idea types"), with
 * the HTTP client as the boundary: create carries the list in the board POST, an edit sets it with
 * its own PUT after the board PUT and only from a form that showed the control, and a refusal of
 * that second write must not hide that the board itself was saved.
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

function form(over: { boardId?: string | null; shown?: boolean; types?: string[] } = {}) {
  const data = new FormData()
  if (over.boardId !== null) data.set('boardId', over.boardId ?? 'b-1')
  data.set('name', 'Board')
  data.set('description', '')
  data.append('swimlaneIds', 's-1')
  data.append('swimlaneIds', 's-2')
  if (over.shown) data.set('allowedIdeaTypesShown', '1')
  for (const id of over.types ?? []) data.append('allowedIdeaTypeIds', id)
  return data
}

const putPaths = () => put.mock.calls.map((call) => String(call[0]))
const typesCall = () =>
  put.mock.calls.find((call) => String(call[0]).endsWith('/allowed-idea-types'))

beforeEach(() => {
  vi.mocked(apiPost).mockReset()
  put.mockReset().mockResolvedValue(undefined)
  create.mockReset().mockResolvedValue({ boardId: 'b-new' })
  revalidatePath.mockReset()
})

describe('creating a board with allowed idea types', () => {
  it('sends the ticked ids in the create request', async () => {
    await createBoardInPlace(IDLE, form({ boardId: null, shown: true, types: ['t-1', 't-2'] }))
    expect(create.mock.calls[0]?.[1]).toMatchObject({ allowedIdeaTypeIds: ['t-1', 't-2'] })
  })

  it('leaves the field out when nothing is ticked, so every type is allowed', async () => {
    await createBoardInPlace(IDLE, form({ boardId: null, shown: true, types: [] }))
    expect(create.mock.calls[0]?.[1]).not.toHaveProperty('allowedIdeaTypeIds')
  })

  it('leaves the field out when the form did not show the control', async () => {
    await createBoardInPlace(IDLE, form({ boardId: null, shown: false, types: ['t-1'] }))
    expect(create.mock.calls[0]?.[1]).not.toHaveProperty('allowedIdeaTypeIds')
  })

  it('shows a 400 keyed ideaTypeIds beside the control and leaves the banner empty', async () => {
    create.mockRejectedValue(
      new ApiError(400, '/boards', 'One or more fields are invalid.', {
        ideaTypeIds: "Idea type 'x' was not found.",
      }),
    )
    const result = await createBoardInPlace(
      IDLE,
      form({ boardId: null, shown: true, types: ['x'] }),
    )
    expect(result).toMatchObject({
      error: null,
      savedId: null,
      allowedIdeaTypes: "Idea type 'x' was not found.",
    })
  })
})

describe('saving a board with allowed idea types', () => {
  it('writes the board, then sets the list with its own PUT, and keeps the list out of the board body', async () => {
    const result = await saveBoardInPlace(IDLE, form({ shown: true, types: ['t-1'] }))
    expect(putPaths()).toEqual(['/boards/b-1', '/boards/b-1/allowed-idea-types'])
    expect(put.mock.calls[0]?.[1]).not.toHaveProperty('allowedIdeaTypeIds')
    expect(typesCall()?.[1]).toEqual({ ideaTypeIds: ['t-1'] })
    expect(result).toEqual({ error: null, savedId: 'b-1' })
  })

  it('sends an empty list when every box was unticked, which allows every type', async () => {
    await saveBoardInPlace(IDLE, form({ shown: true, types: [] }))
    expect(typesCall()?.[1]).toEqual({ ideaTypeIds: [] })
  })

  it('makes no types request when the control was not shown', async () => {
    await saveBoardInPlace(IDLE, form({ shown: false, types: ['t-1'] }))
    expect(putPaths()).toEqual(['/boards/b-1'])
  })

  it('stops after a refused board write without calling the types route', async () => {
    put.mockRejectedValueOnce(new ApiError(409, '/boards/b-1', 'The board is archived.'))
    const result = await saveBoardInPlace(IDLE, form({ shown: true, types: ['t-1'] }))
    expect(putPaths()).toEqual(['/boards/b-1'])
    expect(result.error).toBe('The board is archived.')
    expect(result.savedId).toBeNull()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('says the board was saved, shows the refusal by the control and revalidates when only the types are refused', async () => {
    put.mockResolvedValueOnce(undefined).mockRejectedValueOnce(
      new ApiError(400, '/boards/b-1/allowed-idea-types', 'One or more fields are invalid.', {
        ideaTypeIds: "Idea type 'x' was not found.",
      }),
    )
    const result = await saveBoardInPlace(IDLE, form({ shown: true, types: ['x'] }))
    expect(result.savedId).toBeNull()
    expect(result.error).toBeNull()
    expect(result.allowedIdeaTypes).toBe(
      "The board was saved, but its allowed idea types were not. Idea type 'x' was not found.",
    )
    expect(revalidatePath).toHaveBeenCalledWith('/boards/b-1')
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('prefixes a non-field refusal of the types write with the board-saved note, in the banner and by the control', async () => {
    put
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new ApiError(403, '/boards/b-1/allowed-idea-types', 'Not allowed.'))
    const result = await saveBoardInPlace(IDLE, form({ shown: true, types: ['t-1'] }))
    expect(result.error).toBe(
      'The board was saved, but its allowed idea types were not. Not allowed.',
    )
    expect(result.allowedIdeaTypes).toBeTruthy()
  })

  it('does not resend the board write after the types refusal', async () => {
    put
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new ApiError(409, '/boards/b-1/allowed-idea-types', 'Archived.'))
    await saveBoardInPlace(IDLE, form({ shown: true, types: ['t-1'] }))
    expect(putPaths()).toEqual(['/boards/b-1', '/boards/b-1/allowed-idea-types'])
  })

  it('serves the Settings save the same way: board PUT then types PUT, then the redirect', async () => {
    await expect(saveBoard({ error: null }, form({ shown: true, types: ['t-1'] }))).rejects.toThrow(
      'NEXT_REDIRECT /settings/boards',
    )
    expect(putPaths()).toEqual(['/boards/b-1', '/boards/b-1/allowed-idea-types'])
  })

  it('keeps the Settings form open with the refusal when only the types are refused', async () => {
    put
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(
        new ApiError(400, '/x', 'One or more fields are invalid.', { ideaTypeIds: 'Bad.' }),
      )
    const result = await saveBoard({ error: null }, form({ shown: true, types: ['t-1'] }))
    expect(result.allowedIdeaTypes).toContain('The board was saved')
  })
})
