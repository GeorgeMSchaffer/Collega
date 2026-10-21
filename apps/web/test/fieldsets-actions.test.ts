import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiDelete, apiPut } from '@/lib/api/client'
import { deleteFieldset, saveIdeaTypeFields, updateFieldset } from '@/lib/server/catalog-actions'
import { actingOrganizationId } from '@/lib/server/current-user'

/**
 * What the fieldset screens post (`SPEC/contracts/fieldsets.md`): the idea-type picker's parallel
 * lists become one `PUT …/fields`, a fieldset's save is two requests with the details first, and a
 * delete refused while attached shows the API's own sentence. The HTTP client is the boundary.
 */
vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}))
vi.mock('@/lib/server/current-user', () => ({ actingOrganizationId: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`)
  },
}))

const put = vi.mocked(apiPut)
const del = vi.mocked(apiDelete)
const IDLE = { error: null }

function formOf(entries: [string, string][]): FormData {
  const form = new FormData()
  for (const [key, value] of entries) form.append(key, value)
  return form
}

beforeEach(() => {
  put.mockReset()
  del.mockReset()
  put.mockResolvedValue(undefined)
  del.mockResolvedValue(undefined)
  vi.mocked(actingOrganizationId).mockResolvedValue('org-1')
})

describe('saveIdeaTypeFields', () => {
  it('sends the fields in display order with their own Required flags, and the fieldsets in attach order', async () => {
    await expect(
      saveIdeaTypeFields(
        IDLE,
        formOf([
          ['ideaTypeId', 'type-1'],
          ['fieldDefinitionId', 'f-a'],
          ['fieldRequired', '1'],
          ['fieldDefinitionId', 'f-b'],
          ['fieldRequired', '0'],
          ['fieldsetId', 's-2'],
          ['fieldsetId', 's-1'],
        ]),
      ),
    ).rejects.toThrow('NEXT_REDIRECT /settings/idea-types')

    expect(put).toHaveBeenCalledExactlyOnceWith('/organizations/org-1/idea-types/type-1/fields', {
      fields: [
        { fieldDefinitionId: 'f-a', displayOrder: 10, isRequired: true },
        { fieldDefinitionId: 'f-b', displayOrder: 20, isRequired: false },
      ],
      fieldsetIds: ['s-2', 's-1'],
    })
  })

  it('sends empty lists for an empty selection, which clears the type back to every active field', async () => {
    await expect(saveIdeaTypeFields(IDLE, formOf([['ideaTypeId', 'type-1']]))).rejects.toThrow(
      'NEXT_REDIRECT',
    )

    expect(put.mock.calls[0]?.[1]).toEqual({ fields: [], fieldsetIds: [] })
  })

  it('shows the API’s sentence for a refusal and does not redirect', async () => {
    put.mockRejectedValue(new ApiError(400, '/x', 'Fieldset not found.'))

    expect(await saveIdeaTypeFields(IDLE, formOf([['ideaTypeId', 'type-1']]))).toEqual({
      error: 'Fieldset not found.',
    })
  })

  it('refuses an App Admin without calling the API', async () => {
    vi.mocked(actingOrganizationId).mockResolvedValue(null)

    const result = await saveIdeaTypeFields(IDLE, formOf([['ideaTypeId', 'type-1']]))

    expect(result.error).toContain('belongs to no organization')
    expect(put).not.toHaveBeenCalled()
  })
})

describe('updateFieldset', () => {
  const form = () =>
    formOf([
      ['fieldsetId', 'set-1'],
      ['name', 'Delivery'],
      ['description', 'Cost and date'],
      ['fieldDefinitionId', 'f-b'],
      ['fieldDefinitionId', 'f-a'],
    ])

  it('saves the details, then the members in the order posted', async () => {
    await expect(updateFieldset(IDLE, form())).rejects.toThrow('NEXT_REDIRECT /settings/fieldsets')

    expect(put).toHaveBeenNthCalledWith(1, '/organizations/org-1/fieldsets/set-1', {
      name: 'Delivery',
      description: 'Cost and date',
    })
    expect(put).toHaveBeenNthCalledWith(2, '/organizations/org-1/fieldsets/set-1/fields', {
      fieldDefinitionIds: ['f-b', 'f-a'],
    })
  })

  it('leaves the membership untouched when the details are refused', async () => {
    put.mockRejectedValueOnce(
      new ApiError(400, '/x', "A fieldset named 'Delivery' already exists in this organization."),
    )

    const result = await updateFieldset(IDLE, form())

    expect(result.error).toContain('already exists')
    expect(put).toHaveBeenCalledTimes(1)
  })
})

describe('deleteFieldset', () => {
  it('shows the API’s 409 sentence while idea types still use the set', async () => {
    del.mockRejectedValue(
      new ApiError(
        409,
        '/x',
        'This fieldset is used by 2 idea type(s). Remove it from them first.',
      ),
    )

    expect(await deleteFieldset(IDLE, formOf([['fieldsetId', 'set-1']]))).toEqual({
      error: 'This fieldset is used by 2 idea type(s). Remove it from them first.',
    })
  })

  it('goes back to the list once deleted', async () => {
    await expect(deleteFieldset(IDLE, formOf([['fieldsetId', 'set-1']]))).rejects.toThrow(
      'NEXT_REDIRECT /settings/fieldsets',
    )
    expect(del).toHaveBeenCalledExactlyOnceWith('/organizations/org-1/fieldsets/set-1')
  })
})
