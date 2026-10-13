import type { PullSetup } from '@/components/settings/pull-step'
import { getMemberOptions, getTagRefs } from '@/lib/data'

/**
 * What the board form's *Add existing items* step needs from the server, read when a form opens:
 * the tag catalog for the tag filter, the members for an Org Admin's author filter (a User's list
 * is already only their own ideas), and which boards are archived so a row can say so.
 */
export async function loadPullSetup(options: {
  isAdmin: boolean
  archivedBoardIds: string[]
  /** The board being edited is archived: the step shows, disabled. */
  archived?: boolean
}): Promise<PullSetup> {
  const [tags, members] = await Promise.all([
    getTagRefs(),
    options.isAdmin ? getMemberOptions() : [],
  ])
  return {
    isAdmin: options.isAdmin,
    tags,
    members,
    archivedBoardIds: options.archivedBoardIds,
    archived: options.archived ?? false,
  }
}
