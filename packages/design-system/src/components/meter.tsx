import { cn } from '../lib/cn.js'

/**
 * Comp Q's `.meter` — a proportion bar, used by the AI budget on `/settings/api-usage`.
 *
 * `<progress>` would be the obvious element and is the wrong one: comp Q renders the figure as text
 * beside the bar ("3.2M of 5M tokens · 64%"), so the bar is a duplicate of information already in
 * the accessibility tree. A second announcement of the same number is noise, which is why this is
 * `aria-hidden` and the caller keeps the text.
 *
 * The variant is the caller's, not derived from `pct` here. What counts as "warn" is a product
 * decision about the daily cap (SPEC/20-feature-ai-idea-assist.md rule 28a), and burying a
 * threshold in a presentational primitive is how it ends up disagreeing with the server's.
 */
export function Meter({
  pct,
  variant = 'ok',
  className,
}: {
  /** 0-100. Clamped, because a budget can be overshot by one in-flight turn (rule 28a). */
  pct: number
  variant?: 'ok' | 'warn' | 'over'
  className?: string
}) {
  const fill = {
    ok: 'bg-primary',
    warn: 'bg-[var(--warning)]',
    over: 'bg-destructive',
  }[variant]

  return (
    <span
      aria-hidden="true"
      className={cn('block h-2.5 w-full overflow-hidden rounded-full border bg-muted', className)}
    >
      <span
        className={cn('block h-full rounded-full', fill)}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </span>
  )
}
