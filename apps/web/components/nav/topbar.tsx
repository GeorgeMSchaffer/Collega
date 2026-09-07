import type { ReactNode } from 'react'

/** Comp Q's `.topbar`. Actions are per-page, so the shell only supplies the frame and the title. */
export function Topbar({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex min-h-14 flex-wrap items-center gap-2 border-b bg-background px-6 py-2">
      <h1 className="text-base font-semibold tracking-tight">{title}</h1>
      {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
    </header>
  )
}
