import { Denied } from '@collega/design-system'
import { CreateUserForm } from '@/components/settings/create-user-form'
import { SettingsPage } from '@/components/settings/settings-page'
import { requireCurrentUser } from '@/lib/server/current-user'
import { currentUser } from '@/lib/session'

export const metadata = { title: 'New user · Collega' }

/**
 * Adding a person to the acting organization.
 *
 * A Site Admin is branched out rather than gated, for the reason `settings/boards/new` gives: they
 * pass `isAdministrator`, so the ordinary gate would hand them a form whose every submit is refused
 * — the API answers on an organization id, and a Site Admin has none. View As is the path, and
 * saying so is more use than a form that cannot work.
 */
export default async function NewUserPage() {
  await requireCurrentUser()

  const organizationId = currentUser().organizationId

  if (organizationId === null) {
    return (
      <SettingsPage title="New user" gate="people" lead="Adding a person to an organization.">
        <Denied
          id="why-no-organization-to-add-to"
          reason="A Site Admin belongs to no organization."
        >
          There is no organization to add a person to. Use View As to act as an administrator of
          one, then add them there.
        </Denied>
      </SettingsPage>
    )
  }

  return (
    <SettingsPage
      title="New user"
      gate="people"
      lead="They will be asked to change the password you set the first time they sign in."
    >
      <CreateUserForm organizationId={organizationId} />
    </SettingsPage>
  )
}
