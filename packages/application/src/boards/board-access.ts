// The by-id chokepoint for a Restricted board's items (SPEC/20-feature-board-access-and-groups.md
// BAG-4a/b): an idea, Issue or task on a board the caller cannot see answers `404`, never `403`.

import { Role } from '@collega/domain/enums'
import { type CurrentUserContext, NotFoundError } from '../common/index.js'
import type { BoardAccessLookup } from './ports.js'

/** `boardId` null is an item on no board, which every member of its organization sees. Org Admins
 * and Site Admins see every board, so they skip the lookup. Organization scope is the caller's
 * own check; this decides only board sight. */
export async function ensureCanSeeBoard(
  access: BoardAccessLookup,
  currentUser: CurrentUserContext,
  boardId: string | null,
  notFoundMessage: string,
): Promise<void> {
  if (
    boardId === null ||
    currentUser.role === Role.SiteAdmin ||
    currentUser.role === Role.OrgAdmin
  ) {
    return
  }
  const { userId, organizationId } = currentUser
  if (
    userId === null ||
    organizationId === null ||
    !(await access.canSeeBoard(boardId, organizationId, userId))
  ) {
    throw new NotFoundError(notFoundMessage)
  }
}
