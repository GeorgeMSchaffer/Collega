import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiPost } from '@/lib/api/client'
import { createFieldDefinition, reorderStatuses } from '@/lib/server/catalog-actions'
import { actingOrganizationId } from '@/lib/server/current-user'

/**
 * What two catalog writes post: create a custom field (slice 144, `POST …/field-definitions`) and
 * save the status order (slice 145, `POST …/statuses/reorder`), and how the API's refusals read
 * back. The HTTP client is the boundary.
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
const IDLE = {
  error: null,
  errors: {},
  name: '',
  description: '',
  fieldType: 'Text',
  required: false,
  created: false,
}

function formOf(entries: [string, string][]): FormData {
  const form = new FormData()
  for (const [key, value] of entries) form.append(key, value)
  return form
}

beforeEach(() => {
  post.mockReset()
  post.mockResolvedValue(undefined)
  revalidatePath.mockReset()
  vi.mocked(actingOrganizationId).mockResolvedValue('org-1')
})

describe('createFieldDefinition', () => {
  it('posts a Text field with no options, whatever option rows the form carried', async () => {
    await createFieldDefinition(
      IDLE,
      formOf([
        ['name', 'Cost centre'],
        ['description', 'Who pays'],
        ['fieldType', 'Text'],
        ['isRequired', 'on'],
        ['optionLabel', 'left over from a hidden Dropdown'],
      ]),
    )
    expect(post).toHaveBeenCalledExactlyOnceWith('/organizations/org-1/field-definitions', {
      name: 'Cost centre',
      description: 'Who pays',
      fieldType: 'Text',
      isRequired: true,
      options: [],
    })
  })

  it.each(['Number', 'Date', 'Boolean', 'Url'])('sends no options for a %s field', async (type) => {
    await createFieldDefinition(
      IDLE,
      formOf([
        ['name', 'F'],
        ['fieldType', type],
        ['optionLabel', 'stale'],
      ]),
    )
    expect(post.mock.calls[0]?.[1]).toMatchObject({ fieldType: type, options: [] })
  })

  it.each(['Dropdown', 'MultiSelect'])(
    'sends a %s field’s choices in order, trimmed, with blank rows dropped',
    async (type) => {
      await createFieldDefinition(
        IDLE,
        formOf([
          ['name', 'Region'],
          ['fieldType', type],
          ['optionLabel', ' North '],
          ['optionLabel', '   '],
          ['optionLabel', 'South'],
        ]),
      )
      expect(post.mock.calls[0]?.[1]).toMatchObject({
        fieldType: type,
        options: [
          { label: 'North', displayOrder: 0 },
          { label: 'South', displayOrder: 1 },
        ],
      })
    },
  )

  it('sends isRequired false when the box is unticked', async () => {
    await createFieldDefinition(
      IDLE,
      formOf([
        ['name', 'F'],
        ['fieldType', 'Text'],
      ]),
    )
    expect(post.mock.calls[0]?.[1]).toMatchObject({ isRequired: false })
  })

  it('never sends a display order, so the new field lands last', async () => {
    await createFieldDefinition(
      IDLE,
      formOf([
        ['name', 'F'],
        ['fieldType', 'Text'],
      ]),
    )
    expect(post.mock.calls[0]?.[1]).not.toHaveProperty('displayOrder')
  })

  it('resets the form and revalidates the field screens on success', async () => {
    const state = await createFieldDefinition(
      IDLE,
      formOf([
        ['name', 'F'],
        ['fieldType', 'Date'],
      ]),
    )
    expect(state).toEqual({
      error: null,
      errors: {},
      name: '',
      description: '',
      fieldType: 'Text',
      required: false,
      created: true,
    })
    for (const path of [
      '/settings/fields',
      '/settings/fieldsets',
      '/settings/idea-types',
      '/ideas',
    ]) {
      expect(revalidatePath).toHaveBeenCalledWith(path)
    }
  })

  it('keeps what was typed and returns the API’s field messages on a 400', async () => {
    post.mockRejectedValue(
      new ApiError(400, '/p', 'One or more validation errors occurred.', {
        fieldDefinition: 'A Dropdown field needs at least one option.',
      }),
    )
    const state = await createFieldDefinition(
      IDLE,
      formOf([
        ['name', 'Region'],
        ['description', 'Where'],
        ['fieldType', 'Dropdown'],
        ['isRequired', 'on'],
      ]),
    )
    expect(state).toMatchObject({
      name: 'Region',
      description: 'Where',
      fieldType: 'Dropdown',
      required: true,
      created: false,
      errors: { fieldDefinition: 'A Dropdown field needs at least one option.' },
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('names the missing organization instead of posting for a Site Admin', async () => {
    vi.mocked(actingOrganizationId).mockResolvedValue(null)
    const state = await createFieldDefinition(
      IDLE,
      formOf([
        ['name', 'F'],
        ['fieldType', 'Text'],
      ]),
    )
    expect(post).not.toHaveBeenCalled()
    expect(state.error).toContain('belongs to no organization')
    expect(state.created).toBe(false)
  })

  it('sends a 401 to the expired sign-in', async () => {
    post.mockRejectedValue(new ApiError(401, '/p', 'No.'))
    await expect(
      createFieldDefinition(
        IDLE,
        formOf([
          ['name', 'F'],
          ['fieldType', 'Text'],
        ]),
      ),
    ).rejects.toThrow('NEXT_REDIRECT /login?expired=1')
  })
})

describe('reorderStatuses', () => {
  it('posts the complete order to the acting organization’s route', async () => {
    expect(await reorderStatuses(['c', 'a', 'b'])).toEqual({ error: null })
    expect(post).toHaveBeenCalledExactlyOnceWith('/organizations/org-1/statuses/reorder', {
      orderedStatusIds: ['c', 'a', 'b'],
    })
  })

  it('revalidates the statuses screen and the board form that offers them', async () => {
    await reorderStatuses(['a', 'b'])
    expect(revalidatePath).toHaveBeenCalledWith('/settings/statuses')
    expect(revalidatePath).toHaveBeenCalledWith('/settings/boards')
  })

  it('returns the field message of a 400 rather than its generic title', async () => {
    post.mockRejectedValue(
      new ApiError(400, '/p', 'One or more validation errors occurred.', {
        orderedStatusIds: 'Name every active status exactly once.',
      }),
    )
    expect(await reorderStatuses(['a'])).toEqual({
      error: 'Name every active status exactly once.',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('returns the detail of a 403 with no field message', async () => {
    post.mockRejectedValue(new ApiError(403, '/p', 'Only an administrator may reorder.'))
    expect(await reorderStatuses(['a', 'b'])).toEqual({
      error: 'Only an administrator may reorder.',
    })
  })

  it('does not post for a Site Admin with no organization', async () => {
    vi.mocked(actingOrganizationId).mockResolvedValue(null)
    const result = await reorderStatuses(['a', 'b'])
    expect(post).not.toHaveBeenCalled()
    expect(result.error).toContain('belongs to no organization')
  })

  it('lets an unexpected failure through rather than reading it as a refusal', async () => {
    post.mockRejectedValue(new ApiError(500, '/p', 'boom'))
    await expect(reorderStatuses(['a', 'b'])).rejects.toBeInstanceOf(ApiError)
  })
})
