// Paging, shared by every list endpoint.

export type PageRequest = {
  /** 1-based. */
  readonly page: number
  readonly pageSize: number
}

export type Page<T> = {
  readonly items: readonly T[]
  readonly page: number
  readonly pageSize: number
  readonly totalCount: number
}

// These are NOT free choices. The golden corpus - 447 recorded cases that Wave F replays
// against Nest - was captured from the .NET API, whose PageRequest used exactly these two
// numbers. Changing either silently changes what a page contains for every list endpoint
// that does not pass an explicit size, and the replay diff would read as a data bug rather
// than as a wrong constant. Source: src/Collega.Application/Common (DefaultPageSize,
// MaxPageSize), while the .NET solution still exists to check against.
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

export function normalizePageRequest(request: Partial<PageRequest> | undefined): PageRequest {
  const page = Math.max(1, Math.trunc(request?.page ?? 1))
  const requested = Math.trunc(request?.pageSize ?? DEFAULT_PAGE_SIZE)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requested))
  return { page, pageSize }
}

export function toPage<T>(
  items: readonly T[],
  totalCount: number,
  { page, pageSize }: PageRequest,
): Page<T> {
  return { items, page, pageSize, totalCount }
}

/**
 * A list query MUST have a total order, and it must be asserted concretely.
 *
 * The golden capture found four endpoints ordering by something that ties, broken only by
 * generated id - stable inside one deployment, not between two seeded from the same data.
 * Under paging an arbitrary tie-break does not merely reorder a page, it decides what is on
 * it. Tie-break on something stable and meaningful: email, not id, where the two differ.
 */
export type SortDirection = 'asc' | 'desc'
