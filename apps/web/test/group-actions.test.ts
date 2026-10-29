import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiDelete, apiPostReturning, apiPut } from '@/lib/api/client'
import { actingOrganizationId } from '@/lib/server/current-user'
import { deleteGroup, saveGroup } from '@/lib/server/group-actions'

/**
 * Settings → Groups' writes (`contracts/groups.md`), with the HTTP client as the boundary: create
 * posts to the acting organization with its members, an edit writes the details then replaces the
 * members, and a refusal reads back field by field or in the banner.
 */
vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  apiPostReturning: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}))
vi.mock('@/lib/server/current-user', () => ({ actingOrganizationId: vi.fn() }))
const revalidatePath = vi.hoisted(() => vi.fn())
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`)
  },
}))

const put = vi.mocked(apiPut)
const post = vi.mocked(apiPostReturning)

function form(users: string[] = ['u-1', 'u-2']) {
  const data = new FormData()
  data.set('name', 'Core team')
  data.set('description', 'Product core')
  for (const id of users) data.append('userIds', id)
  return data
}

beforeEach(() => {
  put.mockReset().mockResolvedValue(undefined)
  post.mockReset().mockResolvedValue({ groupId: 'g-new' })
  vi.mocked(apiDelete).mockReset().mockResolvedValue(undefined)
  vi.mocked(actingOrganizationId).mockReset().mockResolvedValue('org-1')
  revalidatePath.mockReset()
})

describe('saveGroup', () => {
  it('creates in the acting organization with the members in the request', async () => {
    const result = await saveGroup(null, form())
    expect(post).toHaveBeenCalledWith('/organizations/org-1/groups', {
      name: 'Core team',
      description: 'Product core',
      userIds: ['u-1', 'u-2'],
    })
    expect(result).toEqual({ error: null, errors: {}, savedId: 'g-new' })
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('points an App Admin, who has no organization, at View As', async () => {
    vi.mocked(actingOrganizationId).mockResolvedValue(null)
    const result = await saveGroup(null, form())
    expect(result.error).toMatch(/View As/)
    expect(post).not.toHaveBeenCalled()
  })

  it('writes the details, then replaces the members', async () => {
    const result = await saveGroup('g-1', form(['u-3']))
    expect(put.mock.calls.map((call) => [call[0], call[1]])).toEqual([
      ['/groups/g-1', { name: 'Core team', description: 'Product core' }],
      ['/groups/g-1/members', { userIds: ['u-3'] }],
    ])
    expect(result).toEqual({ error: null, errors: {}, savedId: 'g-1' })
  })

  it('sends an empty member list when everyone was removed', async () => {
    await saveGroup('g-1', form([]))
    expect(put.mock.calls[1]?.[1]).toEqual({ userIds: [] })
  })

  it('returns a 400 keyed by field for the fields, with no banner', async () => {
    post.mockRejectedValue(
      new ApiError(400, '/organizations/org-1/groups', 'Invalid.', { name: 'Name is taken.' }),
    )
    expect(await saveGroup(null, form())).toEqual({
      error: null,
      errors: { name: 'Name is taken.' },
      savedId: null,
    })
  })

  it('says the details were saved when only the members are refused, and revalidates', async () => {
    put
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new ApiError(400, '/groups/g-1/members', 'Invalid.', { userIds: 'Unknown user.' }))
    const result = await saveGroup('g-1', form())
    expect(result.savedId).toBeNull()
    expect(result.error).toContain('The name and description were saved, but the members were not.')
    expect(result.errors).toEqual({ userIds: 'Unknown user.' })
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('shows a 403 in the banner', async () => {
    put.mockRejectedValueOnce(new ApiError(403, '/groups/g-1', 'Only an Org Admin can change groups.'))
    expect(await saveGroup('g-1', form())).toEqual({
      error: 'Only an Org Admin can change groups.',
      errors: {},
      savedId: null,
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('sends an expired session to sign-in', async () => {
    put.mockRejectedValueOnce(new ApiError(401, '/groups/g-1', 'Expired.'))
    await expect(saveGroup('g-1', form())).rejects.toThrow('NEXT_REDIRECT /login?expired=1')
  })
})

describe('deleteGroup', () => {
  it('deletes and revalidates', async () => {
    expect(await deleteGroup('g-1')).toEqual({ error: null })
    expect(apiDelete).toHaveBeenCalledWith('/groups/g-1')
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('returns the refusal', async () => {
    vi.mocked(apiDelete).mockRejectedValue(new ApiError(404, '/groups/g-1', 'Group not found.'))
    expect(await deleteGroup('g-1')).toEqual({ error: 'Group not found.' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
