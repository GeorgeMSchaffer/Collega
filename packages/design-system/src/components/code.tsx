import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn.js'

/**
 * Inline monospace, for a literal the reader may have to type or copy exactly: a CSV column name, a
 * prompt placeholder, a generated temporary password, an invite code.
 *
 * It is a primitive rather than a utility class because the distinction it draws is semantic — `<code>`
 * tells a screen reader this is a literal, which matters most for exactly the strings here, where a
 * mis-heard character makes the value useless.
 */
export function Code({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <code className={cn('font-mono text-xs', className)} {...props} />
}

/** A bordered chip for a literal that stands on its own — an invite code, a temporary password. */
export function CodeChip({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <code
      className={cn(
        'inline-block rounded-md border bg-muted px-1.5 py-0.5 font-mono text-xs',
        className,
      )}
      {...props}
    />
  )
}
