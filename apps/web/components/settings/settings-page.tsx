import Link from 'next/link'
import type { ReactNode } from 'react'
import { Topbar } from '@/components/nav/topbar'
import { currentUser, isAdministrator } from '@/lib/mock'
import { AdminOnly } from './admin-only'

/**
 * The frame every settings list shares: breadcrumb, heading, lead paragraph, and the role gate.
 *
 * `siteAdminLead` exists because these screens genuinely differ by role rather than merely
 * filtering — a Site Admin reads a cross-organization list and manages nothing directly, an Org
 * Admin reads their own and edits it. Comp Q writes two different headings and two different
 * sentences for exactly that reason.
 */
export function SettingsPage({
  title,
  gate,
  lead,
  actions,
  children,
}: {
  title: string
  gate: string
  lead: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  // The action lives in the topbar, which sits outside AdminOnly - so it needs the same check, or a
  // member reads "Add status" above a page telling them the route is closed to them.
  const canAct = isAdministrator(currentUser.role)

  return (
    <>
      <Topbar
        title={
          <span className="text-sm font-normal text-muted-foreground">
            <Link href="/settings">Settings</Link> /{' '}
            <b className="font-medium text-foreground">{title}</b>
          </span>
        }
        actions={canAct ? actions : undefined}
      />
      <main className="flex max-w-[1320px] min-w-0 flex-1 flex-col gap-4 p-6">
        <AdminOnly what={gate}>
          <div>
            <h1>{title}</h1>
            <p className="m-0 mt-1 max-w-prose text-sm text-muted-foreground">{lead}</p>
          </div>
          {children}
        </AdminOnly>
      </main>
    </>
  )
}

/** A bordered table with the count footer comp Q puts under every admin list. */
export function AdminTable({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
      <div className="border-t px-4 py-2.5 text-xs text-muted-foreground">{summary}</div>
    </div>
  )
}

export function Th({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <th scope="col" className={`px-4 py-2.5 text-left font-medium ${className}`}>
      {children}
    </th>
  )
}
