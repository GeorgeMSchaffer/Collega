'use server'

/**
 * The writes the organization's catalogs support from their settings screens: add a status, add an
 * idea type.
 *
 * ## Identity, and why nothing here reads a form for it
 *
 * The same rule `idea-actions.ts` states at length: a Server Function runs outside a render scope,
 * so `currentUser()` throws there and everything it needs arrives as a parameter or from the API.
 * These two routes differ from the idea writes in one way — they hang off `/organizations/{id}/…`,
 * so a request cannot be built without an organization id — and that id is deliberately *not* a
 * hidden field. `actingOrganizationId()` asks the API whose session this is; a form field would be
 * a value anyone could post a different one for, against a route whose whole scope is that id.
 *
 * The refusals are the API's own. `StatusService.ensureAdminScope` and `IdeaTypeService`'s
 * equivalent decide who may write, including refusing a Site Admin acting directly in favour of
 * View As, and a check here could only ever disagree with the one that counts.
 *
 * ## What is not here
 *
 * Rename, recolour, reorder and archive. Every one has an endpoint (`PUT /statuses/{id}`,
 * `POST …/statuses/reorder`, `DELETE /statuses/{id}`, and the idea-type equivalents), and comp P
 * puts rename and recolour behind the docked inspector and reorder behind drag-and-drop — neither
 * of which exists yet. The row `Edit` buttons stay inert until one does.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ApiError, apiPath, apiPost } from '../api/client'
import { actingOrganizationId } from './current-user'

/**
 * What a catalog's create form renders back.
 *
 * `name` is echoed for the reason `createIdea` echoes a title: React resets an uncontrolled form
 * once its action resolves, so a refused submission would otherwise blank what was just typed.
 */
export type CreateCatalogItemState = { error: string | null; name: string }

/**
 * A Site Admin belongs to no organization, so there is no catalog for this form to add to.
 *
 * A statement about the request rather than a copy of the API's authorization rule — there is
 * genuinely no organization id to build a path with, so there is no request to send and no refusal
 * to quote. Comp P routes the same role the same way on the board form.
 */
const NO_ORGANIZATION =
  'A Site Admin belongs to no organization, so there is no catalog to add to. Use View As to act ' +
  'as an administrator of one.'

/**
 * The message to show for a refusal, or a rethrow for anything that is not one — the same split
 * `idea-actions.ts` makes, and for the same reasons.
 */
function refusal(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) redirect('/login?expired=1')
    if (error.status === 400 || error.status === 403 || error.status === 404) return error.detail
  }
  throw error
}

/**
 * Adds a status to the organization's catalog (comp P `s-statuses`, "Add status").
 *
 * No `sortOrder`: omitting it appends after the current maximum (`SPEC/30-Contracts.md`), which is
 * where a new status belongs. Comp P's Position select offers "First" and "After <status>" as well,
 * and both are a *reorder* of the whole catalog rather than a property of the new row — the API
 * models them that way too, with `POST …/statuses/reorder` replacing the complete order atomically.
 *
 * `/boards` and every board page are revalidated as well as this screen: a status is a lane
 * everywhere it appears, and the swimlane picker on the board form reads the same catalog.
 */
export async function createStatus(
  _previous: CreateCatalogItemState,
  form: FormData,
): Promise<CreateCatalogItemState> {
  const name = String(form.get('name') ?? '')

  const organizationId = await actingOrganizationId()
  if (organizationId === null) return { error: NO_ORGANIZATION, name }

  try {
    await apiPost(apiPath`/organizations/${organizationId}/statuses`, {
      name,
      color: String(form.get('color') ?? ''),
    })
  } catch (error) {
    return { error: refusal(error), name }
  }

  revalidatePath('/settings/statuses')
  revalidatePath('/settings/boards')
  return { error: null, name: '' }
}

/**
 * Adds an idea type to the organization's catalog (comp P `s-idea-types`, "Add idea type").
 *
 * Name only. A new type starts in `AllActiveFields` mode, so it shows every active custom field
 * without being told which — the curated selection is a separate route (`PUT …/{id}/fields`) and a
 * separate screen. Appearance is the same: `PUT …/{id}/appearance` sets the badge, and comp P puts
 * it on the type's own detail rather than on the create form.
 *
 * `/ideas` and the boards are revalidated too: the create-idea form's type picker reads this
 * catalog, and a new type is a new option on it.
 */
export async function createIdeaType(
  _previous: CreateCatalogItemState,
  form: FormData,
): Promise<CreateCatalogItemState> {
  const name = String(form.get('name') ?? '')

  const organizationId = await actingOrganizationId()
  if (organizationId === null) return { error: NO_ORGANIZATION, name }

  try {
    await apiPost(apiPath`/organizations/${organizationId}/idea-types`, { name })
  } catch (error) {
    return { error: refusal(error), name }
  }

  revalidatePath('/settings/idea-types')
  revalidatePath('/ideas')
  return { error: null, name: '' }
}
