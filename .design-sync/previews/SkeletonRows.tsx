import { SkeletonRegion, SkeletonRows } from '@collega/design-system'

/** The bars drawn in place of a table: rows of deliberately uneven width. */
export const Default = () => (
  <div className="w-96">
    <SkeletonRows />
  </div>
)

export const RowCounts = () => (
  <div className="flex w-96 flex-col gap-6">
    <SkeletonRows rows={2} />
    <SkeletonRows rows={6} />
  </div>
)

/** In practice it is always inside a SkeletonRegion, which announces the wait. */
export const InARegion = () => (
  <div className="w-96 rounded-lg border border-border bg-card p-5">
    <SkeletonRegion label="Loading users">
      <SkeletonRows rows={5} />
    </SkeletonRegion>
  </div>
)
