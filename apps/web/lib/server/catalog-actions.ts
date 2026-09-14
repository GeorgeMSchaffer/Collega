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
 * Reorder, for either catalog (`POST …/statuses/reorder`, `POST …/idea-types/reorder`). Comp P puts
 * it behind drag-and-drop, which does not exist yet, and both routes replace the whole order at
 * once rather than moving one row — so there is nothing to call until something can express an
 * order. Also absent: an idea type's curated field selection and its badge appearance, which are
 * separate routes and separate screens.
 *
 * Renaming and archiving both catalogs DO live here, on small pages of their own rather than in
 * comp P's docked inspector. That is a deliberate downgrade: the inspector is a larger piece of
 * work than the writes it wraps, and a catalog nobody can correct is worse than one corrected on a
 * plain page. The inspector can replace those pages later without touching these actions.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ApiError, apiDelete, apiPath, apiPost, apiPut } from '../api/client'
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

/** What the edit form renders back. No echo: the page re-reads the row it is editing. */
export type EditCatalogItemState = { error: string | null }

/**
 * Renames or recolours one status (`PUT /statuses/{id}`).
 *
 * No `sortOrder`, and that is load-bearing rather than an omission: the contract treats an absent
 * `sortOrder` as "leave it where it is", so this cannot silently reorder a catalog while renaming
 * a lane in it. Ordering is `POST …/statuses/reorder`, which replaces the whole order at once.
 *
 * Unlike the create actions this needs no organization id — the status id addresses the row, and
 * the API resolves scope from it. So there is nothing here for a Site Admin to be missing, and the
 * refusal they get is the API's own `ensureAdminScope` rather than a statement this file invents.
 */
export async function updateStatus(
  _previous: EditCatalogItemState,
  form: FormData,
): Promise<EditCatalogItemState> {
  const statusId = String(form.get('statusId') ?? '')

  try {
    await apiPut(apiPath`/statuses/${statusId}`, {
      name: String(form.get('name') ?? ''),
      color: String(form.get('color') ?? ''),
    })
  } catch (error) {
    return { error: refusal(error) }
  }

  revalidateCatalog()
  redirect('/settings/statuses')
}

/**
 * Archives one status (`DELETE /statuses/{id}`).
 *
 * A soft delete: existing ideas keep resolving the status they are in, so this removes a lane from
 * the board rather than rewriting history. The API refuses to archive the last remaining one.
 */
export async function deleteStatus(
  _previous: EditCatalogItemState,
  form: FormData,
): Promise<EditCatalogItemState> {
  const statusId = String(form.get('statusId') ?? '')

  try {
    await apiDelete(apiPath`/statuses/${statusId}`)
  } catch (error) {
    return { error: refusal(error) }
  }

  revalidateCatalog()
  redirect('/settings/statuses')
}

/** Everywhere a status is a lane, which is everywhere a board is drawn. */
function revalidateCatalog(): void {
  revalidatePath('/settings/statuses')
  revalidatePath('/settings/boards')
  revalidatePath('/boards', 'layout')
}

/**
 * Renames one idea type (`PUT /idea-types/{id}`).
 *
 * Name only, and no `sortOrder`, for the reason `updateStatus` sends none: absent means "leave it",
 * so renaming cannot reorder the catalog as a side effect.
 *
 * It deliberately does not touch the type's curated field selection either. That is
 * `PUT …/{id}/fields`, it replaces the whole selection, and a rename form that posted an empty one
 * would silently turn a curated type back into "every active field".
 */
export async function updateIdeaType(
  _previous: EditCatalogItemState,
  form: FormData,
): Promise<EditCatalogItemState> {
  const ideaTypeId = String(form.get('ideaTypeId') ?? '')

  try {
    await apiPut(apiPath`/idea-types/${ideaTypeId}`, { name: String(form.get('name') ?? '') })
  } catch (error) {
    return { error: refusal(error) }
  }

  revalidateIdeaTypes()
  redirect('/settings/idea-types')
}

/**
 * Archives one idea type (`DELETE /idea-types/{id}`).
 *
 * Soft, like the status equivalent: ideas already of this type keep resolving it, so the option
 * leaves the create form rather than the record leaving the database.
 */
export async function deleteIdeaType(
  _previous: EditCatalogItemState,
  form: FormData,
): Promise<EditCatalogItemState> {
  const ideaTypeId = String(form.get('ideaTypeId') ?? '')

  try {
    await apiDelete(apiPath`/idea-types/${ideaTypeId}`)
  } catch (error) {
    return { error: refusal(error) }
  }

  revalidateIdeaTypes()
  redirect('/settings/idea-types')
}

/** The catalog screen, and the create-idea form whose type picker reads the same list. */
function revalidateIdeaTypes(): void {
  revalidatePath('/settings/idea-types')
  revalidatePath('/ideas')
}

/**
 * Edits one custom field (`PUT /organizations/{orgId}/field-definitions/{id}`).
 *
 * **The options are the dangerous part, and the reason this action is longer than the others.**
 * The route replaces them wholesale: an option posted with its `optionId` keeps its identity and
 * every idea value referencing it, an option posted without one is created, and an option simply
 * not posted is *deleted along with those values*. So the form renders every existing option and
 * this reassembles the complete list — an empty `options` on a Dropdown would silently empty it.
 *
 * `fieldType` is posted back unchanged because the service refuses to change it after creation, and
 * `displayOrder` because omitting it would move the field to the front of the list as a side effect
 * of renaming it.
 *
 * Blank labels are dropped rather than sent. That is what makes the trailing empty row on the form
 * an "add one" affordance instead of a validation failure: `fieldDefinitionBodyRules` marks every
 * option label required, so an untouched blank row would be a 400 on a form nobody typed in.
 */
export async function updateFieldDefinition(
  _previous: EditCatalogItemState,
  form: FormData,
): Promise<EditCatalogItemState> {
  const fieldDefinitionId = String(form.get('fieldDefinitionId') ?? '')

  const organizationId = await actingOrganizationId()
  if (organizationId === null) return { error: NO_ORGANIZATION }

  const options = form
    .getAll('optionLabel')
    .map((label, index) => ({
      // Empty means a row the form rendered blank for adding, so there is no option to target.
      optionId: String(form.getAll('optionId')[index] ?? '') || null,
      label: String(label).trim(),
      displayOrder: index,
    }))
    .filter((option) => option.label !== '')

  try {
    await apiPut(apiPath`/organizations/${organizationId}/field-definitions/${fieldDefinitionId}`, {
      name: String(form.get('name') ?? ''),
      description: String(form.get('description') ?? ''),
      fieldType: String(form.get('fieldType') ?? ''),
      isRequired: form.get('isRequired') === 'on',
      displayOrder: Number(form.get('displayOrder') ?? 0),
      options,
    })
  } catch (error) {
    return { error: refusal(error) }
  }

  revalidateFields()
  redirect('/settings/fields')
}

/**
 * Archives one custom field (`DELETE /organizations/{orgId}/field-definitions/{id}`).
 *
 * Soft, like every other archive here: the values ideas already carry for this field keep
 * resolving, and the field stops being asked for on the create form.
 */
export async function deleteFieldDefinition(
  _previous: EditCatalogItemState,
  form: FormData,
): Promise<EditCatalogItemState> {
  const fieldDefinitionId = String(form.get('fieldDefinitionId') ?? '')

  const organizationId = await actingOrganizationId()
  if (organizationId === null) return { error: NO_ORGANIZATION }

  try {
    await apiDelete(
      apiPath`/organizations/${organizationId}/field-definitions/${fieldDefinitionId}`,
    )
  } catch (error) {
    return { error: refusal(error) }
  }

  revalidateFields()
  redirect('/settings/fields')
}

/** The field list, and the idea screens whose forms ask for these fields. */
function revalidateFields(): void {
  revalidatePath('/settings/fields')
  revalidatePath('/settings/idea-types')
  revalidatePath('/ideas')
}
