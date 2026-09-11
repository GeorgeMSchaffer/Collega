'use server'

/**
 * The two writes `/settings/boards` supports: create a board, and save an existing one.
 *
 * One payload shape for both — `POST /organizations/{id}/boards` and `PUT /boards/{id}` take the
 * same three fields (`SPEC/30-Contracts.md` "Board Contracts") — so the screens are one form with
 * different seed values, and these are one body builder with different verbs and paths.
 *
 * Identity follows `idea-actions.ts`: nothing here reads the principal, because a Server Function
 * runs outside the render scope `currentUser()` needs. `boardId` is a parameter bound by the page
 * that rendered the form, exactly as it is for a move or an upvote. The organization id on the
 * create path is neither — it is asked of the API, for the reason `actingOrganizationId` gives.
 *
 * **There is no delete.** A board's ideas outlive the board, no endpoint removes one, and no screen
 * in comp Q offers to discard a board's contents as a side effect of tidying up its columns.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ApiError, apiPath, apiPost, apiPut } from '../api/client'
import { actingOrganizationId } from './current-user'

/**
 * What the board form renders back.
 *
 * Nothing is echoed. Every field on this form is either seeded from the board being edited or held
 * in `SwimlanePicker`'s own state, so React's reset after an action resolves costs nothing that
 * the next render does not restore.
 */
export type BoardFormState = { error: string | null }

function refusal(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) redirect('/login?expired=1')
    if (error.status === 400 || error.status === 403 || error.status === 404) return error.detail
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
  allowUserStatusUpdate: boolean
  swimlanes: { statusId: string; order: number }[]
} {
  return {
    name: String(form.get('name') ?? ''),
    allowUserStatusUpdate: form.get('userStatusMoves') !== null,
    swimlanes: form.getAll('swimlaneIds').map((statusId, order) => ({
      statusId: String(statusId),
      order,
    })),
  }
}

export async function createBoard(
  _previous: BoardFormState,
  form: FormData,
): Promise<BoardFormState> {
  const organizationId = await actingOrganizationId()
  if (organizationId === null) {
    return {
      error:
        'A Site Admin belongs to no organization, so there is no organization to create a board ' +
        'in. Use View As to act as an administrator of one.',
    }
  }

  try {
    await apiPost(apiPath`/organizations/${organizationId}/boards`, boardBody(form))
  } catch (error) {
    return { error: refusal(error) }
  }

  // The sidebar's board count and the workspace list both change, and both are rendered above this
  // route rather than by it, so the page alone is not enough.
  revalidatePath('/', 'layout')

  // `redirect` signals by throwing, so it must be the last thing and must not sit inside a `try`.
  // Back to the list rather than into the new board: `apiPost` discards the response, so the id it
  // answered with is not in hand, and re-reading it to navigate would be a request for a number
  // the list is about to show anyway.
  redirect('/settings/boards')
}

export async function saveBoard(
  _previous: BoardFormState,
  form: FormData,
): Promise<BoardFormState> {
  const boardId = String(form.get('boardId') ?? '')

  try {
    await apiPut(apiPath`/boards/${boardId}`, boardBody(form))
  } catch (error) {
    return { error: refusal(error) }
  }

  // The lanes changed, so the board itself is stale as well as the settings list. Escaped for the
  // reason `apiPath` gives: a cache path is a path, and an id that names no route revalidates
  // nothing, which is the right outcome for a write the API refused to believe in.
  revalidatePath(`/boards/${encodeURIComponent(boardId)}`)
  revalidatePath('/', 'layout')

  redirect('/settings/boards')
}
