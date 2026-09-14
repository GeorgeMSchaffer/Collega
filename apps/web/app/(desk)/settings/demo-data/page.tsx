import { DemoDataForm } from '@/components/settings/demo-data-form'
import { SettingsPage } from '@/components/settings/settings-page'
import { requireCurrentUser } from '@/lib/server/current-user'

export const metadata = { title: 'Demo data · Collega' }

/**
 * Filling a deployment with something to demonstrate.
 *
 * `siteAdminOnly`, and for once that is not only about permission: a Site Admin is the only account
 * a fresh deployment has, and the bootstrap leaves them belonging to no organization. So on day one
 * there is nothing to open, **nobody to view as**, and no way to show the product without building
 * a world by hand. This is the shortcut.
 *
 * The API refuses both writes unless the deployment sets `COLLEGA_ALLOW_DEMO_SEED`, so this screen
 * can be reached in an environment where the buttons will be declined. That is deliberate: the
 * refusal names the variable, which is more useful than hiding the page and leaving somebody to
 * wonder where it went.
 */
export default async function DemoDataPage() {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  return (
    <SettingsPage
      title="Demo data"
      gate="demo-data"
      siteAdminOnly
      lead="Fill this deployment with the demo organizations, or put them back the way they started."
    >
      <DemoDataForm />
    </SettingsPage>
  )
}
