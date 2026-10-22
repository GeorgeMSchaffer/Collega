'use server'

/**
 * Sprint planning from a work board's Backlog: create a sprint holding the ticked tasks, or add
 * them to a sprint that exists (`contracts/sprints.md` "Backlog and sprint planning").
 *
 * As in `idea-actions.ts`, the board and ids are parameters bound by the screen and the API decides
 * what the session may do. Both writes are all-or-nothing on the server, so a refused task leaves
 * nothing behind and the message names it.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ApiError, apiPath, apiPost, apiPut } from '../api/client'
import type { CreateSprintResult, SprintInput } from './delivery-actions'
import type { ActionState } from './idea-actions'
import { ruleMessage } from './rule-messages'

function refusal(error: unknown): {
  error: string | null
  errors: Readonly<Record<string, string>>
} {
  if (error instanceof ApiError) {
    if (error.status === 401) redirect('/login?expired=1')
    if ([400, 403, 404, 409, 422].includes(error.status)) {
      // A per-item 422 carries its "KEY: reason" message on `ideaIds`; shown as the API wrote it.
      // Several messages for one field are joined into one line.
      const errors = { ...error.errors }
      for (const [field, messages] of Object.entries(error.errorLists)) {
        if (messages.length > 0) errors[field] = messages.join(' ')
      }
      const keyed = Object.keys(errors).length > 0
      return { error: keyed ? null : ruleMessage(error.detail), errors }
    }
  }
  throw error
}

function revalidateBoard(boardId: string): void {
  revalidatePath(`/boards/${encodeURIComponent(boardId)}`)
  revalidatePath('/delivery/sprint')
  revalidatePath('/delivery/backlog')
  revalidatePath('/delivery/roadmap')
  revalidatePath('/tasks')
}

/** `POST /boards/{boardId}/sprints` with `ideaIds`: the sprint and its tasks, or neither. */
export async function createBoardSprint(
  boardId: string,
  input: SprintInput,
  ideaIds: readonly string[],
): Promise<CreateSprintResult> {
  try {
    await apiPost(apiPath`/boards/${boardId}/sprints`, {
      name: input.name,
      goal: input.goal || null,
      startDate: input.startDate,
      endDate: input.endDate,
      ownerUserId: input.ownerUserId || null,
      ...(ideaIds.length > 0 ? { ideaIds } : {}),
    })
  } catch (error) {
    return { ok: false, ...refusal(error) }
  }
  revalidateBoard(boardId)
  return { ok: true }
}

/**
 * `PUT /boards/{boardId}/sprint-assignments`: add tasks to a sprint. With a `statusId` (a lane
 * drop) the same write moves them to that lane; without one (the Add button) status is left alone.
 */
export async function moveTasksToSprint(
  boardId: string,
  sprintId: string,
  ideaIds: readonly string[],
  statusId?: string,
): Promise<ActionState> {
  try {
    await apiPut(apiPath`/boards/${boardId}/sprint-assignments`, {
      ideaIds,
      sprintId,
      ...(statusId ? { statusId } : {}),
    })
  } catch (error) {
    const { error: message, errors } = refusal(error)
    return { error: message ?? errors.ideaIds ?? Object.values(errors)[0] ?? null }
  }
  revalidateBoard(boardId)
  return { error: null }
}
