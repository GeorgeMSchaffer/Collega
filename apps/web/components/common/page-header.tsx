import { cn } from '@collega/design-system'
import type { ReactNode } from 'react'

/**
 * A screen's title block (comp R `.pghead`): the one `<h1>` and a one-line description on the
 * left, and the screen's single creation action — worded **Add New {Item}** — on the right,
 * vertically centred on that block (`SPEC/20-feature-client-ui.md`, "List and detail pattern").
 *
 * Every desk screen renders exactly one of these, or another single `<h1>`. The top bar above it is
 * a breadcrumb, not a heading.
 */
export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  /** The creation action, or a denied one with its reason (`GatedAction`). */
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="m-0">{title}</h1>
        {description ? (
          <p className="m-0 mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  )
}
