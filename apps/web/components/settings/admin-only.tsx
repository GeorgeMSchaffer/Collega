import { Button } from '@collega/design-system'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { currentUser, isAdministrator } from '@/lib/mock'

/**
 * Page-level role gate for the settings routes.
 *
 * Deliberately **not** the `Denied` treatment. A denied *control* stays visible with its reason
 * beside it; an entire route closed to a role shows this panel instead. Comp Q spells out the
 * promise it makes: "nothing here is hidden from you selectively — the whole page is out of scope
 * for your role". Rendering a member a quietly reduced version of an admin screen would break that.
 */
export function AdminOnly({ what, children }: { what: string; children: ReactNode }) {
  if (isAdministrator(currentUser.role)) {
    return <>{children}</>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1>Not available</h1>
        <p className="m-0 mt-1 text-sm text-muted-foreground">This route is closed to your role.</p>
      </div>
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed bg-card px-6 py-8">
        <h3 className="m-0 text-base font-semibold">Administrators only</h3>
        <p className="m-0 max-w-prose text-sm text-muted-foreground">
          Configuring {what} is an administrator&rsquo;s job, so this route is closed to members.
          Nothing here is hidden from you selectively &mdash; the whole page is out of scope for
          your role.
        </p>
        <Link href="/settings">
          <Button variant="outline">Back to Settings</Button>
        </Link>
      </div>
    </div>
  )
}
