'use client'

import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { Icon } from './icons'

/**
 * Comp R's `.toolbar`: the text filter, then the multi-select filters (`children`), then whatever
 * sits at the right — the view switch (`end`).
 *
 * The text filter keeps its own draft and reports it after `debounceMs`, so a URL-backed list
 * re-reads once per pause rather than once per keystroke. A change from outside (a Clear, a back
 * navigation) replaces the draft.
 */
export function ListToolbar({
  query,
  onQueryChange,
  placeholder,
  label = 'Filter',
  debounceMs = 250,
  children,
  end,
}: {
  query: string
  onQueryChange: (query: string) => void
  /** Names what the filter matches, e.g. "Filter by title, board, status, tag, person…". */
  placeholder: string
  label?: string
  debounceMs?: number
  children?: ReactNode
  end?: ReactNode
}) {
  const id = useId()
  const [draft, setDraft] = useState(query)
  const reported = useRef(query)
  const report = useRef(onQueryChange)
  report.current = onQueryChange

  useEffect(() => {
    if (query !== reported.current) {
      reported.current = query
      setDraft(query)
    }
  }, [query])

  useEffect(() => {
    if (draft === reported.current) return
    const timer = setTimeout(() => {
      reported.current = draft
      report.current(draft)
    }, debounceMs)
    return () => clearTimeout(timer)
  }, [draft, debounceMs])

  return (
    <search className="flex flex-wrap items-center gap-2">
      <label
        htmlFor={id}
        className="m-0 flex h-[var(--control-h)] min-w-[min(100%,280px)] flex-[0_1_320px] items-center gap-1.5 rounded-md border border-input bg-card px-2.5 font-normal text-muted-foreground focus-within:border-primary focus-within:ring-2 focus-within:ring-accent"
      >
        <Icon name="search" />
        <span className="sr-only">{label}</span>
        <input
          id={id}
          type="search"
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          className="h-full border-0 bg-transparent px-0 text-foreground shadow-none focus-visible:ring-0"
        />
      </label>
      {children}
      {end ? <div className="ml-auto flex items-center gap-2">{end}</div> : null}
    </search>
  )
}
