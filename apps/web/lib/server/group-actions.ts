'use server'

/**
 * Settings → Groups' writes: create, rename and re-describe, replace the members, delete
 * (`contracts/groups.md`). As in `tag-actions.ts`, nothing here reads the principal: who may write
 * is the API's decision, an Org Admin of the organization or a Site Admin through View As.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ApiError, apiDelete, apiPath, apiPostReturning, apiPut } from '../api/client'
import type { WireGroupDetail } from '../api/wire'
import { actingOrganizationId } from './current-user'

/** `errors` is the API's field-keyed 400 (`name`, `description`, `userIds`). */
export type GroupFormState = {
  error: string | null
  errors: Readonly<Record<string, string>>
  savedId: string | null
}

function refusal(error: unknown): Pick<GroupFormState, 'error' | 'errors'> {
  if (error instanceof ApiError) {
    if (error.status === 401) redirect('/login?expired=1')
    if (error.status === 400 && Object.keys(error.errors).length > 0) {
      return { error: null, errors: error.errors }
    }
    if ([400, 403, 404].includes(error.status)) return { error: error.detail, errors: {} }
  }
  throw error
}

/** A group's name shows in every board's access list, and its members decide who sees what. */
function revalidateGroupScreens(): void {
  revalidatePath('/', 'layout')
}

/** `groupId` null creates in the acting organization; otherwise saves that group and its members. */
export async function saveGroup(groupId: string | null, form: FormData): Promise<GroupFormState> {
  const details = {
    name: String(form.get('name') ?? ''),
    description: String(form.get('description') ?? ''),
  }
  const userIds = form.getAll('userIds').map(String)

  let savedId: string
  try {
    if (groupId === null) {
      const organizationId = await actingOrganizationId()
      if (organizationId === null) {
        return {
          error: 'An App Admin belongs to no organization. Use View As to add a group to one.',
          errors: {},
          savedId: null,
        }
      }
      const created = await apiPostReturning<WireGroupDetail>(
        apiPath`/organizations/${organizationId}/groups`,
        { ...details, userIds },
      )
      savedId = created.groupId
    } else {
      await apiPut(apiPath`/groups/${groupId}`, details)
      try {
        await apiPut(apiPath`/groups/${groupId}/members`, { userIds })
      } catch (error) {
        // The name and description are written by now, so the screens are stale either way.
        const refused = refusal(error)
        revalidateGroupScreens()
        return {
          error: `The name and description were saved, but the members were not.${refused.error ? ` ${refused.error}` : ''}`,
          errors: refused.errors,
          savedId: null,
        }
      }
      savedId = groupId
    }
  } catch (error) {
    return { ...refusal(error), savedId: null }
  }

  revalidateGroupScreens()
  return { error: null, errors: {}, savedId }
}

/** Removes the group, its memberships and every board grant naming it. */
export async function deleteGroup(groupId: string): Promise<{ error: string | null }> {
  try {
    await apiDelete(apiPath`/groups/${groupId}`)
  } catch (error) {
    return { error: refusal(error).error ?? 'The group could not be deleted.' }
  }

  revalidateGroupScreens()
  return { error: null }
}
