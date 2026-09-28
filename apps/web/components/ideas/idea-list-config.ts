/**
 * The two idea lists' URL state, and how it becomes an API query. Plain functions, so the server
 * page reads the same state from `searchParams` that the client workspace writes.
 *
 * Every column the lists display sorts, because the API has a `sortBy` for each
 * (`SPEC/30-Contracts.md`): the sort keys here *are* those values, so nothing translates between
 * them. The organization list adds `board`; a board's own list has no Board column to sort.
 */

import type { ListConfig, ListState } from '@/components/list/list-state'
import type { IdeaListQuery } from '@/lib/types'

export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const

const BOARD_SORT_KEYS = ['title', 'status', 'priority', 'assignedTo', 'tags', 'upvoteCount']

export const IDEAS_LIST: ListConfig = {
  filters: ['board', 'status', 'priority', 'tag'],
  views: ['list', 'cards'],
  sortKeys: ['title', 'board', ...BOARD_SORT_KEYS.slice(1)],
}

export const BOARD_LIST: ListConfig = {
  filters: ['status', 'priority', 'tag'],
  views: ['lanes', 'list'],
  sortKeys: BOARD_SORT_KEYS,
}

/** The lanes view shows every filtered card at once, up to the API's page maximum. */
export const LANES_PAGE_SIZE = 100

/**
 * The drawer's own URL parameters, beside the list's: `?idea={id}` is the view (the deep link the
 * spec names), `&edit=1` its form, and `?new=1` the create form.
 */
export const DRAWER_PARAMS = { idea: 'idea', edit: 'edit', create: 'new' } as const

export function toIdeaListQuery(state: ListState): IdeaListQuery {
  const lanes = state.view === 'lanes'
  return {
    search: state.q,
    boardIds: state.filters.board ?? [],
    statusIds: state.filters.status ?? [],
    priorities: state.filters.priority ?? [],
    tags: state.filters.tag ?? [],
    sortBy: state.sort?.key ?? null,
    sortDirection: state.sort?.dir ?? 'asc',
    page: lanes ? 1 : state.page,
    pageSize: lanes ? LANES_PAGE_SIZE : state.size,
  }
}
