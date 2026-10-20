import { getBoard, getBoardTasks, getIdea, getIdeaFormOptions, getIssue } from '@/lib/data'
import { currentUser, writeDenial } from '@/lib/session'
import type { IdeaDetail, IdeaFormOptions, IdeaTasks } from '@/lib/types'
import type { DrawerMode } from './idea-drawer'
import { DRAWER_PARAMS } from './idea-list-config'

type Params = Record<string, string | string[] | undefined>

const one = (params: Params, key: string) => {
  const value = params[key]
  return Array.isArray(value) ? value[0] : value
}

/**
 * The Tasks section's facts for a parent: the lane at or before the idea's own that references a
 * board, that board, the tasks, and what the reader may do. `null` for a task, an idea with no
 * board, one that has not reached a reference lane, or a board that cannot be read.
 *
 * An idea past the lane keeps the section so a late task can be added (after moving it back).
 */
async function loadTasks(idea: IdeaDetail): Promise<IdeaTasks | null> {
  if (!idea.boardId || idea.parentIdeaId) return null
  const board = await getBoard(idea.boardId)
  if (!board) return null

  const at = board.lanes.findIndex((lane) => lane.id === idea.statusId)
  let index = at
  while (index >= 0 && !board.lanes[index]?.referencesBoardId) index--
  const lane = board.lanes[index]
  if (!lane?.referencesBoardId) return null

  const user = currentUser()
  const mayWrite = writeDenial(user.role) === null && !board.isArchived
  const [tasks, referenced, options] = await Promise.all([
    getBoardTasks(idea.id),
    getBoard(lane.referencesBoardId),
    mayWrite ? getIdeaFormOptions() : null,
  ])
  if (!referenced) return null

  const next = board.lanes[index + 1]
  return {
    tasks,
    referenced: { id: referenced.id, name: referenced.name, lanes: referenced.lanes },
    referenceLane: { id: lane.id, name: lane.name },
    inLane: index === at,
    nextLane: next ? { id: next.id, name: next.name } : null,
    canMove: mayWrite && (board.allowUserStatusUpdate || user.role === 'OrgAdmin'),
    adding: options ? { members: options.members, tags: options.tags } : null,
  }
}

/**
 * What the drawer shows, read from the URL on the server: the idea, and the form's catalogs when a
 * form is open and the role may author (`canAuthor`). A form the role may not use opens as the view,
 * or not at all, rather than as a form whose save would be refused.
 *
 * `missing` is an `?idea=` the reader cannot open — deleted, another organization's, or not an id —
 * which the page reports beside the list instead of opening an empty drawer. `isIssue` says the idea
 * is in Delivery, which the detail does not: Remove from board is refused for an Issue.
 */
export async function loadIdeaDrawer(
  params: Params,
  canAuthor: boolean,
): Promise<{
  mode: DrawerMode | null
  idea: IdeaDetail | null
  formOptions: IdeaFormOptions | null
  missing: boolean
  isIssue: boolean
  tasks: IdeaTasks | null
}> {
  const ideaId = one(params, DRAWER_PARAMS.idea)
  const creating = one(params, DRAWER_PARAMS.create) !== undefined && canAuthor
  const editing = ideaId !== undefined && one(params, DRAWER_PARAMS.edit) !== undefined && canAuthor

  const [idea, formOptions, issue] = await Promise.all([
    ideaId && !creating ? getIdea(ideaId) : null,
    creating || editing ? getIdeaFormOptions() : null,
    ideaId && !creating && !editing ? getIssue(ideaId) : null,
  ])

  const mode: DrawerMode | null = creating ? 'create' : idea ? (editing ? 'edit' : 'view') : null

  return {
    mode,
    idea,
    formOptions,
    missing: ideaId !== undefined && !creating && idea === null,
    isIssue: issue !== null,
    tasks: mode === 'view' && idea && issue === null ? await loadTasks(idea) : null,
  }
}
