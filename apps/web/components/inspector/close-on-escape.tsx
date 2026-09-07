'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Escape closes the inspector.
 *
 * That is the whole keyboard contract, and it is cheap **because the inspector is docked rather
 * than modal**: it is a grid column, so background content is never covered, never needs `inert`,
 * and there is no focus trap to get wrong. A modal would owe far more than this component.
 *
 * The cost of a window-level listener is that it hears every Escape on the page, including ones
 * meant for something else. The command palette in the desk shell is also open on this route, and
 * dismissing it used to navigate away from the idea as well. Two guards below keep this handler to
 * the Escapes that are actually its own.
 */
export function CloseOnEscape({ href }: { href: string }) {
  const router = useRouter()

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return

      // A modal on top of the inspector owns Escape - dismissing it must not also close the
      // inspector behind it. The palette is the only one today; the query matches any.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return

      router.push(href)
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router, href])

  return null
}
