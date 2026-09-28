'use server'

/**
 * The writes an idea supports: create or save one from the drawer's form, delete one, move a card
 * between lanes, toggle an upvote, post a comment — and one read, the Tags filter's typeahead.
 *
 * ## Identity, and why none of these reads the principal
 *
 * `currentUser()` throws outside a render scope, deliberately (`lib/session.ts`): a Server Function
 * runs outside one, and the module-level holder it used to fall back to is shared by every request
 * the process is serving. Two people interleaving across an `await` would swap organization ids.
 *
 * So a mutation has no use for the principal at all. Identity travels with the request, as the
 * session cookie `apiPost` forwards, and the API decides what that identity may do. Everything else
 * these functions need — which board, which idea, which lane — is a **parameter**, bound by the
 * component that rendered the control while it was still inside a request.
 *
 * That is load-bearing rather than incidental. The screens hide a control the role may not use, but
 * hiding is a courtesy: these functions are HTTP endpoints of their own and anyone can post to them
 * with any id. The refusals below are the API's, in the API's own words.
 *
 * ## Freshness
 *
 * `revalidatePath` after a successful write, and nothing else. The readers already fetch
 * `no-store`, so re-rendering is enough to show the new row. The drawer lives on `/ideas` and on a
 * board's page, so both are revalidated whichever one the write came from.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  ApiError,
  apiDelete,
  apiGet,
  apiPath,
  apiPost,
  apiPostReturning,
  apiPut,
  withQuery,
} from '../api/client'
import type { WireCreatedIdea } from '../api/wire'

/** What a card's controls render back: the API's refusal, or nothing. */
export type ActionState = { error: string | null }

/** Everything the idea form sends. `ideaId` absent is a create, on `boardId`. */
export type IdeaInput = {
  ideaId: string | null
  boardId: string
  title: string
  problem: string
  proposedSolutions: string[]
  impactRationale: string
  description: string
  priority: string
  ideaTypeId: string
  businessImpactId: string
  dueDate: string
  tagNames: string[]
  /**
   * An edit sends these back as they were: `PUT` replaces both collections, so leaving them out
   * would clear them — and for a non-author, clearing the assignees is a change the API refuses.
   */
  assigneeUserIds: string[]
  mentionEmails: string[]
  /** Every field the type shows; an omitted one is cleared. `null` leaves them all untouched. */
  fieldValues: { fieldDefinitionId: string; value: string }[] | null
}

/**
 * What the form renders back. `errors` is a validation 400's bag, keyed by the API's field names
 * (`title`, `proposedSolutions`, a custom field's name), for the form to put beside each control.
 */
export type SaveIdeaResult =
  | { ok: true; ideaId: string }
  | { ok: false; error: string | null; errors: Readonly<Record<string, string>> }

/**
 * The message to show for a refusal, or a rethrow for anything that is not one.
 *
 * 400, 403, 404 and 409 are all *answers* — the field was empty, the role may not, the id belongs to
 * another organization, the board is archived — and each one belongs beside the control that was
 * pressed. A 500 is not an answer, and rethrowing lands it on the error boundary.
 *
 * 401 means the session ended between rendering and pressing the button: the same ordinary end of a
 * session `requireCurrentUser` redirects for, so it redirects to the same place.
 */
function refusal(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) redirect('/login?expired=1')
    if ([400, 403, 404, 409].includes(error.status)) return error.detail
  }
  throw error
}

/**
 * Re-read the screens an idea appears on. `boardId` is a parameter like any other, escaped for the
 * reason `apiPath` gives: a cache path is a path, and an id that names no route revalidates nothing.
 */
function revalidateIdeaScreens(boardId: string): void {
  revalidatePath(`/boards/${encodeURIComponent(boardId)}`)
  revalidatePath('/ideas')
}

export async function saveIdea(input: IdeaInput): Promise<SaveIdeaResult> {
  const body = {
    title: input.title,
    problem: input.problem,
    proposedSolutions: input.proposedSolutions,
    impactRationale: input.impactRationale,
    description: input.description,
    priority: input.priority,
    ideaTypeId: input.ideaTypeId,
    businessImpactId: input.businessImpactId,
    dueDate: input.dueDate || null,
    tagNames: input.tagNames,
    assigneeUserIds: input.assigneeUserIds,
    mentionEmails: input.mentionEmails,
    fieldValues: input.fieldValues,
  }

  let ideaId: string
  try {
    if (input.ideaId) {
      await apiPut(apiPath`/ideas/${input.ideaId}`, body)
      ideaId = input.ideaId
    } else {
      // The exception `apiPostReturning` exists for: the drawer opens the new idea next, and its id
      // exists nowhere until this answers. No `statusId`: omitting it means the left-most lane.
      const created = await apiPostReturning<WireCreatedIdea>(
        apiPath`/boards/${input.boardId}/ideas`,
        body,
      )
      ideaId = created.ideaId
    }
  } catch (error) {
    const message = refusal(error)
    const errors = error instanceof ApiError ? error.errors : {}
    return { ok: false, error: Object.keys(errors).length > 0 ? null : message, errors }
  }

  revalidateIdeaScreens(input.boardId)
  // The sidebar's idea count, which the layout renders, changes on a create.
  if (!input.ideaId) revalidatePath('/', 'layout')
  return { ok: true, ideaId }
}

export async function deleteIdea(ideaId: string, boardId: string): Promise<ActionState> {
  try {
    await apiDelete(apiPath`/ideas/${ideaId}`)
  } catch (error) {
    return { error: refusal(error) }
  }

  revalidateIdeaScreens(boardId)
  revalidatePath('/', 'layout')
  return { error: null }
}

/**
 * Tag names in the organization starting with `prefix`, for the Tags filter's typeahead. The API
 * answers nothing below two characters, so neither does this. `organizationId` is bound by the
 * screen, for the reason at the top of this file.
 */
export async function findTags(organizationId: string, prefix: string): Promise<string[]> {
  if (prefix.trim().length < 2) return []
  const params = new URLSearchParams({ search: prefix.trim(), limit: '20' })
  return [
    ...(await apiGet<readonly string[]>(
      'findTags',
      withQuery(apiPath`/organizations/${organizationId}/tags`, params),
    )),
  ]
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

  revalidateIdeaScreens(boardId)
  return { error: null }
}

/**
 * Toggle the caller's vote, from a lane card or from the drawer. One action for both, with the same
 * fields, so the two controls cannot drift.
 */
export async function toggleUpvote(_previous: ActionState, form: FormData): Promise<ActionState> {
  const boardId = String(form.get('boardId') ?? '')
  const ideaId = String(form.get('ideaId') ?? '')

  try {
    await apiPost(apiPath`/ideas/${ideaId}/upvote/toggle`)
  } catch (error) {
    return { error: refusal(error) }
  }

  revalidateIdeaScreens(boardId)
  return { error: null }
}

/**
 * Post a comment on an idea.
 *
 * No `mentionEmails`. The API resolves each address against the idea's organization and **rejects**
 * one it cannot place (`SPEC/30-Contracts.md`, corrected 2026-09-06); the composer offers no way to
 * pick a person, so sending the field could only ever turn typed prose into a 400.
 */
export async function addComment(_previous: ActionState, form: FormData): Promise<ActionState> {
  const boardId = String(form.get('boardId') ?? '')
  const ideaId = String(form.get('ideaId') ?? '')

  try {
    await apiPost(apiPath`/ideas/${ideaId}/comments`, { body: String(form.get('body') ?? '') })
  } catch (error) {
    return { error: refusal(error) }
  }

  revalidateIdeaScreens(boardId)
  return { error: null }
}
