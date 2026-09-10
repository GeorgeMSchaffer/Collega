/**
 * Which organization a reader is scoped to.
 *
 * Most of the API's list routes hang off `/organizations/{id}/...`, and the id is not the caller's
 * to choose: it is whichever organization the acting user belongs to. Reading it from the resolved
 * principal rather than from a route parameter is what makes that true — there is no id in the URL
 * for a reader to change.
 *
 * A Site Admin belongs to no organization, so there is nothing to scope to and the readers answer
 * empty rather than guessing at one. That is the same story the sidebar and the settings hub
 * already tell that role, and the API would refuse a direct Site Admin anyway (View As is the way
 * in, and it is D7).
 */

import { currentUser } from '../session'

export function organizationScope(): string | null {
  return currentUser().organizationId
}
