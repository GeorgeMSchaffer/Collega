'use server'

/**
 * The Tasks page's one write: move a board's tasks into one of its sprints in a single request
 * (`PUT /boards/{boardId}/sprint-assignments`, all or nothing). The API names the refused item's key
 * under `errors.ideaIds`, and that sentence is shown as it came.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ApiError, apiPath, apiPut } from '../api/client'
import type { ActionState } from './idea-actions'
import { ruleMessage } from './rule-messages'

export async function moveTasksToSprint(
  boardId: string,
  sprintId: string,
  ideaIds: string[],
): Promise<ActionState> {
  try {
    await apiPut(apiPath`/boards/${boardId}/sprint-assignments`, { ideaIds, sprintId })
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) redirect('/login?expired=1')
      if ([400, 403, 404, 409, 422].includes(error.status)) {
        const keyed = Object.values(error.errorLists).flat().join(' ')
        return { error: keyed || ruleMessage(error.detail) }
      }
    }
    throw error
  }

  revalidatePath('/tasks')
  revalidatePath(`/boards/${encodeURIComponent(boardId)}`)
  revalidatePath('/delivery/backlog')
  revalidatePath('/delivery/sprint')
  return { error: null }
}
