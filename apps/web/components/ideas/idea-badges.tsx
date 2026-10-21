import { cn } from '@collega/design-system'

export const WARN_BADGE =
  'inline-flex w-fit items-center gap-1.5 rounded-sm bg-warning/12 px-2 text-xs font-semibold text-warning'

/** The parent's key as a chip: on a task's drawer and on a work-board card (comp U screens 3 and 6). */
export function ParentChip({ itemKey, className }: { itemKey: string | null; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-1.5 font-mono text-[10.5px] leading-[17px] font-medium whitespace-nowrap text-primary',
        className,
      )}
    >
      <span aria-hidden="true">↳</span>
      {itemKey ?? 'Parent'}
    </span>
  )
}
