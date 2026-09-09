import { Skeleton, SkeletonRegion, SkeletonRows } from '@collega/design-system'

/**
 * Wraps a group of skeletons and announces the wait once. The visually hidden label is what
 * actually reaches a screen reader — `aria-busy` alone is silent in many of them.
 */
export const Default = () => (
  <div className="w-96">
    <SkeletonRegion label="Loading ideas">
      <SkeletonRows rows={4} />
    </SkeletonRegion>
  </div>
)

export const CustomLabel = () => (
  <div className="w-96">
    <SkeletonRegion label="Loading the delivery roadmap">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="w-[88%]" />
      <Skeleton className="w-[71%]" />
    </SkeletonRegion>
  </div>
)

/** A whole card standing in for content that has not arrived. */
export const CardShape = () => (
  <div className="w-96 rounded-lg border border-border bg-card p-5">
    <SkeletonRegion label="Loading assist budget">
      <Skeleton className="h-5 w-2/5" />
      <SkeletonRows rows={3} />
    </SkeletonRegion>
  </div>
)
