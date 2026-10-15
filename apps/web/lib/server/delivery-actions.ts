'use server'

/**
 * The delivery writes: move an Issue between delivery statuses, start, complete and create a
 * sprint, and an Issue's checklist.
 *
 * As in `idea-actions.ts`, nothing here reads the principal. The organization and the ids are
 * parameters bound by the screen that rendered the control, and the API decides what the session
 * cookie may do — these functions are endpoints anyone can post to, so the screens' hiding of a
 * control is a courtesy and the refusals are the API's.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ApiError, apiDelete, apiPath, apiPost, apiPostReturning, apiPut } from '../api/client'
import type { WireCreatedIdea } from '../api/wire'
import { actingOrganizationId } from './current-user'
import type { IdeaInput, SaveIdeaResult } from './idea-actions'

export type DeliveryResult = { error: string | null }

export type SprintInput = {
  name: string
  goal: string
  startDate: string
  endDate: string
  ownerUserId: string
}

export type CreateSprintResult =
  | { ok: true }
  | { ok: false; error: string | null; errors: Readonly<Record<string, string>> }

/** A refusal's message; a 401 goes back to sign-in and anything that is not an answer rethrows. */
function refusal(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) redirect('/login?expired=1')
    if ([400, 403, 404, 409].includes(error.status)) return error.detail
  }
  throw error
}

function revalidateDelivery(): void {
  revalidatePath('/delivery/sprint')
  revalidatePath('/delivery/backlog')
  revalidatePath('/delivery/roadmap')
}

async function attempt(write: () => Promise<unknown>): Promise<DeliveryResult> {
  try {
    await write()
  } catch (error) {
    return { error: refusal(error) }
  }
  revalidateDelivery()
  return { error: null }
}

/** The idea form's fields as `saveIdea` takes them, less the board, plus the two an Issue needs. */
export type IssueInput = Omit<IdeaInput, 'ideaId' | 'boardId'> & {
  effort: 'Low' | 'Medium' | 'High'
  /** Empty adds it to the Backlog. */
  sprintId: string
}

/**
 * Add an Issue directly (`POST /organizations/{organizationId}/issues`): a board-less idea promoted
 * in the same commit. The answer is `saveIdea`'s, so the form reads a 400's field errors (`effort`
 * and `sprintId` included) the same way. The org is read from the session rather than passed, since
 * the form has no other use for it.
 */
export async function addIssue(input: IssueInput): Promise<SaveIdeaResult> {
  let ideaId: string
  try {
    const organizationId = await actingOrganizationId()
    if (organizationId === null) {
      return {
        ok: false,
        error: 'An App Admin belongs to no organization. Use View As to act as a member of one.',
        errors: {},
      }
    }
    const created = await apiPostReturning<WireCreatedIdea>(
      apiPath`/organizations/${organizationId}/issues`,
      {
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
        effort: input.effort,
        sprintId: input.sprintId || null,
      },
    )
    ideaId = created.ideaId
  } catch (error) {
    const message = refusal(error)
    const errors = error instanceof ApiError ? error.errors : {}
    return { ok: false, error: Object.keys(errors).length > 0 ? null : message, errors }
  }

  revalidateDelivery()
  // The new idea is on no board, but the sidebar's counts and the Ideas list read it.
  revalidatePath('/ideas')
  revalidatePath('/', 'layout')
  return { ok: true, ideaId }
}

export async function setDeliveryStatus(
  ideaId: string,
  deliveryStatus: string,
): Promise<DeliveryResult> {
  return attempt(() => apiPut(apiPath`/ideas/${ideaId}/delivery-status`, { deliveryStatus }))
}

export async function startSprint(
  organizationId: string,
  sprintId: string,
): Promise<DeliveryResult> {
  return attempt(() => apiPost(apiPath`/organizations/${organizationId}/sprints/${sprintId}/start`))
}

export async function completeSprint(
  organizationId: string,
  sprintId: string,
): Promise<DeliveryResult> {
  return attempt(() =>
    apiPost(apiPath`/organizations/${organizationId}/sprints/${sprintId}/complete`),
  )
}

export async function createSprint(
  organizationId: string,
  input: SprintInput,
): Promise<CreateSprintResult> {
  try {
    await apiPost(apiPath`/organizations/${organizationId}/sprints`, {
      name: input.name,
      goal: input.goal || null,
      startDate: input.startDate,
      endDate: input.endDate,
      ownerUserId: input.ownerUserId || null,
    })
  } catch (error) {
    const message = refusal(error)
    const errors = error instanceof ApiError ? error.errors : {}
    return { ok: false, error: Object.keys(errors).length > 0 ? null : message, errors }
  }
  revalidateDelivery()
  return { ok: true }
}

export async function addTask(
  ideaId: string,
  title: string,
  assigneeUserId: string,
): Promise<DeliveryResult> {
  return attempt(() =>
    apiPost(apiPath`/ideas/${ideaId}/tasks`, {
      title,
      assigneeUserId: assigneeUserId || null,
    }),
  )
}

/** Rename and reassign together: `PUT` replaces both. */
export async function updateTask(
  ideaId: string,
  taskId: string,
  title: string,
  assigneeUserId: string,
): Promise<DeliveryResult> {
  return attempt(() =>
    apiPut(apiPath`/ideas/${ideaId}/tasks/${taskId}`, {
      title,
      assigneeUserId: assigneeUserId || null,
    }),
  )
}

export async function setTaskState(
  ideaId: string,
  taskId: string,
  state: string,
): Promise<DeliveryResult> {
  return attempt(() => apiPut(apiPath`/ideas/${ideaId}/tasks/${taskId}/state`, { state }))
}

/** The whole checklist's order, every task exactly once. */
export async function reorderTasks(ideaId: string, taskIds: string[]): Promise<DeliveryResult> {
  return attempt(() => apiPut(apiPath`/ideas/${ideaId}/tasks/order`, { taskIds }))
}

export async function deleteTask(ideaId: string, taskId: string): Promise<DeliveryResult> {
  return attempt(() => apiDelete(apiPath`/ideas/${ideaId}/tasks/${taskId}`))
}
