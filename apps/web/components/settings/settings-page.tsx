import Link from 'next/link'
import type { ReactNode } from 'react'
import { PageHeader } from '@/components/common/page-header'
import { Topbar } from '@/components/nav/topbar'
import { AdminOnly, SiteAdminOnly } from './admin-only'

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
  siteAdminOnly = false,
  children,
}: {
  title: string
  gate: string
  lead: ReactNode
  actions?: ReactNode
  /** Deployment-level route: an Org Admin is refused too, with a different reason. */
  siteAdminOnly?: boolean
  children: ReactNode
}) {
  return (
    <>
      <Topbar
        title={
          <span className="text-sm font-normal text-muted-foreground">
            <Link href="/settings">Settings</Link> /{' '}
            <b className="font-medium text-foreground">{title}</b>
          </span>
        }
      />
      <main className="flex min-w-0 flex-1 flex-col gap-4 p-6">
        <Gate siteAdminOnly={siteAdminOnly} what={gate}>
          {/* The action sits inside the gate with the heading, so a role the route refuses never
              reads "Add New Status" above a panel telling them the page is closed to them. */}
          <PageHeader title={title} description={lead} action={actions} />
          {children}
        </Gate>
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

/** Picks the refusal the route actually owes: an Org Admin passes one gate and not the other. */
function Gate({
  siteAdminOnly,
  what,
  children,
}: {
  siteAdminOnly: boolean
  what: string
  children: ReactNode
}) {
  if (siteAdminOnly) {
    return <SiteAdminOnly>{children}</SiteAdminOnly>
  }
  return <AdminOnly what={what}>{children}</AdminOnly>
}
