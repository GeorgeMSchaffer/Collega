import type { ReactNode } from 'react'
import { ThemePicker } from '@/components/theme/theme-picker'

/**
 * Comp R's `.topbar`: the breadcrumb, any secondary page actions, and the theme picker at the right.
 *
 * The title is a breadcrumb, not a heading: each screen's one `<h1>` is its own (`PageHeader`), and
 * a screen's creation action belongs in that header too. The current page is the `<b>` in the
 * trail; a trail of one is just that `<b>`.
 */
export function Topbar({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex min-h-14 flex-wrap items-center gap-2 border-b bg-card px-6 py-2 max-md:px-4">
      <nav
        aria-label="Breadcrumb"
        className="text-sm text-muted-foreground [&_b]:font-medium [&_b]:text-foreground"
      >
        {title}
      </nav>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {actions}
        <ThemePicker />
      </div>
    </header>
  )
}
