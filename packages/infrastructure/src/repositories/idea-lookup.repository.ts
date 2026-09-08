// Satisfies both `comments.IdeaLookupPort` (`getById` -> `IdeaSummary`) and
// `upvotes.IdeaLookupPort` (`getOrganizationId` -> `string | null`) on one class: the two ports
// name different methods, so - per the brief - "one class can still implement both if the shapes
// compose cleanly", and both only ever read from `ideas`.

import type {
  IdeaLookupPort as CommentsIdeaLookupPort,
  IdeaSummary,
} from '@collega/application/comments'
import type { IdeaLookupPort as UpvotesIdeaLookupPort } from '@collega/application/upvotes'
import type { PrismaClient } from '../persistence/prisma-client.js'

export class IdeaLookupRepository implements CommentsIdeaLookupPort, UpvotesIdeaLookupPort {
  constructor(private readonly prisma: PrismaClient) {}

  /** `comments.IdeaLookupPort.getById` - excludes soft-deleted ideas. */
  async getById(ideaId: string): Promise<IdeaSummary | null> {
    const row = await this.prisma.ideas.findFirst({
      where: { id: ideaId, is_deleted: false },
      include: { idea_assignees: { select: { user_id: true } } },
    })
    if (!row) {
      return null
    }
    return {
      id: row.id,
      organizationId: row.organization_id,
      boardId: row.board_id,
      title: row.title,
      authorUserId: row.author_user_id,
      assigneeUserIds: row.idea_assignees.map((a) => a.user_id),
    }
  }

  /** `upvotes.IdeaLookupPort.getOrganizationId`. Not scoped to `is_deleted = false`: the port
   * contract does not say to exclude a soft-deleted idea, and removing an upvote from an idea
   * that has since been deleted should still be possible. */
  async getOrganizationId(ideaId: string): Promise<string | null> {
    const row = await this.prisma.ideas.findUnique({
      where: { id: ideaId },
      select: { organization_id: true },
    })
    return row?.organization_id ?? null
  }
}
