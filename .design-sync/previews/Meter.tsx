import { Meter } from '@collega/design-system'

/**
 * The variant is the caller's, not derived from `pct` — what counts as "warn" is a product
 * decision about the daily cap, not a presentational one.
 */
export const Variants = () => (
  <div className="flex w-80 flex-col gap-4">
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">3.2M of 5M tokens &middot; 64%</span>
      <Meter pct={64} variant="ok" />
    </div>
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">4.4M of 5M tokens &middot; 88%</span>
      <Meter pct={88} variant="warn" />
    </div>
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">5.1M of 5M tokens &middot; 102%</span>
      <Meter pct={102} variant="over" />
    </div>
  </div>
)

/** `pct` is clamped, because a budget can be overshot by one in-flight turn. */
export const Range = () => (
  <div className="flex w-80 flex-col gap-3">
    <Meter pct={0} />
    <Meter pct={25} />
    <Meter pct={50} />
    <Meter pct={75} />
    <Meter pct={100} />
  </div>
)

/** How the assist budget reads on /settings/api-usage: the figure as text, the bar beside it. */
export const InContext = () => (
  <div className="w-96 rounded-lg border border-border bg-card p-5">
    <div className="mb-2 flex items-center gap-2">
      <span className="text-sm font-medium">Assist budget</span>
      <span className="ml-auto text-sm font-semibold tabular-nums">64%</span>
    </div>
    <Meter pct={64} variant="ok" />
    <p className="m-0 mt-3 text-xs text-muted-foreground">
      The window rolls over at midnight UTC.
    </p>
  </div>
)
