'use client'

import { track } from '@vercel/analytics'
import { useEffect } from 'react'

/**
 * Records `board.viewed` once the board page is on screen. From the browser rather than the
 * render, so a server render costs no extra request; with `<PageAnalytics>` not mounted the
 * script is absent and the call goes nowhere.
 */
export function BoardViewed() {
  useEffect(() => {
    track('board.viewed')
  }, [])
  return null
}
