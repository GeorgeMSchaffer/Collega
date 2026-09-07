import { Alert } from '@collega/design-system'

/**
 * Why a Site Admin gets no create control on a cross-organization list.
 *
 * Not "act as a member" — that would say the action exists elsewhere. Comp Q's reason is that the
 * action has no referent here: a status, an idea type and a field each belong to exactly one
 * organization, so there is nothing coherent for a create button on a combined list to create. The
 * shipped client encoded the same rule as `CanMutate = !isSiteAdmin`.
 */
export function CrossOrgNote({ what }: { what: string }) {
  return (
    <Alert variant="note" className="max-w-prose">
      <span>
        A cross-organization view is read-only on purpose. {what} belongs to one organization, so
        there is nothing coherent for a create button here to create — open an organization to
        change what belongs to it.
      </span>
    </Alert>
  )
}
