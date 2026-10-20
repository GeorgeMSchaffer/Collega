import { DRAWER_PARAMS } from '@/components/ideas/idea-list-config'
import {
  getBoardRefs,
  getIdea,
  getIdeaFormOptions,
  getIssue,
  getIssueTasks,
  getMemberOptions,
  getOutcomeOf,
} from '@/lib/data'
import type { IdeaDetail, IdeaFormOptions, Issue, IssueTask, MemberOption } from '@/lib/types'

type Params = Record<string, string | string[] | undefined>

export type IssueDrawerData = {
  issue: Issue
  idea: IdeaDetail
  tasks: IssueTask[]
  members: MemberOption[]
  /** The board the Issue sits on; null for one promoted from the pool. */
  boardName: string | null
  boardArchived: boolean
  /** Found in the roadmap read: neither the card nor the idea payload carries an `outcomeId`. */
  outcome?: { id: string; name: string; color: string } | null | undefined // undefined: not read
  /** The idea form's catalogs, read only when `&edit=1` asks for the form. */
  formOptions: IdeaFormOptions | null
}

const one = (params: Params, key: string) => {
  const value = params[key]
  return Array.isArray(value) ? value[0] : value
}

/**
 * The Issue drawer's data, from `?idea={ideaId}` on a delivery screen. The card comes from the
 * screen's own list when it is there (`inHand`), and otherwise from `GET /ideas/{ideaId}/delivery`
 * — a deep link to an Issue in another sprint, say.
 *
 * `missing` is an `?idea=` that is not an Issue this reader can see, which the page reports beside
 * the list rather than opening an empty drawer.
 */
export async function loadIssueDrawer(
  params: Params,
  inHand: readonly Issue[],
): Promise<{ drawer: IssueDrawerData | null; editing: boolean; missing: boolean }> {
  const ideaId = one(params, DRAWER_PARAMS.idea)
  if (ideaId === undefined) return { drawer: null, editing: false, missing: false }
  const editing = one(params, DRAWER_PARAMS.edit) !== undefined

  const [issue, idea, tasks, members, boards, outcome, formOptions] = await Promise.all([
    inHand.find((candidate) => candidate.id === ideaId) ?? getIssue(ideaId),
    getIdea(ideaId),
    getIssueTasks(ideaId),
    getMemberOptions(),
    getBoardRefs(),
    // A failed roadmap read costs this one field, not the drawer: undefined renders a dash.
    getOutcomeOf(ideaId).catch(() => undefined),
    editing ? getIdeaFormOptions() : null,
  ])

  if (!issue || !idea) return { drawer: null, editing: false, missing: true }

  return {
    drawer: {
      issue,
      idea,
      tasks,
      members,
      boardName: boards.find((board) => board.id === issue.boardId)?.name ?? null,
      boardArchived: boards.find((board) => board.id === issue.boardId)?.isArchived ?? false,
      outcome: outcome && { id: outcome.id, name: outcome.name, color: outcome.color },
      formOptions,
    },
    editing,
    missing: false,
  }
}
