'use server'

/**
 * The board writes: create a board, save an existing one, and archive or unarchive it.
 *
 * Create and save come twice. `createBoard` / `saveBoard` serve `/settings/boards` and redirect back
 * to it; `createBoardInPlace` / `saveBoardInPlace` serve the Boards screen's drawer, which stays on
 * its page and decides for itself where to go once the write succeeds.
 *
 * One payload shape for both — `POST /organizations/{id}/boards` and `PUT /boards/{id}` take the
 * same fields (`SPEC/30-Contracts.md` "Board Contracts") — so the screens are one form with
 * different seed values, and these are one body builder with different verbs and paths.
 *
 * Identity follows `idea-actions.ts`: nothing here reads the principal, because a Server Function
 * runs outside the render scope `currentUser()` needs. `boardId` is a parameter bound by the page
 * that rendered the form, exactly as it is for a move or an upvote. The organization id on the
 * create path is neither — it is asked of the API, for the reason `actingOrganizationId` gives.
 *
 * **There is no delete.** A board's ideas outlive the board, so a board is archived instead
 * (`SPEC/20-feature-boards-and-statuses.md` rule 13), and unarchiving restores it unchanged.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ApiError, apiPath, apiPost, apiPostReturning, apiPut } from '../api/client'
import type { LaneFlags } from '../types'
import { actingOrganizationId } from './current-user'
import { KEY_PREFIX_RULE, ruleMessage } from './rule-messages'

/**
 * What the board form renders back.
 *
 * Nothing is echoed. Every field on this form is either seeded from the board being edited or held
 * in `SwimlanePicker`'s own state, so React's reset after an action resolves costs nothing that
 * the next render does not restore.
 */
export type BoardFormState = { error: string | null; pullErrors?: string[] } & FieldRefusals

/**
 * Refusals the form shows beside the control they name rather than in the banner: the key prefix
 * (`locked` when keys have been issued, so the field turns read-only with its reason) and, where
 * the submitted lanes make it plain which lane broke a rule, that lane.
 */
export type FieldRefusals = {
  keyPrefix?: { message: string; locked: boolean }
  /** The API's refusal of the allowed idea types, shown beside that control. */
  allowedIdeaTypes?: string
  laneErrors?: Record<string, string>
}

/**
 * The drawer's form. `savedId` is the board written, its cue to move on: nothing redirects it.
 * `pullErrors` is one message per item the API refused to pull, for the step to mark.
 */
export type BoardDrawerState = {
  error: string | null
  savedId: string | null
  pullErrors?: string[]
} & FieldRefusals

function refusal(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) redirect('/login?expired=1')
    // 409 is an archived board: its settings are frozen until it is unarchived. 422 is a Board
    // References rule (`referencesBoardInvalid`, `laneInUse`, ...) whose `detail` is the rule key
    // until the API sends a message; it shows as it arrives, and a later `message` member lands in
    // `ApiError.detail` rather than here.
    if ([400, 403, 404, 409, 422].includes(error.status)) return ruleMessage(error.detail)
  }
  throw error
}

/**
 * A refused save: the banner message, the per-item messages of a refused pull (which the step shows
 * beside the items they name), and the refusals that belong on a field. The banner keeps only what
 * is left over.
 */
function refusedSave(
  error: unknown,
  form: FormData,
): { error: string | null; pullErrors: string[] } & FieldRefusals {
  if (error instanceof ApiError) {
    const { keyPrefix, ...rest } = error.errors
    if (error.status === 400 && (error.errors.ideaTypeIds || error.errors.allowedIdeaTypeIds)) {
      return {
        error: null,
        pullErrors: [],
        allowedIdeaTypes: error.errors.ideaTypeIds ?? error.errors.allowedIdeaTypeIds ?? '',
      }
    }
    if (error.status === 400 && (keyPrefix || error.errorLists.pullItemIds)) {
      const pullErrors = [...(error.errorLists.pullItemIds ?? [])]
      const other = Object.entries(rest)
        .filter(([field]) => field !== 'pullItemIds')
        .map(([, message]) => message)
      return {
        error: other.length > 0 ? other.join(' ') : null,
        pullErrors,
        ...(keyPrefix ? { keyPrefix: { message: KEY_PREFIX_RULE, locked: false } } : {}),
      }
    }
    if (error.status === 422 && error.detail === 'keyPrefixLocked') {
      return {
        error: null,
        pullErrors: [],
        keyPrefix: { message: ruleMessage(error.detail), locked: true },
      }
    }
    if (error.status === 409 && error.detail === 'keyPrefixTaken') {
      const prefix = String(form.get('keyPrefix') ?? '')
        .trim()
        .toUpperCase()
      return {
        error: null,
        pullErrors: [],
        keyPrefix: { message: `${prefix} is already used by another board.`, locked: false },
      }
    }
    if (error.status === 422) {
      const laneErrors = laneRefusals(error.detail, form)
      if (laneErrors) return { error: null, pullErrors: [], laneErrors }
    }
  }
  return { error: refusal(error), pullErrors: [] }
}

/**
 * Pins the lane rules a submitted form makes plain to the lane that broke them. The API names the
 * rule and not the lane, so a rule that cannot be attributed from the form (a lane in use, a
 * reference chain) stays in the banner.
 */
function laneRefusals(rule: string, form: FormData): Record<string, string> | null {
  const boardId = String(form.get('boardId') ?? '')
  const flags = JSON.parse(String(form.get('laneFlags') ?? '{}')) as Record<
    string,
    Partial<LaneFlags> | undefined
  >
  const broken = form
    .getAll('swimlaneIds')
    .map(String)
    .filter((statusId) => {
      const lane = flags[statusId]
      if (rule === 'finalLaneCannotReference') return lane?.isFinal && lane.referencesBoardId
      if (rule === 'autoCreateTaskRequiresReference') {
        return lane?.autoCreateTask && !lane.referencesBoardId
      }
      if (rule === 'laneReferencesOwnBoard')
        return boardId !== '' && lane?.referencesBoardId === boardId
      return false
    })
  return broken.length > 0
    ? Object.fromEntries(broken.map((statusId) => [statusId, ruleMessage(rule)]))
    : null
}

/**
 * The form's fields as the API's board payload.
 *
 * The swimlane order is the order the ids arrive in: `SwimlanePicker` renders one hidden input per
 * selected status in its list order, and `getAll` preserves document order, so the picker's
 * top-to-bottom list *is* the board's left-to-right columns with nothing to keep in sync.
 *
 * `order` counts from zero and is dense. The API stores what it is given and `GET /boards/{id}`
 * sorts on it, so any increasing sequence would render the same board; a dense one is the one that
 * survives a round trip unchanged, which is what makes the edit form show what was saved.
 *
 * **Lane flags travel with the form.** `PUT` rebuilds every lane from the request, and an absent
 * `isFinal`, `referencesBoardId` or `autoCreateTask` means false or none, so a save that sent only
 * `{statusId, order}` wiped them. The edit form carries the flags it was loaded with as one hidden
 * `laneFlags` field (status id to flags), and each lane sends its own back; a lane the person just
 * added has none and sends the defaults. Nothing on this form edits them.
 *
 * `allowUserStatusUpdate` is always `true`: Users may always move ideas between statuses and the
 * form no longer shows the setting (SPEC/decisions.md 2026-10-22). The field stays on the contract
 * until a later change drops it.
 */
function boardBody(form: FormData): {
  name: string
  description: string
  allowUserStatusUpdate: boolean
  keyPrefix?: string | null
  ideaFeaturesEnabled?: boolean
  swimlanes: ({ statusId: string; order: number } & LaneFlags)[]
  pullItemIds?: string[]
  allowedIdeaTypeIds?: string[]
} {
  // Left out when empty, so a save that pulls nothing is the request it was before the step existed.
  const pullItemIds = form.getAll('pullItemIds').map(String)
  const allowed = form.getAll('allowedIdeaTypeIds').map(String)
  const flags = JSON.parse(String(form.get('laneFlags') ?? '{}')) as Record<
    string,
    Partial<LaneFlags> | undefined
  >
  return {
    name: String(form.get('name') ?? ''),
    // Always sent, blank included: on `PUT` an absent description means "leave it", so emptying the
    // field has to arrive as an empty string for the API to clear it.
    description: String(form.get('description') ?? ''),
    allowUserStatusUpdate: true,
    // Present only on a form that has the fields; a caller without them (the quick-add row) leaves
    // both to the API's defaults, and on `PUT` an absent value means "leave it".
    ...(form.has('keyPrefix') ? { keyPrefix: String(form.get('keyPrefix')).trim() || null } : {}),
    ...(form.has('ideaFeaturesEnabled')
      ? { ideaFeaturesEnabled: form.get('ideaFeaturesEnabled') === 'true' }
      : {}),
    swimlanes: form.getAll('swimlaneIds').map((statusId, order) => ({
      statusId: String(statusId),
      order,
      isFinal: flags[String(statusId)]?.isFinal ?? false,
      referencesBoardId: flags[String(statusId)]?.referencesBoardId ?? null,
      autoCreateTask: flags[String(statusId)]?.autoCreateTask ?? false,
    })),
    ...(pullItemIds.length > 0 ? { pullItemIds } : {}),
    // Create only: a save sets the list through its own route (`savePolicy`). Empty means every type.
    ...(form.has('allowedIdeaTypesShown') && allowed.length > 0
      ? { allowedIdeaTypeIds: allowed }
      : {}),
  }
}

/**
 * Where a save sends the ideas of each lane it removes, as `PUT`'s `ideaMoves`. The board form's
 * confirm step posts one `moveFrom`/`moveTo` pair per removed lane that holds ideas, in step.
 */
function ideaMoves(form: FormData): { fromStatusId: string; toStatusId: string }[] {
  const to = form.getAll('moveTo')
  return form.getAll('moveFrom').map((fromStatusId, index) => ({
    fromStatusId: String(fromStatusId),
    toStatusId: String(to[index] ?? ''),
  }))
}

/** Creates the board, answering its id, or the refusal to show. */
async function create(
  form: FormData,
): Promise<{ boardId: string } | ({ error: string | null; pullErrors: string[] } & FieldRefusals)> {
  const organizationId = await actingOrganizationId()
  if (organizationId === null) {
    return {
      error:
        'An App Admin belongs to no organization, so there is no organization to create a board ' +
        'in. Use View As to act as an administrator of one.',
      pullErrors: [],
    }
  }

  let boardId: string
  try {
    // The exception `apiPostReturning` exists for: the drawer opens the new board next, and its id
    // exists nowhere until this answers.
    const created = await apiPostReturning<{ boardId: string }>(
      apiPath`/organizations/${organizationId}/boards`,
      boardBody(form),
    )
    boardId = created.boardId
  } catch (error) {
    return refusedSave(error, form)
  }

  // The sidebar's board count and the workspace list both change, and both are rendered above this
  // route rather than by it, so the page alone is not enough.
  revalidatePath('/', 'layout')
  return { boardId }
}

/** Saves the board, answering the refusal to show or `null` once it is written. */
async function save(
  form: FormData,
): Promise<({ error: string | null; pullErrors: string[] } & FieldRefusals) | null> {
  const boardId = String(form.get('boardId') ?? '')

  try {
    const { allowedIdeaTypeIds: _create, ...body } = boardBody(form)
    await apiPut(apiPath`/boards/${boardId}`, { ...body, ideaMoves: ideaMoves(form) })
  } catch (error) {
    return refusedSave(error, form)
  }

  // Its own route, and only from a form that showed the control (the caller may set it). The board
  // is already written by now, so a refusal here must still refresh what the page shows and say
  // that only the types failed.
  let typesRefusal: ReturnType<typeof refusedSave> | null = null
  if (form.has('allowedIdeaTypesShown')) {
    try {
      await apiPut(apiPath`/boards/${boardId}/allowed-idea-types`, {
        ideaTypeIds: form.getAll('allowedIdeaTypeIds').map(String),
      })
    } catch (error) {
      typesRefusal = refusedSave(error, form)
    }
  }

  // The lanes changed, so the board itself is stale as well as the lists. Escaped for the reason
  // `apiPath` gives: a cache path is a path, and an id that names no route revalidates nothing,
  // which is the right outcome for a write the API refused to believe in.
  revalidatePath(`/boards/${encodeURIComponent(boardId)}`)
  revalidatePath('/', 'layout')
  if (typesRefusal) {
    const saved = 'The board was saved, but its allowed idea types were not.'
    return {
      ...typesRefusal,
      error: typesRefusal.error ? `${saved} ${typesRefusal.error}` : null,
      allowedIdeaTypes: typesRefusal.allowedIdeaTypes
        ? `${saved} ${typesRefusal.allowedIdeaTypes}`
        : saved,
    }
  }
  return null
}

/**
 * The Boards list's quick-add row: a board from just a name, on the lanes the page chose (the
 * catalog's first two statuses, as the drawer defaults them). The same
 * `POST /organizations/{id}/boards` as the drawer; a refusal comes back keyed by field so the row
 * can mark the name.
 */
export async function quickAddBoard(
  name: string,
  statusIds: string[],
): Promise<
  | { ok: true; boardId: string }
  | { ok: false; error: string | null; errors: Record<string, string> }
> {
  const organizationId = await actingOrganizationId()
  if (organizationId === null) {
    return {
      ok: false,
      error: 'An App Admin belongs to no organization. Use View As to act as an administrator.',
      errors: {},
    }
  }

  try {
    const created = await apiPostReturning<{ boardId: string }>(
      apiPath`/organizations/${organizationId}/boards`,
      {
        name,
        description: '',
        allowUserStatusUpdate: true,
        swimlanes: statusIds.map((statusId, order) => ({ statusId, order })),
      },
    )
    revalidatePath('/', 'layout')
    return { ok: true, boardId: created.boardId }
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) {
      const { name: nameError, ...rest } = error.errors
      const other = Object.values(rest).join(' ')
      if (nameError) return { ok: false, error: other || null, errors: { name: nameError } }
    }
    return { ok: false, error: refusal(error), errors: {} }
  }
}

export async function createBoard(
  _previous: BoardFormState,
  form: FormData,
): Promise<BoardFormState> {
  const result = await create(form)
  if ('error' in result) return result

  // `redirect` signals by throwing, so it must be the last thing and must not sit inside a `try`.
  redirect('/settings/boards')
}

export async function saveBoard(
  _previous: BoardFormState,
  form: FormData,
): Promise<BoardFormState> {
  const refused = await save(form)
  if (refused !== null) return refused
  redirect('/settings/boards')
}

export async function createBoardInPlace(
  _previous: BoardDrawerState,
  form: FormData,
): Promise<BoardDrawerState> {
  const result = await create(form)
  return 'error' in result ? { ...result, savedId: null } : { error: null, savedId: result.boardId }
}

export async function saveBoardInPlace(
  _previous: BoardDrawerState,
  form: FormData,
): Promise<BoardDrawerState> {
  const refused = await save(form)
  return refused === null
    ? { error: null, savedId: String(form.get('boardId') ?? '') }
    : { ...refused, savedId: null }
}

/**
 * Save a board's lane order from its own page: one `POST …/swimlanes/reorder` naming every lane, in
 * the order given, with a dense `order` from zero as `boardBody` sends it
 * (`SPEC/20-feature-client-ui.md` "Reordering Columns"). The API refuses a list that is not
 * exactly the board's lanes, so a page stale by a lane edit elsewhere gets that refusal to show.
 */
export async function reorderLanes(
  boardId: string,
  statusIds: string[],
): Promise<{ error: string | null }> {
  try {
    await apiPost(apiPath`/boards/${boardId}/swimlanes/reorder`, {
      swimlanes: statusIds.map((statusId, order) => ({ statusId, order })),
    })
  } catch (error) {
    // A 400's title is generic; the reason is in the field message.
    const detail = error instanceof ApiError ? error.errors.swimlanes : undefined
    return { error: detail ?? refusal(error) }
  }

  revalidatePath(`/boards/${encodeURIComponent(boardId)}`)
  // The Boards list draws its lane mix in lane order.
  revalidatePath('/', 'layout')
  return { error: null }
}

/**
 * Archive or unarchive, once the screen has asked for confirmation. Both answer 204 whether or not
 * anything changed, so a second click from a stale page is harmless.
 */
export async function setBoardArchived(
  boardId: string,
  archived: boolean,
): Promise<{ error: string | null }> {
  try {
    await apiPost(
      archived ? apiPath`/boards/${boardId}/archive` : apiPath`/boards/${boardId}/unarchive`,
    )
  } catch (error) {
    return { error: refusal(error) }
  }

  // An archived board leaves the sidebar count and every board picker, not only this list.
  revalidatePath(`/boards/${encodeURIComponent(boardId)}`)
  revalidatePath('/', 'layout')
  return { error: null }
}
