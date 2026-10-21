'use client'

import { type OutcomeState, outcomeState } from '@/lib/outcome-display'
import { useLocalToday } from './roadmap-timeline'

/** The Outcome's State, from the viewer's local date; the server renders a dash until hydrated. */
export function OutcomeStateText({ start, end }: { start: string; end: string }) {
  const today = useLocalToday()
  const state: OutcomeState | null = today === null ? null : outcomeState({ start, end }, today)
  return <span>{state ?? '—'}</span>
}
