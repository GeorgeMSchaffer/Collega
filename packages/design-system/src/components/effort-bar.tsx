import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn.js'

export type Effort = 'Low' | 'Medium' | 'High'

const FILLED: Record<Effort, number> = { Low: 1, Medium: 2, High: 3 }

/**
 * Comp R's `.effbar` with its words: three short segments, one to three filled in the theme's
 * metric colour, then *Low effort*, *Medium effort* or *High effort*. The words carry the fact, so
 * the bar is hidden from assistive technology. An idea with no effort renders nothing — the caller
 * leaves it out rather than passing an empty bar.
 */
export function EffortBar({
  effort,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { effort: Effort }) {
  const filled = FILLED[effort]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[11px] font-medium text-muted-foreground',
        className,
      )}
      {...props}
    >
      <span className="inline-flex gap-0.5" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={cn('block h-1 w-2.5 rounded-[1px]', n <= filled ? 'bg-metric' : 'bg-input')}
          />
        ))}
      </span>
      {effort} effort
    </span>
  )
}
