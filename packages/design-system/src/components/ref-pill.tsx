import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn.js'

/**
 * Comp U's `.refpill`: the "↳ IMPL" mark that says a lane hands work to another board. The Statuses
 * page and the board's lane header draw the same pill, so it is one component. The caller passes
 * the target's key prefix as the children; the arrow is added here.
 */
export function RefPill({ className, children, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border border-suggest-line bg-suggest-tint px-[7px] font-mono text-xs leading-5 font-medium text-suggest',
        className,
      )}
      {...props}
    >
      <span aria-hidden="true">&#8627;</span>
      {children}
    </span>
  )
}
