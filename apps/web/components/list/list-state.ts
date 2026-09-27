/**
 * A list screen's state — text filter, multi-select filters, sort, page, page size and view — and
 * its round trip through the URL (`SPEC/20-feature-client-ui.md`, "List and detail pattern").
 *
 * Pure, so a server page can read the same state from `searchParams` that the client hook
 * (`use-list-state.ts`) writes. Defaults are left out of the URL, so a bare path is the default
 * list and a shared link carries only what the reader changed.
 *
 * Parameter names: `q`, one repeated parameter per filter key (`status=a&status=b`), `sort`, `dir`,
 * `page`, `size`, `view`.
 */

export const PAGE_SIZES = [10, 25, 50, 100] as const
export type PageSize = (typeof PAGE_SIZES)[number]
export const DEFAULT_PAGE_SIZE: PageSize = 10

export type SortDir = 'asc' | 'desc'
export type Sort = { key: string; dir: SortDir }

export type ListView = 'list' | 'cards' | 'lanes'

export type ListState = {
  q: string
  filters: Record<string, string[]>
  sort: Sort | null
  page: number
  size: PageSize
  view: ListView
}

export type ListConfig = {
  /** The multi-select filter keys this screen reads, e.g. `['board', 'status']`. */
  filters?: readonly string[]
  /** Values a filter starts with when the URL names none (Boards: `status=Active`). */
  filterDefaults?: Readonly<Record<string, readonly string[]>>
  /** The views offered, the first being the default. */
  views?: readonly ListView[]
  /** Column keys that may be sorted by; anything else in the URL is ignored. */
  sortKeys?: readonly string[]
}

/** What a server page's `searchParams` or a `URLSearchParams` looks like, read uniformly. */
export type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>

function all(source: ParamSource, key: string): string[] {
  if (source instanceof URLSearchParams) return source.getAll(key)
  const value = source[key]
  return value === undefined ? [] : Array.isArray(value) ? value : [value]
}

const one = (source: ParamSource, key: string) => all(source, key)[0]

/**
 * A filter the reader cleared on purpose has to differ from one never touched, or a filter with a
 * default (Boards' Active) could never be emptied: `status=` (present, empty) means "none".
 */
const NONE = ''

export function readListState(source: ParamSource, config: ListConfig = {}): ListState {
  const views = config.views ?? ['list']
  const filters: Record<string, string[]> = {}
  for (const key of config.filters ?? []) {
    const values = all(source, key)
    filters[key] =
      values.length === 0
        ? [...(config.filterDefaults?.[key] ?? [])]
        : values.filter((value) => value !== NONE)
  }

  const sortKey = one(source, 'sort')
  const sort =
    sortKey && (!config.sortKeys || config.sortKeys.includes(sortKey))
      ? { key: sortKey, dir: one(source, 'dir') === 'desc' ? ('desc' as const) : ('asc' as const) }
      : null

  const page = Number.parseInt(one(source, 'page') ?? '', 10)
  const size = Number(one(source, 'size'))
  const view = one(source, 'view') as ListView | undefined

  return {
    q: one(source, 'q') ?? '',
    filters,
    sort,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    size: (PAGE_SIZES as readonly number[]).includes(size) ? (size as PageSize) : DEFAULT_PAGE_SIZE,
    view: view && views.includes(view) ? view : (views[0] ?? 'list'),
  }
}

/** The query string for a state, omitting every default. No leading `?`. */
export function listStateToQuery(state: ListState, config: ListConfig = {}): string {
  const params = new URLSearchParams()
  if (state.q) params.set('q', state.q)
  for (const key of config.filters ?? []) {
    const values = state.filters[key] ?? []
    const defaults = config.filterDefaults?.[key] ?? []
    if (sameSet(values, defaults)) continue
    if (values.length === 0) params.append(key, NONE)
    for (const value of values) params.append(key, value)
  }
  if (state.sort) {
    params.set('sort', state.sort.key)
    if (state.sort.dir === 'desc') params.set('dir', 'desc')
  }
  if (state.page > 1) params.set('page', String(state.page))
  if (state.size !== DEFAULT_PAGE_SIZE) params.set('size', String(state.size))
  if (state.view !== (config.views?.[0] ?? 'list')) params.set('view', state.view)
  return params.toString()
}

function sameSet(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((value) => b.includes(value))
}

/** A header click: ascending, then descending, then off. */
export function nextSort(current: Sort | null, key: string): Sort | null {
  if (current?.key !== key) return { key, dir: 'asc' }
  return current.dir === 'asc' ? { key, dir: 'desc' } : null
}

/**
 * For lists small enough to filter in the client (Boards). The text filter matches anywhere in
 * `textOf(row)`, case-insensitively; each multi-select filter keeps a row whose value — or any of
 * its values, for a many-valued column such as tags — is selected. An empty selection keeps all.
 */
export function filterRows<T>(
  rows: readonly T[],
  state: Pick<ListState, 'q' | 'filters'>,
  textOf: (row: T) => string,
  valuesOf: (row: T, key: string) => string | readonly string[],
): T[] {
  const q = state.q.trim().toLowerCase()
  return rows.filter(
    (row) =>
      (!q || textOf(row).toLowerCase().includes(q)) &&
      Object.entries(state.filters).every(([key, selected]) => {
        if (selected.length === 0) return true
        const value = valuesOf(row, key)
        return typeof value === 'string'
          ? selected.includes(value)
          : value.some((v) => selected.includes(v))
      }),
  )
}

/** For lists small enough to sort in the client (Boards). A server-paged list sorts in the API. */
export function sortRows<T>(
  rows: readonly T[],
  sort: Sort | null,
  sortValue: (row: T, key: string) => string | number | null | undefined,
): T[] {
  if (!sort) return [...rows]
  const sign = sort.dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = sortValue(a, sort.key) ?? ''
    const y = sortValue(b, sort.key) ?? ''
    const order =
      typeof x === 'number' && typeof y === 'number'
        ? x - y
        : String(x).localeCompare(String(y), undefined, { sensitivity: 'base', numeric: true })
    return order * sign
  })
}

/** One page of an already filtered and sorted list, with the page clamped into range. */
export function pageRows<T>(rows: readonly T[], page: number, size: number) {
  const pageCount = Math.max(1, Math.ceil(rows.length / size))
  const current = Math.min(Math.max(1, page), pageCount)
  return { rows: rows.slice((current - 1) * size, current * size), page: current, pageCount }
}
