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
import { actingOrganizationId } from './current-user'

/**
 * What the board form renders back.
 *
 * Nothing is echoed. Every field on this form is either seeded from the board being edited or held
 * in `SwimlanePicker`'s own state, so React's reset after an action resolves costs nothing that
 * the next render does not restore.
 */
export type BoardFormState = { error: string | null }

/** The drawer's form. `savedId` is the board written, its cue to move on: nothing redirects it. */
export type BoardDrawerState = { error: string | null; savedId: string | null }

function refusal(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) redirect('/login?expired=1')
    // 409 is an archived board: its settings are frozen until it is unarchived.
    if ([400, 403, 404, 409].includes(error.status)) return error.detail
  }
  throw error
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
 * An unchecked checkbox posts nothing at all, which is why `allowUserStatusUpdate` is a presence
 * test rather than a value read — `String(form.get(...))` would be `"null"`, a truthy string, and
 * the setting would be impossible to turn off.
 */
function boardBody(form: FormData): {
  name: string
  description: string
  allowUserStatusUpdate: boolean
  swimlanes: { statusId: string; order: number }[]
} {
  return {
    name: String(form.get('name') ?? ''),
    // Always sent, blank included: on `PUT` an absent description means "leave it", so emptying the
    // field has to arrive as an empty string for the API to clear it.
    description: String(form.get('description') ?? ''),
    allowUserStatusUpdate: form.get('userStatusMoves') !== null,
    swimlanes: form.getAll('swimlaneIds').map((statusId, order) => ({
      statusId: String(statusId),
      order,
    })),
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
async function create(form: FormData): Promise<{ boardId: string } | { error: string }> {
  const organizationId = await actingOrganizationId()
  if (organizationId === null) {
    return {
      error:
        'A Site Admin belongs to no organization, so there is no organization to create a board ' +
        'in. Use View As to act as an administrator of one.',
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
    return { error: refusal(error) }
  }

  // The sidebar's board count and the workspace list both change, and both are rendered above this
  // route rather than by it, so the page alone is not enough.
  revalidatePath('/', 'layout')
  return { boardId }
}

/** Saves the board, answering the refusal to show or `null` once it is written. */
async function save(form: FormData): Promise<string | null> {
  const boardId = String(form.get('boardId') ?? '')

  try {
    await apiPut(apiPath`/boards/${boardId}`, { ...boardBody(form), ideaMoves: ideaMoves(form) })
  } catch (error) {
    return refusal(error)
  }

  // The lanes changed, so the board itself is stale as well as the lists. Escaped for the reason
  // `apiPath` gives: a cache path is a path, and an id that names no route revalidates nothing,
  // which is the right outcome for a write the API refused to believe in.
  revalidatePath(`/boards/${encodeURIComponent(boardId)}`)
  revalidatePath('/', 'layout')
  return null
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
  const error = await save(form)
  if (error !== null) return { error }
  redirect('/settings/boards')
}

export async function createBoardInPlace(
  _previous: BoardDrawerState,
  form: FormData,
): Promise<BoardDrawerState> {
  const result = await create(form)
  return 'error' in result
    ? { error: result.error, savedId: null }
    : { error: null, savedId: result.boardId }
}

export async function saveBoardInPlace(
  _previous: BoardDrawerState,
  form: FormData,
): Promise<BoardDrawerState> {
  const error = await save(form)
  return { error, savedId: error === null ? String(form.get('boardId') ?? '') : null }
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
