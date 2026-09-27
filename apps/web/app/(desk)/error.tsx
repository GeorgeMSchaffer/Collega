'use client'

import { PageHeader } from '@/components/common/page-header'
import { RouteError } from '@/components/common/route-error'
import { Topbar } from '@/components/nav/topbar'

/**
 * The desk's fallback error boundary.
 *
 * It sits beside `(desk)/layout.tsx` so a failed page is replaced while the sidebar and topbar
 * survive — a reader keeps their way out. Routes that can say something more specific than "this
 * page" put their own `error.tsx` in their own segment, and the nearest boundary wins.
 */
export default function DeskError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <>
      {/* The topbar is rendered by each page, not the layout, so a boundary that replaces the page
          loses it. Restating it keeps the chrome whole rather than leaving a headless panel. */}
      <Topbar title={<b>Collega</b>} />
      <main className="flex min-w-0 flex-1 flex-col gap-4 p-6">
        <PageHeader title="Something went wrong" />
        <RouteError what="this page" error={error} reset={reset} />
      </main>
    </>
  )
}
