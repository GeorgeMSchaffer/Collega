import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn.js'

/**
 * A category dot. `color` is a CSS colour or a `var(--sky)`-style token from the comp Q palette.
 *
 * Typed `string | undefined` rather than plain optional: `exactOptionalPropertyTypes` is on, and
 * callers legitimately pass a lookup that may miss, e.g. `statusById(id)?.color`.
 */
export function Dot({
  color,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { color?: string | undefined }) {
  return (
    <span
      className={cn('inline-block size-2 shrink-0 rounded-full bg-muted-foreground', className)}
      style={color ? { background: color } : undefined}
      aria-hidden="true"
      {...props}
    />
  )
}

/** Comp Q's `.marker`: a filled chip that carries a dot plus a short label, e.g. a priority. */
export function Marker({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground',
        className,
      )}
      {...props}
    />
  )
}

/** Comp Q's `.tag`: an outlined chip. Quieter than a Badge, and used for org-defined tags. */
export function Tag({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}
