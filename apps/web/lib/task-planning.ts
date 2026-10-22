import type { OpenSprint, WorkBoard } from '@/lib/data/tasks'

/**
 * Whether "Move to sprint" is available for a selection on the Tasks page, and the reason when it
 * is not. An up-front guard that mirrors the server's rules (`sprintItemOnOtherBoard`, a sprint
 * belongs to one board); the API still decides.
 */
export type MoveToSprint =
  | { enabled: true; boardId: string; boardName: string; sprints: OpenSprint[] }
  | { enabled: false; reason: string }

export function moveToSprintState(
  selectedBoardIds: readonly string[],
  boards: readonly WorkBoard[],
  sprints: Record<string, OpenSprint[]>,
): MoveToSprint {
  const distinct = [...new Set(selectedBoardIds)]
  if (distinct.length === 0) return { enabled: false, reason: 'Select tasks to move.' }
  if (distinct.length > 1) {
    return {
      enabled: false,
      reason: `Selected tasks are on ${distinct.length} boards. A sprint belongs to one board, so select tasks from one board.`,
    }
  }
  const boardId = distinct[0] as string
  const board = boards.find((candidate) => candidate.id === boardId)
  const boardName = board?.name ?? 'this board'
  if (!board?.sprintsEnabled) {
    return { enabled: false, reason: `Sprints are turned off on ${boardName}.` }
  }
  const open = sprints[boardId] ?? []
  if (open.length === 0) {
    return {
      enabled: false,
      reason: `${boardName} has no Planned or Active sprint to move tasks into.`,
    }
  }
  return { enabled: true, boardId, boardName, sprints: open }
}
