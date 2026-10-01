import { type FollowResult, FollowService } from '@collega/application/following'
import { Controller, Delete, Param, Put, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard.js'
import { UuidParamPipe } from '../common/uuid-param.pipe.js'

/**
 * Following an idea, as the caller (`SPEC/contracts/following.md`). Both routes answer `200` with
 * the new state and count, so the toggle needs no second request. Who may follow, the Site Admin
 * refusal and the organization scope are `FollowService`'s; nothing here reads an identity.
 */
@Controller('ideas/:ideaId/follow')
@UseGuards(AuthGuard)
export class FollowingController {
  constructor(private readonly following: FollowService) {}

  @Put()
  async follow(@Param('ideaId', UuidParamPipe) ideaId: string): Promise<FollowResult> {
    return this.following.follow(ideaId)
  }

  @Delete()
  async unfollow(@Param('ideaId', UuidParamPipe) ideaId: string): Promise<FollowResult> {
    return this.following.unfollow(ideaId)
  }
}
