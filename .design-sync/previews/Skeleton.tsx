import { Skeleton } from '@collega/design-system'

/** A placeholder bar. Uneven widths are the point — equal bars read as a designed pattern. */
export const Bars = () => (
  <div className="flex w-96 flex-col gap-3">
    <Skeleton className="w-[92%]" />
    <Skeleton className="w-[78%]" />
    <Skeleton className="w-[85%]" />
    <Skeleton className="w-[64%]" />
  </div>
)

export const Sizes = () => (
  <div className="flex w-96 flex-col gap-3">
    <Skeleton className="h-8 w-1/2" />
    <Skeleton className="w-full" />
    <Skeleton className="h-3 w-1/3" />
  </div>
)

/** The shape of an absent card: a title bar, two lines, and an action-sized block. */
export const CardShape = () => (
  <div className="w-96 rounded-lg border border-border bg-card p-5">
    <Skeleton className="mb-4 h-5 w-1/3" />
    <Skeleton className="mb-2 w-[88%]" />
    <Skeleton className="mb-4 w-[71%]" />
    <Skeleton className="h-9 w-28" />
  </div>
)
