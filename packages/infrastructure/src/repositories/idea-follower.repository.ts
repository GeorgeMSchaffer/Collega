// Satisfies `following.IdeaFollowerRepository`, `ideas.IdeaFollowersPort` and
// `comments.IdeaFollowersPort` on one class: all three read or write `idea_followers` only, and
// their method names compose.
//
// Writes are staged on the unit of work, so the follow rows an idea save implies commit in the
// same transaction as the save. `add` skips duplicates rather than failing on
// `ux_idea_followers_idea_id_user_id`: following is idempotent, and two requests racing to follow
// the same idea should both succeed.

import type { IdeaFollowersPort as CommentsIdeaFollowersPort } from '@collega/application/comments'
import type { IdeaFollowerRepository } from '@collega/application/following'
import type { IdeaFollowersPort } from '@collega/application/ideas'
import type { IdeaFollower } from '@collega/domain/followers'
import type { PrismaClient } from '../persistence/prisma-client.js'
import type { PrismaUnitOfWork } from '../persistence/unit-of-work.js'

export class PrismaIdeaFollowerRepository
  implements IdeaFollowerRepository, IdeaFollowersPort, CommentsIdeaFollowersPort
{
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork,
  ) {}

  async add(followers: readonly IdeaFollower[]): Promise<void> {
    if (followers.length === 0) {
      return
    }
    this.unitOfWork.enqueue(
      this.prisma.idea_followers.createMany({
        data: followers.map((follower) => ({
          id: follower.id,
          idea_id: follower.ideaId,
          user_id: follower.userId,
          created_at_utc: follower.createdAtUtc,
        })),
        skipDuplicates: true,
      }),
    )
  }

  async remove(ideaId: string, userId: string): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.idea_followers.deleteMany({ where: { idea_id: ideaId, user_id: userId } }),
    )
  }

  async isFollowing(ideaId: string, userId: string): Promise<boolean> {
    const row = await this.prisma.idea_followers.findUnique({
      where: { idea_id_user_id: { idea_id: ideaId, user_id: userId } },
      select: { id: true },
    })
    return row !== null
  }

  async countByIdea(ideaId: string): Promise<number> {
    return this.prisma.idea_followers.count({ where: { idea_id: ideaId } })
  }

  async listFollowerIds(ideaId: string): Promise<readonly string[]> {
    const rows = await this.prisma.idea_followers.findMany({
      where: { idea_id: ideaId },
      select: { user_id: true },
      orderBy: { created_at_utc: 'asc' },
    })
    return rows.map((row) => row.user_id)
  }
}
