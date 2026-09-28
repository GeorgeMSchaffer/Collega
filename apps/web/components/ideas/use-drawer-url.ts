'use client'

import type { Route } from 'next'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { DRAWER_PARAMS } from './idea-list-config'

type Target = { view: string } | { edit: string } | { create: true } | null

/**
 * Opens, switches and closes the idea drawer by changing the URL, which the server page reads. A
 * history entry each time, so back and forward walk the drawer open and closed; the list's own
 * parameters ride along untouched.
 */
export function useDrawerUrl() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  return useCallback(
    (target: Target) => {
      const next = new URLSearchParams(params)
      for (const key of Object.values(DRAWER_PARAMS)) next.delete(key)
      if (target && 'create' in target) next.set(DRAWER_PARAMS.create, '1')
      if (target && 'view' in target) next.set(DRAWER_PARAMS.idea, target.view)
      if (target && 'edit' in target) {
        next.set(DRAWER_PARAMS.idea, target.edit)
        next.set(DRAWER_PARAMS.edit, '1')
      }
      const query = next.toString()
      router.push(`${pathname}${query ? `?${query}` : ''}` as Route, { scroll: false })
    },
    [router, pathname, params],
  )
}
