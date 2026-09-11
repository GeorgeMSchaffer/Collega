import { Alert } from '@collega/design-system'
import { SettingsPage } from '@/components/settings/settings-page'
import { UserImportForm } from '@/components/settings/user-import'
import { requireCurrentUser } from '@/lib/server/current-user'

export const metadata = { title: 'Import users · Collega' }

/**
 * Bulk account creation from a CSV (comp P `s-import`).
 *
 * Nothing is read: there is no import history to fetch, so the whole screen is the form and what
 * the form's own write returned. `lib/data/admin.ts` says why, where `getLastImport` used to be.
 *
 * **A Site Admin gets the explanation rather than the form.** The import creates accounts *in an
 * organization*, and a Site Admin belongs to none, so there is no organization in scope for the
 * control to target — the same position `lib/data/scope.ts` takes for every organization-scoped
 * read. Comp P reaches a Site Admin's import through `s-org-import`, a route that carries an
 * organization in its path; that route does not exist yet, so naming the absence is the honest
 * screen. Inventing an organization picker here would be inventing an endpoint's caller.
 */
export default async function ImportUsersPage() {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  const user = await requireCurrentUser()

  return (
    <SettingsPage
      title="Import users"
      gate="user import"
      lead="Create many accounts at once from a CSV. Every new account gets a temporary password and must change it at first sign-in."
    >
      {user.organizationId === null ? (
        <Alert variant="note" className="max-w-prose">
          <span>
            An import creates accounts in one organization, and a Site Admin belongs to none — so
            there is no organization in scope here to import into. Open an organization and import
            from its own users screen.
          </span>
        </Alert>
      ) : (
        <UserImportForm organizationId={user.organizationId} />
      )}
    </SettingsPage>
  )
}
