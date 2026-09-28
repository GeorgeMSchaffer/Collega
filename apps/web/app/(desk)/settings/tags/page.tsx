import { SettingsPage } from '@/components/settings/settings-page'
import type { TagUsage } from '@/components/settings/tag-drawer'
import { AddTagButton, TagsScreen } from '@/components/settings/tags-screen'
import { getTagCatalog, getTagCatalogsByOrganization, getTagUsage } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { boardAdminDenial, currentUser, isAdministrator } from '@/lib/session'
import { randomTagColor } from '@/lib/tag-color'

export const metadata = { title: 'Tags · Collega' }

type Search = Record<string, string | string[] | undefined>

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/**
 * Settings → Tags (`/settings/tags`). Org Admins manage their organization's tags; a Site Admin
 * reads every organization's, as with the other catalogs; members and Read Only accounts get the
 * refusal panel from `SettingsPage`'s gate (`20-feature-client-ui.md`).
 *
 * The open tag's *Used on* is read here, from the URL the drawer writes, like the Boards screen
 * reads its open form.
 */
export default async function TagsPage({ searchParams }: { searchParams: Promise<Search> }) {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const search = await searchParams
  const user = currentUser()
  const siteAdmin = user.role === 'SiteAdmin'
  // Tag administration is the same administrator's write as a board's, with the same reason.
  const denial = boardAdminDenial(user.role)

  // Nothing is read for a role the gate refuses.
  const tags = !isAdministrator(user.role)
    ? []
    : siteAdmin
      ? await getTagCatalogsByOrganization()
      : await getTagCatalog()

  const openTag = tags.find((tag) => tag.id === first(search.tag))
  const organizationId = openTag?.organization?.id ?? user.organizationId
  const usage: TagUsage | null =
    openTag && openTag.ideaCount > 0 && first(search.mode) !== 'edit' && organizationId
      ? await getTagUsage(organizationId, openTag.name)
      : null

  return (
    <SettingsPage
      title="Tags"
      gate="tags"
      lead={
        siteAdmin
          ? 'Every organization’s tags, read-only. Use View As to change an organization’s tags.'
          : 'Labels for ideas on every board. A new tag gets a colour from the palette at random; an admin can change it here, or add tags before anyone uses them.'
      }
      actions={<AddTagButton denial={denial} />}
    >
      <TagsScreen tags={tags} denial={denial} usage={usage} newColor={randomTagColor()} />
    </SettingsPage>
  )
}
