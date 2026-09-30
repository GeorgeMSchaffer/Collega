'use client'

import { Button } from '@collega/design-system'
import { type ReactNode, useEffect, useState } from 'react'

/** Per browser, like the theme: dismissing it is a convenience, not a setting worth an account. */
const DISMISSED = 'collega.home.first-run-dismissed'

/**
 * Home's dismissible "New to Collega?" strip.
 *
 * Hidden until mounted, because only the browser knows whether it was dismissed. Rendering it first
 * and hiding it after would flash it at every returning reader, which is the common case.
 */
export function FirstRunStrip({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(DISMISSED) !== '1')
    } catch {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  function dismiss() {
    setVisible(false)
    try {
      window.localStorage.setItem(DISMISSED, '1')
    } catch {
      // Storage refused (a private window): the strip returns next visit, which is harmless.
    }
  }

  return (
    <section
      aria-label="Getting started"
      className="flex flex-wrap items-center gap-4 rounded-lg border border-l-4 border-l-primary bg-card px-4 py-3 text-sm"
    >
      <div className="min-w-0 flex-1">{children}</div>
      <Button variant="outline" size="sm" onClick={dismiss}>
        Got it
      </Button>
    </section>
  )
}
