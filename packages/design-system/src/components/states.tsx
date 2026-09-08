import type { ReactNode } from 'react'
import { cn } from '../lib/cn.js'

/**
 * Comp Q's empty state: a heading, a sentence saying what would be here and why it matters, and
 * — only sometimes — an action.
 *
 * The action is optional because whether one belongs is a **role** question, not a layout one. An
 * administrator looking at an organization with no boards can create one; a member looking at the
 * same screen cannot, and comp Q gives them the same explanation with no button rather than a
 * control that would refuse them. Passing `action` conditionally is how that stays honest.
 *
 * Not an `Alert`: nothing has gone wrong. An empty list is a correct answer, and dressing it as a
 * warning teaches readers to distrust a working screen.
 */
export function EmptyState({
  heading,
  children,
  action,
  className,
}: {
  heading: string
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-3 rounded-lg border border-dashed bg-card px-6 py-8',
        className,
      )}
    >
      <h3 className="m-0 text-base font-semibold">{heading}</h3>
      <p className="m-0 max-w-prose text-sm text-muted-foreground">{children}</p>
      {action}
    </div>
  )
}

/**
 * Comp Q's error state: what failed, what it means for what you are looking at, and a way to retry.
 *
 * `role="alert"` because this replaces content the reader asked for — it is worth interrupting for,
 * unlike the polite `role="status"` a skeleton uses.
 *
 * The wording comp Q settles on is worth preserving: a failed read leaves nothing **stale**, only
 * absent. That distinction is the reason retrying is safe, and saying so is what stops a reader
 * wondering whether they are looking at old data.
 */
export function ErrorState({
  heading,
  children,
  action,
  className,
}: {
  heading: string
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/5 px-6 py-8',
        className,
      )}
    >
      <h3 className="m-0 text-base font-semibold text-destructive">{heading}</h3>
      <p className="m-0 max-w-prose text-sm text-muted-foreground">{children}</p>
      {action}
    </div>
  )
}
