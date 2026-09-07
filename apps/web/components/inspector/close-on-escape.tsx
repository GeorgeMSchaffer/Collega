'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Escape closes the inspector.
 *
 * That is the whole keyboard contract, and it is cheap **because the inspector is docked rather
 * than modal**: it is a grid column, so background content is never covered, never needs `inert`,
 * and there is no focus trap to get wrong. A modal would owe far more than this component.
 */
export function CloseOnEscape({ href }: { href: string }) {
  const router = useRouter()

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') router.push(href)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router, href])

  return null
}
