'use server'

/**
 * The three writes a board supports: author an idea, move a card between lanes, toggle an upvote.
 *
 * ## Identity, and why none of these reads the principal
 *
 * `currentUser()` throws outside a render scope, deliberately (`lib/session.ts`): a Server Function
 * runs outside one, and the module-level holder it used to fall back to is shared by every request
 * the process is serving. Two people interleaving across an `await` would swap organization ids.
 *
 * The shape that avoids it is not "resolve the principal at the top and thread it through" — it is
 * that a mutation has no use for the principal at all. Identity travels with the request, as the
 * session cookie `apiPost` forwards, and the API decides what that identity may do. Everything else
 * these functions need — which board, which idea, which lane — is a **parameter**, bound by the
 * component that rendered the control while it was still inside a request. So there is no ambient
 * read to get wrong, and equally no client-side authorization to disagree with the server's.
 *
 * That last part is load-bearing rather than incidental. The board hides a control the role may not
 * use, but hiding is a courtesy: these functions are HTTP endpoints of their own and anyone can post
 * to them with any id. The refusals below are the API's, in the API's own words, because the API is
 * the only thing enforcing them.
 *
 * ## Freshness
 *
 * `revalidatePath` after a successful write, and nothing else. The readers already fetch
 * `no-store`, so re-rendering the board is enough to show the new row; without it the router would
 * keep serving the RSC payload it already has and the write would appear to have done nothing. No
 * optimistic update — a wrong card in the right lane for 200ms is not worth a second state machine.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ApiError, apiPath, apiPost } from '../api/client'

/** What a card's controls render back: the API's refusal, or nothing. */
export type ActionState = { error: string | null }

/**
 * What the create form renders back.
 *
 * `title` and `description` are echoed for the reason `auth-actions.ts` echoes an email: React
 * resets an uncontrolled form once its action resolves, so a refused submission would otherwise
 * blank a paragraph of prose the person had just typed.
 */
export type CreateIdeaState = ActionState & { title: string; description: string }

/**
 * The message to show for a refusal, or a rethrow for anything that is not one.
 *
 * 400, 403 and 404 are all *answers* — the field was empty, the role may not, the id belongs to
 * another organization — and each one belongs beside the control that was pressed. A 500 is not an
 * answer, and rethrowing lands it on the error boundary where an outage belongs.
 *
 * 401 means the session ended between rendering the board and pressing the button. That is neither:
 * it is the same ordinary end of a session `requireCurrentUser` redirects for, so it redirects to
 * the same place, and `proxy.ts` drops the cookie on the way through.
 */
function refusal(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) redirect('/login?expired=1')
    if (error.status === 400 || error.status === 403 || error.status === 404) return error.detail
  }
  throw error
}

/**
 * Re-read the board this write landed on.
 *
 * `boardId` is a hidden field like any other, and it is the one value here that never reaches the
 * API — a move and an upvote identify the idea, not the board — so nothing else would ever question
 * its shape. Escaped for the reason `apiPath` gives: a cache path is a path, and `..` in one names a
 * route this write has nothing to do with. An escaped id that names no route simply revalidates
 * nothing, which is the correct outcome for a write the API refused to believe in.
 */
function revalidateBoard(boardId: string): void {
  revalidatePath(`/boards/${encodeURIComponent(boardId)}`)
}

export async function createIdea(
  _previous: CreateIdeaState,
  form: FormData,
): Promise<CreateIdeaState> {
  const boardId = String(form.get('boardId') ?? '')
  const title = String(form.get('title') ?? '')
  const description = String(form.get('description') ?? '')

  try {
    await apiPost(apiPath`/boards/${boardId}/ideas`, {
      title,
      description,
      priority: String(form.get('priority') ?? ''),
      ideaTypeId: String(form.get('ideaTypeId') ?? ''),
      businessImpactId: String(form.get('businessImpactId') ?? ''),
      // No `statusId`: omitting it means the board's left-most swimlane, which is where a new idea
      // belongs and is not the same request as naming a status (`IdeasController.create`).
    })
  } catch (error) {
    return { error: refusal(error), title, description }
  }

  revalidateBoard(boardId)
  // And the organization-wide list, which is the other screen the create form is reachable from and
  // where a new idea is the first row. Without it, creating one from `/ideas` re-renders the page
  // the router already has and the idea appears not to have been created.
  revalidatePath('/ideas')
  return { error: null, title: '', description: '' }
}

export async function moveIdea(_previous: ActionState, form: FormData): Promise<ActionState> {
  const boardId = String(form.get('boardId') ?? '')
  const ideaId = String(form.get('ideaId') ?? '')

  try {
    await apiPost(apiPath`/ideas/${ideaId}/status`, {
      statusId: String(form.get('statusId') ?? ''),
    })
  } catch (error) {
    return { error: refusal(error) }
  }

  revalidateBoard(boardId)
  return { error: null }
}

export async function toggleUpvote(_previous: ActionState, form: FormData): Promise<ActionState> {
  const boardId = String(form.get('boardId') ?? '')
  const ideaId = String(form.get('ideaId') ?? '')

  try {
    await apiPost(apiPath`/ideas/${ideaId}/upvote/toggle`)
  } catch (error) {
    return { error: refusal(error) }
  }

  revalidateBoard(boardId)
  return { error: null }
}
