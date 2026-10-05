import type { Clock, CurrentUserContext, UnitOfWork } from '@collega/application/common'
import type { IdeaFollowerRepository, IdeaLookupPort } from '@collega/application/following'
import { FollowService } from '@collega/application/following'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { PORT_TOKENS } from '../common/tokens.js'
import { FollowingController } from './following.controller.js'

/**
 * The follow toggle. `IdeaLookupPort` is the shared token Comments and Upvotes use, aliased onto
 * `IdeaLookupRepository`, whose `getById` leaves out soft-deleted ideas as the contract's `404`
 * requires.
 */
@Module({
  imports: [PersistenceModule, AuthModule],
  controllers: [FollowingController],
  providers: [
    {
      provide: FollowService,
      useFactory: (
        followers: IdeaFollowerRepository,
        ideas: IdeaLookupPort,
        unitOfWork: UnitOfWork,
        currentUser: CurrentUserContext,
        clock: Clock,
      ) => new FollowService(followers, ideas, unitOfWork, currentUser, clock),
      inject: [
        PORT_TOKENS.IdeaFollowerRepository,
        PORT_TOKENS.IdeaLookupPort,
        PORT_TOKENS.UnitOfWork,
        PORT_TOKENS.CurrentUserContext,
        PORT_TOKENS.Clock,
      ],
    },
  ],
})
export class FollowingModule {}
