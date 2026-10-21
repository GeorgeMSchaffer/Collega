import { Role } from '@collega/domain/enums'
import { ForbiddenError } from '../common/index.js'

// The reference-lane lock (SPEC/decisions.md 2026-10-16, SPEC/20-feature-board-references.md
// Behavior 4): a card in a lane that references a board cannot leave it - by a move, a detach or a
// pull onto another board - while any of its tasks is not in a final lane. An Org Admin may force
// the exit with a reason, which is audited; the tasks are left where they are.

export const PARENT_HAS_OPEN_TASKS = 'parentHasOpenTasks'
export const IDEA_MOVED_PAST_OPEN_TASKS = 'IdeaMovedPastOpenTasks'

/**
 * The override reason as the request sent it: `null` when absent or blank, so a blank reason
 * overrides nothing. Anyone but an Org Admin (the effective role, so View As counts as the target)
 * sending one is refused, whether or not the card is locked.
 */
export function readForceReason(forceReason: string | null | undefined, role: Role): string | null {
  if (forceReason === undefined || forceReason === null) {
    return null
  }
  if (role !== Role.OrgAdmin) {
    throw new ForbiddenError('Only an Org Admin can move an item past its open tasks.')
  }
  const trimmed = forceReason.trim()
  return trimmed === '' ? null : trimmed
}

/** How many of a card's tasks hold its exit, from `IdeaRepository.countChildrenByParentIds`. Zero
 * when the card is not in a reference lane or has no tasks: there is nothing to wait on. */
export function openTasksHoldingExit(
  inReferenceLane: boolean,
  counts: { readonly total: number; readonly done: number } | undefined,
): number {
  return inReferenceLane && counts !== undefined ? counts.total - counts.done : 0
}

/** The `IdeaMovedPastOpenTasks` audit message and metadata (reason, open task count). */
export function movedPastOpenTasksAudit(
  title: string,
  openTasks: number,
  reason: string,
): { readonly message: string; readonly metadata: { reason: string; openTaskCount: number } } {
  return {
    message: `Idea '${title}' moved past ${openTasks} open tasks.`,
    metadata: { reason, openTaskCount: openTasks },
  }
}
