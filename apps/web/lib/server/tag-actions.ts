'use server'

/**
 * Settings → Tags' writes: add a tag in advance, rename or recolour one, delete one
 * (`20-feature-ideas-and-engagement.md` rules 13–15; `30-Contracts.md` "Tag colour and management").
 *
 * Identity follows `idea-actions.ts`: nothing here reads the principal. `tagId` is bound by the
 * screen; the create path's organization is asked of the API (`actingOrganizationId`). Who may
 * write is the API's decision — an in-scope Org Admin, never a Site Admin acting directly.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ApiError, apiDelete, apiPath, apiPostReturning, apiPut } from '../api/client'
import type { WireTagItem } from '../api/wire'
import { actingOrganizationId } from './current-user'

/**
 * What the tag form renders back. `errors` carries the API's field-keyed 400 (`name`, `color`) for
 * the form to put beside each control; `savedId` is the tag written, the drawer's cue to show it.
 */
export type TagFormState = {
  error: string | null
  errors: Readonly<Record<string, string>>
  savedId: string | null
}

function refusal(error: unknown): Pick<TagFormState, 'error' | 'errors'> {
  if (error instanceof ApiError) {
    if (error.status === 401) redirect('/login?expired=1')
    if (error.status === 400 && Object.keys(error.errors).length > 0) {
      return { error: null, errors: error.errors }
    }
    if ([400, 403, 404].includes(error.status)) return { error: error.detail, errors: {} }
  }
  throw error
}

/** A tag's name and colour appear on every idea and board that carries it. */
function revalidateTagScreens(): void {
  revalidatePath('/settings/tags')
  revalidatePath('/ideas')
  revalidatePath('/boards', 'layout')
}

function tagBody(form: FormData): { name: string; color: string } {
  return {
    name: String(form.get('name') ?? ''),
    color: String(form.get('color') ?? ''),
  }
}

/** `tagId` null creates in the acting organization; otherwise renames and recolours that tag. */
export async function saveTag(tagId: string | null, form: FormData): Promise<TagFormState> {
  let savedId: string
  try {
    if (tagId === null) {
      const organizationId = await actingOrganizationId()
      if (organizationId === null) {
        return {
          error: 'An App Admin belongs to no organization. Use View As to add a tag to one.',
          errors: {},
          savedId: null,
        }
      }
      const created = await apiPostReturning<WireTagItem>(
        apiPath`/organizations/${organizationId}/tags`,
        tagBody(form),
      )
      savedId = created.tagId
    } else {
      await apiPut(apiPath`/tags/${tagId}`, tagBody(form))
      savedId = tagId
    }
  } catch (error) {
    return { ...refusal(error), savedId: null }
  }

  revalidateTagScreens()
  return { error: null, errors: {}, savedId }
}

/** Removes the tag from every idea that carries it, then the tag (rule 15). */
export async function deleteTag(tagId: string): Promise<{ error: string | null }> {
  try {
    await apiDelete(apiPath`/tags/${tagId}`)
  } catch (error) {
    return { error: refusal(error).error ?? 'The tag could not be deleted.' }
  }

  revalidateTagScreens()
  return { error: null }
}
