'use server'

/**
 * The writes an idea supports: create or save one from the drawer's form, delete one, move a card
 * between lanes, toggle an upvote, post a comment, follow or unfollow.
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
import { ApiError, apiDelete, apiPath, apiPost, apiPostReturning, apiPut } from '../api/client'
import type { WireCreatedIdea } from '../api/wire'
import { recordEvent } from './analytics'
import { actingOrganizationId } from './current-user'
import { type RuleContext, ruleMessage } from './rule-messages'

/** What a card's controls render back: the API's refusal, or nothing. */
export type ActionState = { error: string | null }

/**
 * Everything the idea form sends. `ideaId` absent is a create, on `boardId` — or in the pool, the
 * organization's ideas with no board, when `boardId` is empty.
 */
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
  /** Three-state: absent leaves the stored Effort alone, `null` clears it, a value sets it. */
  effort?: 'Low' | 'Medium' | 'High' | null
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
 * 400, 403, 404, 409 and 422 are all *answers* — the field was empty, the role may not, the id belongs
 * to another organization, the board is archived, a Board References rule refused the move
 * (`parentHasOpenTasks`, `taskBlocked`; `detail` is the rule key, which `ruleMessage` turns into a sentence) —
 * and each one belongs beside the control that was pressed. A 500 is not an answer, and rethrowing lands it on the error boundary.
 *
 * 401 means the session ended between rendering and pressing the button: the same ordinary end of a
 * session `requireCurrentUser` redirects for, so it redirects to the same place.
 */
function refusal(error: unknown, context: RuleContext = {}): string {
  if (error instanceof ApiError) {
    if (error.status === 401) redirect('/login?expired=1')
    if ([400, 403, 404, 409, 422].includes(error.status)) {
      return ruleMessage(error.detail, context)
    }
  }
  throw error
}

/**
 * Re-read the screens an idea appears on. `boardId` is a parameter like any other, escaped for the
 * reason `apiPath` gives: a cache path is a path, and an id that names no route revalidates nothing.
 */
function revalidateIdeaScreens(boardId: string): void {
  // An idea in the pool sends an empty id: it is on no board page.
  if (boardId) revalidatePath(`/boards/${encodeURIComponent(boardId)}`)
  revalidatePath('/ideas')
  // Tag counts, and tags created inline while tagging.
  revalidatePath('/settings/tags')
  // An Issue is an idea, and its drawer on the delivery screens votes, comments and edits too.
  revalidatePath('/delivery/sprint')
  revalidatePath('/delivery/backlog')
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
    ...(input.effort !== undefined ? { effort: input.effort } : {}),
  }

  let ideaId: string
  try {
    if (input.ideaId) {
      await apiPut(apiPath`/ideas/${input.ideaId}`, body)
      ideaId = input.ideaId
    } else {
      // The exception `apiPostReturning` exists for: the drawer opens the new idea next, and its id
      // exists nowhere until this answers. No `statusId`: omitting it means the left-most lane, and
      // for the pool the API picks the organization's first active status.
      const organizationId = input.boardId ? null : await actingOrganizationId()
      if (!input.boardId && organizationId === null) {
        return {
          ok: false,
          error: 'An App Admin belongs to no organization. Use View As to act as a member of one.',
          errors: {},
        }
      }
      const created = await apiPostReturning<WireCreatedIdea>(
        organizationId === null
          ? apiPath`/boards/${input.boardId}/ideas`
          : apiPath`/organizations/${organizationId}/ideas`,
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
  if (!input.ideaId) {
    revalidatePath('/', 'layout')
    await recordEvent('idea.created')
  }
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
 * Move a card to another lane. The optional `forceReason` is an Org Admin's override of the
 * reference-lane lock (`parentHasOpenTasks`); `title`, `openTasks` and `blockers` are what the card
 * already shows, so a refusal can name it. None of them is authority: the API decides.
 */
export async function moveIdea(_previous: ActionState, form: FormData): Promise<ActionState> {
  const boardId = String(form.get('boardId') ?? '')
  const ideaId = String(form.get('ideaId') ?? '')
  const forceReason = String(form.get('forceReason') ?? '').trim()

  try {
    await apiPost(apiPath`/ideas/${ideaId}/status`, {
      statusId: String(form.get('statusId') ?? ''),
      ...(forceReason ? { forceReason } : {}),
    })
  } catch (error) {
    return { error: refusal(error, cardContext(form)) }
  }

  revalidateIdeaScreens(boardId)
  // The drawer's completion prompt moves a parent from the inbox's drawer too.
  revalidatePath('/inbox')
  return { error: null }
}

/** What the card's controls know about it, for a refusal's sentence. */
function cardContext(form: FormData): RuleContext {
  const count = (name: string) => {
    const value = form.get(name)
    return value === null || value === '' ? undefined : Number(value)
  }
  const title = form.get('title')
  const openTasks = count('openTasks')
  const blockers = count('blockers')
  return {
    ...(typeof title === 'string' && title !== '' ? { title } : {}),
    ...(openTasks !== undefined ? { openTasks } : {}),
    ...(blockers !== undefined ? { blockers } : {}),
  }
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

/**
 * Follow or stop following an idea, as the caller (`SPEC/contracts/following.md`). Both verbs are
 * idempotent, so a double press cannot leave the state the other way round. The toggle shows the
 * new state at once and re-reads it from the detail; `/inbox` is revalidated too, since its drawer
 * carries the same control.
 */
export async function setFollowing(
  ideaId: string,
  boardId: string,
  follow: boolean,
): Promise<ActionState> {
  try {
    if (follow) await apiPut(apiPath`/ideas/${ideaId}/follow`)
    else await apiDelete(apiPath`/ideas/${ideaId}/follow`)
  } catch (error) {
    return { error: refusal(error) }
  }

  revalidateIdeaScreens(boardId)
  revalidatePath('/inbox')
  return { error: null }
}

/**
 * Take an idea off its board, leaving it in the pool with its status, comments, votes and
 * followers. Idempotent on the API's side, so a second press from a stale page changes nothing.
 */
export async function detachIdea(
  ideaId: string,
  boardId: string,
  context: (RuleContext & { forceReason?: string }) | null = null,
): Promise<ActionState> {
  const forceReason = context?.forceReason?.trim()
  try {
    await apiDelete(apiPath`/ideas/${ideaId}/board`, forceReason ? { forceReason } : {})
  } catch (error) {
    return { error: refusal(error, { ...context, action: 'remove' }) }
  }

  revalidateIdeaScreens(boardId)
  // The board's idea count in the sidebar, and Home's Needs a board tile.
  revalidatePath('/', 'layout')
  return { error: null }
}

/** What the drawer's add-task form sends: the task fields and nothing else (`contracts/ideas.md`). */
export type BoardTaskInput = {
  title: string
  description: string
  assigneeUserIds: string[]
  tagNames: string[]
}

/**
 * Re-read what a parent's tasks touch: the parent's own screens, and the board the tasks live on,
 * where an added task is a new card and a removed one is gone.
 */
function revalidateTaskScreens(boardId: string, taskBoardId: string): void {
  revalidateIdeaScreens(boardId)
  revalidateIdeaScreens(taskBoardId)
  revalidatePath('/inbox')
}

/**
 * Add a task to a parent in a reference lane, on the board that lane references. A refusal such as
 * `parentNotInReferenceLane` comes back as a sentence for the form to show.
 */
export async function addBoardTask(
  ideaId: string,
  boardId: string,
  taskBoardId: string,
  input: BoardTaskInput,
): Promise<ActionState> {
  try {
    await apiPost(apiPath`/ideas/${ideaId}/board-tasks`, {
      title: input.title,
      description: input.description,
      assigneeUserIds: input.assigneeUserIds,
      tagNames: input.tagNames,
    })
  } catch (error) {
    return { error: refusal(error) }
  }

  revalidateTaskScreens(boardId, taskBoardId)
  return { error: null }
}

/**
 * Replace an item's blocker set (`PUT /ideas/{id}/blocked-by`). The set is always complete, so the
 * caller sends the whole list with its one change. Every layout is re-read because a parent's drawer
 * on another board lists this item's blockers too.
 */
export async function setBlockers(
  ideaId: string,
  boardId: string,
  ideaIds: string[],
): Promise<ActionState> {
  try {
    await apiPut(apiPath`/ideas/${ideaId}/blocked-by`, { ideaIds })
  } catch (error) {
    return { error: refusal(error) }
  }

  revalidateIdeaScreens(boardId)
  revalidatePath('/', 'layout')
  return { error: null }
}

/** Remove a task from its parent. The API soft-deletes the card, so the parent's lock follows. */
export async function removeBoardTask(
  ideaId: string,
  taskId: string,
  boardId: string,
  taskBoardId: string,
): Promise<ActionState> {
  try {
    await apiDelete(apiPath`/ideas/${ideaId}/board-tasks/${taskId}`)
  } catch (error) {
    return { error: refusal(error) }
  }

  revalidateTaskScreens(boardId, taskBoardId)
  return { error: null }
}
