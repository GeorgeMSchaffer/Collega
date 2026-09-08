import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn.js'

/**
 * A placeholder bar for content that has not arrived.
 *
 * `motion-safe:` rather than a bare `animate-pulse`: a full-page grid of pulsing bars is exactly
 * the kind of repetitive motion `prefers-reduced-motion` exists to suppress, and it can provoke
 * symptoms in vestibular disorders. Without the variant the skeleton keeps animating for readers
 * who have asked the whole system not to. The bar still reads as a placeholder when still.
 *
 * `aria-hidden` because a skeleton has nothing to announce — it is the *shape* of absent content.
 * The container says the useful thing instead, once: see `SkeletonRegion`.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      aria-hidden="true"
      className={cn('block h-4 rounded-md bg-muted motion-safe:animate-pulse', className)}
      {...props}
    />
  )
}

/**
 * Wraps a group of skeletons and announces the wait **once**.
 *
 * `aria-busy` alone is not enough: it marks a region as updating but many screen readers say
 * nothing about it, so a reader who cannot see the bars gets silence where a sighted reader gets
 * an obvious signal. The visually hidden label is what actually reaches them, and `role="status"`
 * makes it polite — it waits for a pause rather than interrupting.
 */
export function SkeletonRegion({
  label = 'Loading',
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { label?: string }) {
  return (
    <div aria-busy="true" role="status" className={cn('flex flex-col gap-3', className)} {...props}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

/**
 * The bars comp Q draws in place of a table: a header rule and then rows of uneven width.
 *
 * Uneven on purpose — equal bars read as a designed pattern rather than as missing text, which is
 * the one thing a skeleton has to communicate.
 */
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  const widths = ['w-[92%]', 'w-[78%]', 'w-[85%]', 'w-[64%]', 'w-[88%]', 'w-[71%]']

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {Array.from({ length: rows }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder, nothing reorders
        <Skeleton key={index} className={widths[index % widths.length]} />
      ))}
    </div>
  )
}
