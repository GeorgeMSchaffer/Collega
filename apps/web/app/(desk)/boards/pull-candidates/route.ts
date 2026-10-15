import { ApiError } from '@/lib/api/client'
import { getPullCandidates } from '@/lib/data'
import { actingOrganizationId } from '@/lib/server/current-user'
import type { PullSource } from '@/lib/types'

const SOURCES: readonly PullSource[] = ['unassigned', 'boards', 'backlog']

/**
 * The board form's *Add existing items* step asks here as the reader types and switches tabs.
 * A route rather than a Server Function for the reason `inbox/unread-count` is one: Server
 * Functions run one at a time per client, so a search would queue behind — or ahead of — the save
 * the reader is waiting on. The API scopes the answer to what the caller may pull and refuses what
 * they may not; its status and message pass through for the step to show.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const source = SOURCES.find((candidate) => candidate === searchParams.get('source'))
  if (!source) return Response.json({ error: 'Unknown source.' }, { status: 400 })

  const number = (name: string, fallback: number) => {
    const value = Number.parseInt(searchParams.get(name) ?? '', 10)
    return Number.isInteger(value) && value > 0 ? value : fallback
  }

  try {
    const organizationId = await actingOrganizationId()
    if (organizationId === null) {
      return Response.json({ error: 'There is no organization to read from.' }, { status: 403 })
    }

    return Response.json(
      await getPullCandidates(organizationId, {
        source,
        excludeBoardId: searchParams.get('excludeBoardId') ?? undefined,
        search: searchParams.get('search') ?? undefined,
        tag: searchParams.get('tag') ?? undefined,
        authorUserId: searchParams.get('authorUserId') ?? undefined,
        page: number('page', 1),
        pageSize: Math.min(number('pageSize', 20), 100),
      }),
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    if (error instanceof ApiError && [400, 401, 403, 404].includes(error.status)) {
      return Response.json({ error: error.detail }, { status: error.status })
    }
    throw error
  }
}
