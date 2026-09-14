import { SettingsPage } from '@/components/settings/settings-page'
import { ViewAsPicker } from '@/components/settings/view-as-picker'
import { getViewAsCandidates } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'

export const metadata = { title: 'View as · Collega' }

/**
 * The Site Admin's way into an organization.
 *
 * **Not a convenience.** Rule 25 refuses a direct Site Admin every organization-content mutation —
 * they cannot author an idea, move a card or administer a catalog as themselves — so without this
 * page the role can create tenants and users and then do nothing else with either. Four screens
 * already sent people here before it existed.
 *
 * `siteAdminOnly` matches the API: `listCandidates` is the Site Admin's, and an Org Admin asking is
 * refused there rather than here. The gate is a courtesy that saves a request.
 */
export default async function ViewAsPage() {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const candidates = await getViewAsCandidates()

  return (
    <SettingsPage
      title="View as"
      gate="view-as"
      siteAdminOnly
      lead="Act as a member of an organization. Everything you do is recorded against both of you, and the banner stays until you stop."
    >
      <ViewAsPicker candidates={candidates} />
    </SettingsPage>
  )
}
