'use client'

import type { Route } from 'next'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { type ListConfig, type ListState, listStateToQuery, readListState } from './list-state'

/**
 * The list state in the URL, from a client component. `update` merges a patch and replaces the
 * history entry (a filter keystroke is not a place to go back to) without scrolling.
 *
 * Any change other than the page itself returns to page 1 — a filter or a new page size that kept
 * the reader on page 7 of a list now three pages long would show nothing. Pass `page` in the same
 * patch to override.
 *
 * `config` should be a stable reference (a module-level constant).
 */
export function useListState(config: ListConfig) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const state = useMemo(() => readListState(params, config), [params, config])

  const update = useCallback(
    (patch: Partial<ListState>) => {
      const next: ListState = { ...state, page: 1, ...patch }
      // Other parameters on the route (an open drawer's `?idea=`) are the screen's, not the list's.
      const merged = new URLSearchParams(params)
      for (const key of ['q', 'sort', 'dir', 'page', 'size', 'view', ...(config.filters ?? [])]) {
        merged.delete(key)
      }
      for (const [key, value] of new URLSearchParams(listStateToQuery(next, config))) {
        merged.append(key, value)
      }
      const query = merged.toString()
      router.replace(`${pathname}${query ? `?${query}` : ''}` as Route, { scroll: false })
    },
    [state, params, pathname, router, config],
  )

  return [state, update] as const
}
