import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn.js'

/** A keycap. Comp Q renders `Ctrl K` this way in both the sidebar and the auth pitch. */
export function Kbd({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'rounded-sm border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

/** Initials on a muted disc. No image variant yet — nothing in comp P uploads an avatar. */
export function Avatar({
  initials,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { initials: string }) {
  return (
    <span
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-foreground',
        className,
      )}
      aria-hidden="true"
      {...props}
    >
      {initials}
    </span>
  )
}

/** An `<hr>` rather than a div: the separator role is implicit, so it needs no ARIA of its own. */
export function Separator({ className, ...props }: HTMLAttributes<HTMLHRElement>) {
  return <hr className={cn('m-0 h-px w-full border-0 bg-border', className)} {...props} />
}
