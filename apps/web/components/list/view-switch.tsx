'use client'

import { cn } from '@collega/design-system'
import type { ListView } from './list-state'

const LABELS: Record<ListView, string> = { list: 'List', cards: 'Cards', lanes: 'Lanes' }

/** Comp R's `.seg`: a toggle group of the views a screen offers, in the order given. */
export function ViewSwitch({
  views,
  value,
  onChange,
}: {
  views: readonly ListView[]
  value: ListView
  onChange: (view: ListView) => void
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a group of toggle buttons, not a form fieldset
    <div role="group" aria-label="View" className="inline-flex rounded-md bg-muted p-0.5">
      {views.map((view) => (
        <button
          key={view}
          type="button"
          aria-pressed={view === value}
          onClick={() => onChange(view)}
          className={cn(
            'rounded-sm px-3 py-1 text-[13px] text-muted-foreground hover:text-foreground',
            view === value && 'bg-card font-semibold text-foreground shadow-xs',
          )}
        >
          {LABELS[view]}
        </button>
      ))}
    </div>
  )
}
