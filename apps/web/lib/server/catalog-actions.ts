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
 * Reordering idea types (`POST …/idea-types/reorder`): nothing expresses an order for that catalog
 * yet. Statuses reorder below. Also absent: an idea type's badge appearance, a separate route and screen. The curated field and
 * fieldset selection is `saveIdeaTypeFields` below, deliberately apart from the rename.
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
 * `name` is echoed because React resets an uncontrolled form once its action resolves, so a refused
 * submission would otherwise blank what was just typed.
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
 * Replaces the organization's status order (`POST …/statuses/reorder`).
 *
 * The route takes the complete order of the active statuses, so the grid sends the whole list after
 * every drop or move. A stale page, one missing a status added elsewhere, gets the API's refusal.
 */
export async function reorderStatuses(
  orderedStatusIds: string[],
): Promise<{ error: string | null }> {
  const organizationId = await actingOrganizationId()
  if (organizationId === null) return { error: NO_ORGANIZATION }

  try {
    await apiPost(apiPath`/organizations/${organizationId}/statuses/reorder`, { orderedStatusIds })
  } catch (error) {
    // A 400's title is generic; the reason is in the field message.
    const detail = error instanceof ApiError ? Object.values(error.errors)[0] : undefined
    return { error: detail ?? refusal(error) }
  }

  revalidatePath('/settings/statuses')
  // The board form's swimlane picker offers statuses in this order.
  revalidatePath('/settings/boards')
  return { error: null }
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

/**
 * Replaces one idea type's whole field selection (`PUT /organizations/{orgId}/idea-types/{id}/fields`).
 *
 * The picker posts its state as three parallel lists: `fieldDefinitionId` in display order,
 * `fieldRequired` ("1"/"0") beside it, and `fieldsetId` in attach order. Both arrays are
 * authoritative on the server, so an empty submission is not "nothing changed" but "clear the
 * selection", which returns the type to every active field. That is the picker's own empty state, and
 * why this is a separate form from the rename.
 */
export async function saveIdeaTypeFields(
  _previous: EditCatalogItemState,
  form: FormData,
): Promise<EditCatalogItemState> {
  const ideaTypeId = String(form.get('ideaTypeId') ?? '')

  const organizationId = await actingOrganizationId()
  if (organizationId === null) return { error: NO_ORGANIZATION }

  const required = form.getAll('fieldRequired')
  const fields = form.getAll('fieldDefinitionId').map((id, index) => ({
    fieldDefinitionId: String(id),
    displayOrder: (index + 1) * 10,
    isRequired: required[index] === '1',
  }))
  const fieldsetIds = form.getAll('fieldsetId').map(String)

  try {
    await apiPut(apiPath`/organizations/${organizationId}/idea-types/${ideaTypeId}/fields`, {
      fields,
      fieldsetIds,
    })
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
 * What the custom-field create form renders back: the API's messages keyed by field so each can sit
 * beside its control, plus the typed values so a refusal does not blank them (React resets an
 * uncontrolled form once its action resolves).
 */
export type CreateFieldState = {
  error: string | null
  errors: Readonly<Record<string, string>>
  name: string
  description: string
  fieldType: string
  required: boolean
  created: boolean
}

/**
 * Adds a custom field to the organization's schema (`POST /organizations/{orgId}/field-definitions`).
 *
 * Every type goes through here. Only Dropdown and MultiSelect send options; the API refuses
 * options on any other type, so a Text field whose option rows were typed in and then hidden by
 * changing the type must not send them. Blank labels are dropped, as on edit. No `displayOrder`:
 * absent places the field last, which is where a new one belongs.
 *
 * Whether the options are enough (at least one, unique) is the service's call, and its refusal
 * comes back keyed `fieldDefinition`.
 */
export async function createFieldDefinition(
  _previous: CreateFieldState,
  form: FormData,
): Promise<CreateFieldState> {
  const echo = {
    name: String(form.get('name') ?? ''),
    description: String(form.get('description') ?? ''),
    fieldType: String(form.get('fieldType') ?? ''),
    required: form.get('isRequired') === 'on',
  }

  const organizationId = await actingOrganizationId()
  if (organizationId === null) {
    return { ...echo, error: NO_ORGANIZATION, errors: {}, created: false }
  }

  const options = ['Dropdown', 'MultiSelect'].includes(echo.fieldType)
    ? form
        .getAll('optionLabel')
        .map((label) => String(label).trim())
        .filter((label) => label !== '')
        .map((label, index) => ({ label, displayOrder: index }))
    : []

  try {
    await apiPost(apiPath`/organizations/${organizationId}/field-definitions`, {
      name: echo.name,
      description: echo.description,
      fieldType: echo.fieldType,
      isRequired: echo.required,
      options,
    })
  } catch (error) {
    const message = refusal(error)
    return {
      ...echo,
      error: message,
      errors: error instanceof ApiError ? error.errors : {},
      created: false,
    }
  }

  revalidateFields()
  return {
    error: null,
    errors: {},
    name: '',
    description: '',
    fieldType: 'Text',
    required: false,
    created: true,
  }
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
  revalidatePath('/settings/fieldsets')
  revalidatePath('/settings/idea-types')
  revalidatePath('/ideas')
}

/**
 * Fieldsets are live references, so a change reaches every idea type that attaches one and every
 * idea form built from it.
 */
function revalidateFieldsets(): void {
  revalidatePath('/settings/fieldsets')
  revalidatePath('/settings/idea-types')
  revalidatePath('/ideas')
}

/** What the fieldset create form renders back; `errors` is the API's messages keyed by field. */
export type CreateFieldsetState = {
  error: string | null
  errors: Readonly<Record<string, string>>
  name: string
  description: string
  created: boolean
}

/**
 * Adds an empty fieldset (`POST /organizations/{orgId}/fieldsets`). Members are chosen on its edit
 * screen: membership is a separate route, and a set with nothing in it is a legitimate state.
 */
export async function createFieldset(
  _previous: CreateFieldsetState,
  form: FormData,
): Promise<CreateFieldsetState> {
  const echo = {
    name: String(form.get('name') ?? ''),
    description: String(form.get('description') ?? ''),
  }

  const organizationId = await actingOrganizationId()
  if (organizationId === null) {
    return { ...echo, error: NO_ORGANIZATION, errors: {}, created: false }
  }

  try {
    await apiPost(apiPath`/organizations/${organizationId}/fieldsets`, echo)
  } catch (error) {
    return {
      ...echo,
      error: refusal(error),
      errors: error instanceof ApiError ? error.errors : {},
      created: false,
    }
  }

  revalidateFieldsets()
  return { error: null, errors: {}, name: '', description: '', created: true }
}

/**
 * Saves one fieldset: its name and description, then its members and their order
 * (`PUT …/fieldsets/{id}` and `PUT …/fieldsets/{id}/fields`).
 *
 * Two requests, details first, so a duplicate name is refused before the membership is touched.
 * `fieldDefinitionId` arrives in display order and is authoritative: a member left out is removed.
 * `displayOrder` is not posted, so the stored value is kept.
 */
export async function updateFieldset(
  _previous: EditCatalogItemState,
  form: FormData,
): Promise<EditCatalogItemState> {
  const fieldsetId = String(form.get('fieldsetId') ?? '')

  const organizationId = await actingOrganizationId()
  if (organizationId === null) return { error: NO_ORGANIZATION }

  try {
    await apiPut(apiPath`/organizations/${organizationId}/fieldsets/${fieldsetId}`, {
      name: String(form.get('name') ?? ''),
      description: String(form.get('description') ?? ''),
    })
    await apiPut(apiPath`/organizations/${organizationId}/fieldsets/${fieldsetId}/fields`, {
      fieldDefinitionIds: form.getAll('fieldDefinitionId').map(String),
    })
  } catch (error) {
    return { error: refusal(error) }
  }

  revalidateFieldsets()
  redirect('/settings/fieldsets')
}

/**
 * Deletes one fieldset (`DELETE …/fieldsets/{id}`). Hard, and refused with 409 while any idea type
 * has it attached; that message is the API's and is what the screen shows.
 */
export async function deleteFieldset(
  _previous: EditCatalogItemState,
  form: FormData,
): Promise<EditCatalogItemState> {
  const fieldsetId = String(form.get('fieldsetId') ?? '')

  const organizationId = await actingOrganizationId()
  if (organizationId === null) return { error: NO_ORGANIZATION }

  try {
    await apiDelete(apiPath`/organizations/${organizationId}/fieldsets/${fieldsetId}`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) return { error: error.detail }
    return { error: refusal(error) }
  }

  revalidateFieldsets()
  redirect('/settings/fieldsets')
}
