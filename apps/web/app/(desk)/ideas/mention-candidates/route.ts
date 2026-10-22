import { ApiError } from '@/lib/api/client'
import { getMentionCandidates } from '@/lib/data'
import { actingOrganizationId } from '@/lib/server/current-user'

/**
 * The comment composer asks here the first time someone types `@`. A route rather than a Server
 * Function for the reason `boards/pull-candidates` is one: Server Functions run one at a time per
 * client, so the read would queue behind a comment being posted. A Site Admin acting as themselves
 * has no organization, and so no one to mention.
 */
export async function GET(): Promise<Response> {
  try {
    const organizationId = await actingOrganizationId()
    return Response.json(
      organizationId === null ? [] : await getMentionCandidates(organizationId),
      {
        headers: { 'Cache-Control': 'private, no-store' },
      },
    )
  } catch (error) {
    if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
      return Response.json({ error: error.detail }, { status: error.status })
    }
    throw error
  }
}
