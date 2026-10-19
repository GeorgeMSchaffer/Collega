import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiPost, apiPostReturning, apiPut } from '@/lib/api/client'
import { createBoardInPlace, saveBoard, saveBoardInPlace } from '@/lib/server/board-actions'
import { KEY_PREFIX_RULE, ruleMessage } from '@/lib/server/rule-messages'

/**
 * The board save's Board References behaviour (slice 288) with the HTTP client as the boundary:
 * the payload the form builds, which refusals land on a field or a lane and which stay in the
 * banner, and what a successful save revalidates. `rule-messages` is pure and covered directly.
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
const post = vi.mocked(apiPost)
const IDLE = { error: null, savedId: null }

type Flags = { isFinal?: boolean; referencesBoardId?: string | null; autoCreateTask?: boolean }

function form(
  over: {
    boardId?: string | null
    flags?: Record<string, Flags>
    keyPrefix?: string
    ideaFeatures?: string
    lanes?: string[]
  } = {},
) {
  const data = new FormData()
  if (over.boardId !== null) data.set('boardId', over.boardId ?? 'b-1')
  data.set('name', 'Board')
  data.set('description', '')
  for (const lane of over.lanes ?? ['s-1', 's-2']) data.append('swimlaneIds', lane)
  if (over.flags) data.set('laneFlags', JSON.stringify(over.flags))
  if (over.keyPrefix !== undefined) data.set('keyPrefix', over.keyPrefix)
  if (over.ideaFeatures !== undefined) data.set('ideaFeaturesEnabled', over.ideaFeatures)
  return data
}

const body = () => put.mock.calls[0]?.[1] as Record<string, unknown>

beforeEach(() => {
  put.mockReset().mockResolvedValue(undefined)
  create.mockReset().mockResolvedValue({ boardId: 'b-new' })
  post.mockReset()
  revalidatePath.mockReset()
})

describe('ruleMessage', () => {
  it.each([
    ['laneReferencesOwnBoard', 'A lane can’t reference its own board.'],
    ['referenceChainNotAllowed', 'Only one level of references is allowed.'],
    [
      'laneInUse',
      'A lane with ideas in it can’t have its reference changed or removed, and can’t be removed.',
    ],
    ['referenceTargetArchived', 'A board that a lane references can’t be archived.'],
    ['referencesBoardInvalid', 'A lane can reference only an active board of this organization.'],
    ['finalLaneCannotReference', 'A Final lane can’t reference a board.'],
    ['autoCreateTaskRequiresReference', 'Auto-create needs a referenced board.'],
    ['keyPrefixLocked', 'Keys have been issued on this board, so the prefix can’t change.'],
  ])('turns the rule key %s into its plain sentence', (key, message) => {
    expect(ruleMessage(key)).toBe(message)
  })

  it('shows an unknown key as it came', () => {
    expect(ruleMessage('somethingNew')).toBe('somethingNew')
  })

  it('states the key prefix rule in comp U’s words', () => {
    expect(KEY_PREFIX_RULE).toBe('Use 2 to 10 letters or digits, A to Z and 0 to 9.')
  })
})

describe('the board payload', () => {
  it('sends each lane its flags, the key prefix and the idea-features value', async () => {
    await saveBoardInPlace(
      IDLE,
      form({
        keyPrefix: 'IMPL',
        ideaFeatures: 'false',
        flags: {
          's-1': { isFinal: true },
          's-2': { referencesBoardId: 'b-t', autoCreateTask: true },
        },
      }),
    )
    expect(body()).toMatchObject({
      keyPrefix: 'IMPL',
      ideaFeaturesEnabled: false,
      swimlanes: [
        {
          statusId: 's-1',
          order: 0,
          isFinal: true,
          referencesBoardId: null,
          autoCreateTask: false,
        },
        {
          statusId: 's-2',
          order: 1,
          isFinal: false,
          referencesBoardId: 'b-t',
          autoCreateTask: true,
        },
      ],
    })
  })

  it('sends a blank key prefix as null, which clears it', async () => {
    await saveBoardInPlace(IDLE, form({ keyPrefix: '  ' }))
    expect(body().keyPrefix).toBeNull()
  })

  it('trims a key prefix', async () => {
    await saveBoardInPlace(IDLE, form({ keyPrefix: ' IMPL ' }))
    expect(body().keyPrefix).toBe('IMPL')
  })

  it('leaves the key prefix and idea features out when the form has neither field', async () => {
    await saveBoardInPlace(IDLE, form())
    expect(body()).not.toHaveProperty('keyPrefix')
    expect(body()).not.toHaveProperty('ideaFeaturesEnabled')
  })

  it('reads ideaFeaturesEnabled true from the string "true"', async () => {
    await saveBoardInPlace(IDLE, form({ ideaFeatures: 'true' }))
    expect(body().ideaFeaturesEnabled).toBe(true)
  })

  it('posts the same body shape on create, to the organization’s boards', async () => {
    const result = await createBoardInPlace(
      IDLE,
      form({ boardId: null, keyPrefix: 'IMPL', flags: { 's-1': { isFinal: true } } }),
    )
    expect(result).toEqual({ error: null, savedId: 'b-new' })
    expect(create.mock.calls[0]?.[0]).toBe('/organizations/org-1/boards')
    expect(create.mock.calls[0]?.[1]).toMatchObject({
      keyPrefix: 'IMPL',
      swimlanes: [
        { statusId: 's-1', isFinal: true },
        { statusId: 's-2', isFinal: false },
      ],
    })
  })
})

describe('revalidation', () => {
  it('revalidates the board and the layout after a save', async () => {
    await saveBoardInPlace(IDLE, form({ boardId: 'b 1' }))
    expect(revalidatePath).toHaveBeenCalledWith('/boards/b%201')
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('revalidates the layout after a create', async () => {
    await createBoardInPlace(IDLE, form({ boardId: null }))
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('revalidates nothing when the save is refused', async () => {
    put.mockRejectedValue(new ApiError(422, '/boards/b-1', 'laneInUse'))
    await saveBoardInPlace(IDLE, form())
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('redirects to the boards list after a settings-page save', async () => {
    await expect(saveBoard({ error: null }, form())).rejects.toThrow(
      'NEXT_REDIRECT /settings/boards',
    )
  })
})

describe('key prefix refusals', () => {
  it('maps a 409 keyPrefixTaken to the field, naming the upper-cased prefix', async () => {
    put.mockRejectedValue(new ApiError(409, '/boards/b-1', 'keyPrefixTaken'))
    expect(await saveBoardInPlace(IDLE, form({ keyPrefix: 'impl' }))).toEqual({
      error: null,
      savedId: null,
      pullErrors: [],
      keyPrefix: { message: 'IMPL is already used by another board.', locked: false },
    })
  })

  it('maps a 422 keyPrefixLocked to a locked field with the rule sentence, not the banner', async () => {
    put.mockRejectedValue(new ApiError(422, '/boards/b-1', 'keyPrefixLocked'))
    expect(await saveBoardInPlace(IDLE, form({ keyPrefix: 'IMPL' }))).toEqual({
      error: null,
      savedId: null,
      pullErrors: [],
      keyPrefix: {
        message: 'Keys have been issued on this board, so the prefix can’t change.',
        locked: true,
      },
    })
  })

  it('maps a 400 on keyPrefix to the rule sentence on the field', async () => {
    put.mockRejectedValue(new ApiError(400, '/boards/b-1', 'Validation', { keyPrefix: 'bad' }))
    const result = await saveBoardInPlace(IDLE, form({ keyPrefix: '!' }))
    expect(result.keyPrefix).toEqual({ message: KEY_PREFIX_RULE, locked: false })
    expect(result.error).toBeNull()
  })

  it('shows a keyPrefixTaken on create the same way', async () => {
    create.mockRejectedValue(new ApiError(409, '/organizations/org-1/boards', 'keyPrefixTaken'))
    const result = await createBoardInPlace(IDLE, form({ boardId: null, keyPrefix: 'ab' }))
    expect(result.keyPrefix?.message).toBe('AB is already used by another board.')
  })
})

describe('lane refusals', () => {
  it('pins finalLaneCannotReference to the Final lane that references a board', async () => {
    put.mockRejectedValue(new ApiError(422, '/boards/b-1', 'finalLaneCannotReference'))
    const result = await saveBoardInPlace(
      IDLE,
      form({
        flags: { 's-1': { isFinal: true, referencesBoardId: 'b-t' }, 's-2': { isFinal: true } },
      }),
    )
    expect(result.error).toBeNull()
    expect(result.laneErrors).toEqual({ 's-1': 'A Final lane can’t reference a board.' })
  })

  it('pins autoCreateTaskRequiresReference to the lane with the switch on and no reference', async () => {
    put.mockRejectedValue(new ApiError(422, '/boards/b-1', 'autoCreateTaskRequiresReference'))
    const result = await saveBoardInPlace(
      IDLE,
      form({
        flags: {
          's-1': { referencesBoardId: 'b-t', autoCreateTask: true },
          's-2': { autoCreateTask: true },
        },
      }),
    )
    expect(result.laneErrors).toEqual({ 's-2': 'Auto-create needs a referenced board.' })
  })

  it('pins laneReferencesOwnBoard to the lane naming the board being saved', async () => {
    put.mockRejectedValue(new ApiError(422, '/boards/b-1', 'laneReferencesOwnBoard'))
    const result = await saveBoardInPlace(
      IDLE,
      form({ boardId: 'b-1', flags: { 's-2': { referencesBoardId: 'b-1' } } }),
    )
    expect(result.laneErrors).toEqual({ 's-2': 'A lane can’t reference its own board.' })
  })

  it('does not pin laneReferencesOwnBoard on create, where there is no own board', async () => {
    create.mockRejectedValue(new ApiError(422, '/x', 'laneReferencesOwnBoard'))
    const result = await createBoardInPlace(
      IDLE,
      form({ boardId: null, flags: { 's-2': { referencesBoardId: '' } } }),
    )
    expect(result.laneErrors).toBeUndefined()
    expect(result.error).toBe('A lane can’t reference its own board.')
  })

  it.each([
    [
      'laneInUse',
      'A lane with ideas in it can’t have its reference changed or removed, and can’t be removed.',
    ],
    ['referenceChainNotAllowed', 'Only one level of references is allowed.'],
    ['referencesBoardInvalid', 'A lane can reference only an active board of this organization.'],
    ['referenceTargetArchived', 'A board that a lane references can’t be archived.'],
  ])('keeps %s in the banner as its plain sentence, never the bare key', async (rule, message) => {
    put.mockRejectedValue(new ApiError(422, '/boards/b-1', rule))
    const result = await saveBoardInPlace(
      IDLE,
      form({ flags: { 's-1': { isFinal: true, referencesBoardId: 'b-t', autoCreateTask: true } } }),
    )
    expect(result.error).toBe(message)
    expect(result.error).not.toBe(rule)
    expect(result.laneErrors).toBeUndefined()
  })

  it('falls back to the banner when the rule cannot be attributed to any submitted lane', async () => {
    put.mockRejectedValue(new ApiError(422, '/boards/b-1', 'finalLaneCannotReference'))
    const result = await saveBoardInPlace(IDLE, form({ flags: { 's-1': { isFinal: true } } }))
    expect(result.error).toBe('A Final lane can’t reference a board.')
    expect(result.laneErrors).toBeUndefined()
  })

  it('rethrows an unexpected failure', async () => {
    put.mockRejectedValue(new ApiError(500, '/boards/b-1', 'boom'))
    await expect(saveBoardInPlace(IDLE, form())).rejects.toBeInstanceOf(ApiError)
  })
})
