import { cn } from '@collega/design-system'
import type { SprintState } from '@/lib/types'

/** A sprint's state as a small chip; the word carries the meaning, the tint only backs it up. */
export function SprintStateChip({ state }: { state: SprintState }) {
  return (
    <span
      className={cn(
        'rounded-full border px-2 py-0.5 text-xs font-medium',
        state === 'Active'
          ? 'border-primary/40 bg-primary/10 text-foreground'
          : 'text-muted-foreground',
      )}
    >
      {state}
    </span>
  )
}
