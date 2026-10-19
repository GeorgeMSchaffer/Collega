import type { Idea, LaneFlags, Status } from '@/lib/types'

/**
 * What a board's cards can tell a reader before the server is asked (Board References, comp U
 * screens 2 and 3; `decisions.md` 2026-10-16 and 2026-10-19).
 *
 * These are **up-front UX guards that mirror the server's rules**, not the rules: the lock
 * (`parentHasOpenTasks`), the missing Effort (`effortRequiredForReferenceLane`) and a blocked task
 * (`taskBlocked`) are decided in `packages/application`, and a request that gets past a stale page
 * is still refused there. The client shows the reason where the control would have been, so a drop
 * never bounces.
 */

/** A lane as the board page has it: the display fields, and the Board References flags when read. */
export type WorkLane = Status & Partial<LaneFlags>

type CardFacts = Pick<Idea, 'statusId' | 'effort' | 'taskCounts' | 'blockedBy'>

/** The tooltip on a lane that refuses a card with no Effort (decided 2026-10-19, answer 2). */
export const NO_EFFORT_TEXT = 'Add Effort first'

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

/** "Waiting on 3 tasks": comp T's lock text, on the card and on every disabled control. */
export const waitingText = (openTasks: number) => `Waiting on ${plural(openTasks, 'task')}`

/**
 * How many of a card's tasks hold it in its lane: tasks not in a final lane, and only while the
 * card sits in a lane that references a board. A card with no tasks, or whose tasks are all final,
 * is free (comp T screen 4).
 */
export function openTaskCount(idea: CardFacts, lane: WorkLane | undefined): number {
  if (!lane?.referencesBoardId || !idea.taskCounts) return 0
  return Math.max(0, idea.taskCounts.total - idea.taskCounts.done)
}

/** The rollup beside the key on a reference-lane card: "1 of 4 tasks", "0 of 1 task", "0 tasks". */
export function rollupText(taskCounts: Idea['taskCounts']): string {
  if (!taskCounts || taskCounts.total === 0) return '0 tasks'
  return `${taskCounts.done} of ${plural(taskCounts.total, 'task')}`
}

/** The progress bar's fill: tasks done of total. */
export function progressPercent(taskCounts: Idea['taskCounts']): number {
  if (!taskCounts || taskCounts.total === 0) return 0
  return Math.round((taskCounts.done / taskCounts.total) * 100)
}

function openBlockers(idea: Pick<Idea, 'blockedBy'>) {
  return idea.blockedBy.filter((blocker) => !blocker.isFinal)
}

/**
 * Whether the blocked badge, and the refusal to leave, apply: a blocker still open, and the card
 * still in its board's first lane (decided 2026-10-19, answers 4 and 7). A blocker added after the
 * task left the first lane is allowed and shows nothing.
 */
export function isBlockedHere(idea: CardFacts, lanes: readonly WorkLane[]): boolean {
  return openBlockers(idea).length > 0 && lanes[0]?.id === idea.statusId
}

/** The badge: "blocked by IMPL-48 +1" (comp U screen 3, COPY PROPOSED there). */
export function blockedBadge(idea: Pick<Idea, 'blockedBy'>): string {
  const open = openBlockers(idea)
  const first = open[0]
  if (!first) return ''
  const name = first.itemKey ?? plural(open.length, 'task')
  return first.itemKey && open.length > 1
    ? `blocked by ${name} +${open.length - 1}`
    : `blocked by ${name}`
}

/** The tooltip that names the blocker (comp U screen 6 frame B, COPY PROPOSED there). */
export function blockedTooltip(idea: Pick<Idea, 'blockedBy'>): string {
  const open = openBlockers(idea)
  const first = open[0]
  if (!first) return ''
  if (!first.itemKey) return `Blocked by ${plural(open.length, 'open task')}`
  return open.length > 1
    ? `Blocked by ${first.itemKey} and ${open.length - 1} more`
    : `Blocked by ${first.itemKey}`
}

/**
 * Why a card may not be dropped on `toStatusId`, or `null` when it may. The first reason that
 * applies wins: the lock, then a blocker, then a missing Effort. `null` too for a lane this board
 * does not have, or the card's own.
 */
export function moveRefusal(
  idea: CardFacts,
  lanes: readonly WorkLane[],
  toStatusId: string,
): string | null {
  const from = lanes.find((lane) => lane.id === idea.statusId)
  const to = lanes.find((lane) => lane.id === toStatusId)
  if (!from || !to || from.id === to.id) return null
  const open = openTaskCount(idea, from)
  if (open > 0) return waitingText(open)
  if (isBlockedHere(idea, lanes) && lanes[0]?.id !== to.id) return blockedTooltip(idea)
  if (to.referencesBoardId && !idea.effort) return NO_EFFORT_TEXT
  return null
}
