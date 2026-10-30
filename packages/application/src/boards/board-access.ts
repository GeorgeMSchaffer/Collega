// The by-id chokepoint for a Restricted board's items (SPEC/20-feature-board-access-and-groups.md
// BAG-4a/b): an idea, Issue or task on a board the caller cannot see answers `404`, never `403`.
// Lists and counts (BAG-4c) filter by `visibleBoardIdsFor` instead.

import { Role } from '@collega/domain/enums'
import { type CurrentUserContext, NotFoundError } from '../common/index.js'
import type { BoardAccessLookup, VisibleBoardsLookup } from './ports.js'

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

/** The boards a list may draw from: `null` means every board (Org Admin, Site Admin), otherwise the
 * caller's visible board ids. An item on no board is never filtered by this; a repository applies
 * it as `board_id IS NULL OR board_id IN (...)`. */
export async function visibleBoardIdsFor(
  access: VisibleBoardsLookup,
  currentUser: CurrentUserContext,
): Promise<readonly string[] | null> {
  if (currentUser.role === Role.SiteAdmin || currentUser.role === Role.OrgAdmin) {
    return null
  }
  const { userId, organizationId } = currentUser
  if (userId === null || organizationId === null) {
    return []
  }
  return access.visibleBoardIds(organizationId, userId)
}
