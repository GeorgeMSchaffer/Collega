import { waitsOn } from '@/lib/board-work'
import {
  getAssistAvailability,
  getBoard,
  getBoardIdeaList,
  getBoardTasks,
  getIdea,
  getIdeaFormOptions,
  getIssue,
} from '@/lib/data'
import { currentUser, writeDenial } from '@/lib/session'
import type { IdeaBlockers, IdeaDetail, IdeaFormOptions, IdeaTasks } from '@/lib/types'
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
  // The section is an extra: a failed read (or an idea deleted between reads) leaves it out and the
  // drawer intact, rather than failing the page.
  try {
    return await readTasks(idea, idea.boardId)
  } catch {
    return null
  }
}

async function readTasks(idea: IdeaDetail, boardId: string): Promise<IdeaTasks | null> {
  const [board, tasks] = await Promise.all([getBoard(boardId), getBoardTasks(idea.id)])
  if (!board) return null

  const at = board.lanes.findIndex((lane) => lane.id === idea.statusId)
  let index = at
  while (index >= 0 && !board.lanes[index]?.referencesBoardId) index--
  const lane = board.lanes[index]
  if (!lane?.referencesBoardId) return null

  const user = currentUser()
  const mayWrite = writeDenial(user.role) === null && !board.isArchived
  const [referenced, options] = await Promise.all([
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
 * The Blockers section's facts: the cards on the item's own board, which name the chips (a blocker
 * arrives as an id and a key) and fill the picker. Only a keyed item has the section — keys exist
 * on the boards Board References works on. One page of 100, the API's maximum: a card beyond it is
 * not offered, and a loop through one is left to the server's refusal.
 *
 * Like the Tasks section it is an extra, so a failed read leaves it out and the drawer intact.
 */
async function loadBlockers(idea: IdeaDetail): Promise<IdeaBlockers | null> {
  if (!idea.boardId || (idea.itemKey === null && idea.blockedBy.length === 0)) return null
  try {
    const { ideas } = await getBoardIdeaList(idea.boardId, {
      search: '',
      boardIds: [],
      statusIds: [],
      priorities: [],
      tags: [],
      sortBy: null,
      sortDirection: 'asc',
      page: 1,
      pageSize: 100,
    })
    return {
      candidates: ideas
        .filter((card) => card.id !== idea.id)
        .map((card) => ({
          id: card.id,
          itemKey: card.itemKey,
          title: card.title,
          statusName: card.statusName,
          parentItemKey: card.parentItemKey ?? null,
          cycle: waitsOn(ideas, card.id, idea.id),
        })),
      cards: Object.fromEntries(
        ideas.map((card) => [card.id, { title: card.title, statusName: card.statusName }]),
      ),
    }
  } catch {
    return null
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
  /** A create drawer opens with the assistant (rule 32a); false for every other mode. */
  assistAvailable: boolean
  isIssue: boolean
  tasks: IdeaTasks | null
  blockers: IdeaBlockers | null
}> {
  const ideaId = one(params, DRAWER_PARAMS.idea)
  const creating = one(params, DRAWER_PARAMS.create) !== undefined && canAuthor
  const editing = ideaId !== undefined && one(params, DRAWER_PARAMS.edit) !== undefined && canAuthor

  const [idea, formOptions, issue, assistAvailable] = await Promise.all([
    ideaId && !creating ? getIdea(ideaId) : null,
    creating || editing ? getIdeaFormOptions() : null,
    ideaId && !creating && !editing ? getIssue(ideaId) : null,
    creating ? getAssistAvailability() : false,
  ])

  const mode: DrawerMode | null = creating ? 'create' : idea ? (editing ? 'edit' : 'view') : null

  return {
    mode,
    idea,
    formOptions,
    missing: ideaId !== undefined && !creating && idea === null,
    assistAvailable,
    isIssue: issue !== null,
    tasks: mode === 'view' && idea && issue === null ? await loadTasks(idea) : null,
    blockers: mode === 'view' && idea && issue === null ? await loadBlockers(idea) : null,
  }
}
