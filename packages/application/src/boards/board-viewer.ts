// The caller as `canSeeBoard` needs them (SPEC/contracts/boards.md "Board access"). Group membership
// is read per request, so joining or leaving a group changes access on the next request without any
// board being written.

import type { BoardViewer } from '@collega/domain/boards'
import { Role } from '@collega/domain/enums'
import { type CurrentUserContext, UnauthorizedError } from '../common/index.js'

export async function loadBoardViewer(
  currentUser: CurrentUserContext,
  groups: { listGroupIdsForUser(userId: string): Promise<readonly string[]> },
): Promise<BoardViewer> {
  const role = currentUser.role
  if (!currentUser.isAuthenticated || role === null) {
    throw new UnauthorizedError('Caller identity could not be resolved.')
  }
  // Only a User or Read Only member's sight depends on groups; skip the read for everyone else.
  const needsGroups = (role === Role.User || role === Role.ReadOnly) && currentUser.userId !== null
  return {
    userId: currentUser.userId,
    organizationId: currentUser.organizationId,
    role,
    groupIds: needsGroups ? await groups.listGroupIdsForUser(currentUser.userId as string) : [],
  }
}
