import type { ReactNode } from 'react'
import { ThemePicker } from '@/components/theme/theme-picker'

/** Comp R's `.topbar`: the title, the page's actions, and the theme picker at the right. */
export function Topbar({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex min-h-14 flex-wrap items-center gap-2 border-b bg-card px-6 py-2">
      <h1 className="text-base font-semibold tracking-tight">{title}</h1>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {actions}
        <ThemePicker />
      </div>
    </header>
  )
}
