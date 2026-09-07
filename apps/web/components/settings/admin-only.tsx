import { buttonVariants } from '@collega/design-system'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { currentUser, isAdministrator } from '@/lib/mock'

/**
 * The refusal panel a settings route shows a role that may not reach it.
 *
 * Deliberately **not** the `Denied` treatment. A denied *control* stays visible with its reason
 * beside it; an entire route closed to a role shows this instead. Comp Q spells out the promise that
 * makes: "nothing here is hidden from you selectively — the whole page is out of scope for your
 * role". Rendering a member a quietly reduced version of an admin screen would break it.
 *
 * The settings **hub** is not gated this way — comp Q leaves it open to every role, because a member
 * reaches it for their own profile. See `app/(desk)/settings/page.tsx`.
 */
export function RefusalPanel({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1>Not available</h1>
        <p className="m-0 mt-1 text-sm text-muted-foreground">This route is closed to your role.</p>
      </div>
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed bg-card px-6 py-8">
        <h3 className="m-0 text-base font-semibold">{heading}</h3>
        <p className="m-0 max-w-prose text-sm text-muted-foreground">{children}</p>
        <Link href="/settings" className={buttonVariants({ variant: 'outline' })}>
          Back to Settings
        </Link>
      </div>
    </div>
  )
}

export function AdminOnly({ what, children }: { what: string; children: ReactNode }) {
  if (isAdministrator(currentUser.role)) {
    return <>{children}</>
  }

  return (
    <RefusalPanel heading="Administrators only">
      Configuring {what} is an administrator&rsquo;s job, so this route is closed to members.
      Nothing here is hidden from you selectively &mdash; the whole page is out of scope for your
      role.
    </RefusalPanel>
  )
}

/**
 * A stricter gate for deployment-level routes. An Org Admin passes `AdminOnly` but still may not see
 * these, so the reason has to differ — "administrators only" would be false to their face.
 */
export function SiteAdminOnly({ children }: { children: ReactNode }) {
  if (currentUser.role === 'SiteAdmin') {
    return <>{children}</>
  }

  return (
    <RefusalPanel heading="Site Admins only">
      The list of organizations is deployment configuration, not an organization&rsquo;s own. This
      route exists so a Site Admin can inspect an organization they do not belong to.
    </RefusalPanel>
  )
}
