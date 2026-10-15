'use client'

import { useEffect, useState } from 'react'

/**
 * Scrolls a just-added row into view and marks it `data-added` for a few seconds, which the row's
 * `data-[added]:` classes turn into the highlight. The row exists only once the refreshed list
 * arrives, so the effect re-runs whenever `rowsSignature` (the current row ids, joined) changes and
 * waits until the selector finds it. Nothing is pinned: the row appears where the active sort puts it.
 *
 * Returns the function to call with the new id; `null` clears it (a row that is not in this list).
 */
export function useAddedHighlight(
  rowsSignature: string,
  selectorFor: (id: string) => string = (id) => `[data-row-key="${CSS.escape(id)}"]`,
) {
  const [added, setAdded] = useState<string | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: rowsSignature is the trigger.
  useEffect(() => {
    if (!added) return
    const row = document.querySelector<HTMLElement>(selectorFor(added))
    if (!row) return
    row.scrollIntoView({ block: 'nearest' })
    row.dataset.added = ''
    const timer = setTimeout(() => {
      delete row.dataset.added
      setAdded(null)
    }, 4000)
    return () => {
      clearTimeout(timer)
      delete row.dataset.added
    }
  }, [added, rowsSignature])

  return setAdded
}
