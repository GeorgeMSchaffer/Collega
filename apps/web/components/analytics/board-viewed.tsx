'use client'

import { track } from '@vercel/analytics'
import { useEffect } from 'react'
import { recordUsage } from './usage-recorder'

/**
 * Records `board.viewed` once the board page is on screen: to Vercel Analytics with no properties,
 * and as a usage event with the board's id (`SPEC/20-feature-analytics.md` Parts 1 and 3). From the
 * browser rather than the render, so a server render costs no extra request; with `<PageAnalytics>`
 * not mounted the Vercel call goes nowhere.
 */
export function BoardViewed({ boardId }: { boardId: string }) {
  useEffect(() => {
    track('board.viewed')
    recordUsage({ type: 'board.viewed', entityId: boardId })
  }, [boardId])
  return null
}
