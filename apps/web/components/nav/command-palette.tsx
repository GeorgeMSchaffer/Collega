'use client'

import { Kbd } from '@collega/design-system'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { NavIcon } from './icons'
import { allNavItems } from './nav-items'

/**
 * Ctrl/Cmd+K jump-to. Comp P calls the keyboard path a product property rather than a convenience,
 * so the shortcut is registered on the window and the trigger advertises it.
 *
 * Navigation only, for now. Wave D gives it something to search.
 */
export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const matches = allNavItems.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase()),
  )

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((wasOpen) => !wasOpen)
      } else if (event.key === 'Escape') {
        // Claim the key only when there is something to close, so a handler underneath - the idea
        // inspector's - still sees the Escapes this one is not using.
        setOpen((wasOpen) => {
          if (wasOpen) event.preventDefault()
          return false
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      inputRef.current?.focus()
    }
  }, [open])

  const go = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router],
  )

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((i) => (matches.length === 0 ? 0 : (i + 1) % matches.length))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => (matches.length === 0 ? 0 : (i - 1 + matches.length) % matches.length))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const target = matches[active]
      if (target) go(target.href)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-1 flex w-full items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-sm text-muted-foreground shadow-xs hover:bg-accent"
      >
        <span aria-hidden="true">⌕</span>
        <span>Search or jump&hellip;</span>
        <Kbd className="ml-auto">Ctrl K</Kbd>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/20 p-4 pt-[15vh]">
          {/* Backdrop. Keyboard users already have Escape, which is why this carries no key handler. */}
          <div className="absolute inset-0" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="relative w-full max-w-lg overflow-hidden rounded-lg border bg-popover shadow-lg"
          >
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              onKeyDown={onInputKeyDown}
              placeholder="Search or jump to…"
              aria-label="Search or jump to"
              className="!rounded-none !border-0 !border-b !shadow-none h-12 !px-4 text-sm"
            />
            <ul className="m-0 max-h-80 list-none overflow-y-auto p-1.5">
              {matches.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">No matches.</li>
              ) : (
                matches.map((item, i) => (
                  <li key={item.href}>
                    <button
                      type="button"
                      onClick={() => go(item.href)}
                      onMouseEnter={() => setActive(i)}
                      aria-current={i === active ? 'true' : undefined}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm aria-[current]:bg-accent aria-[current]:text-accent-foreground"
                    >
                      <NavIcon icon={item.icon} />
                      {item.label}
                      {item.slice ? (
                        <span className="ml-auto text-xs text-muted-foreground">{item.slice}</span>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  )
}
