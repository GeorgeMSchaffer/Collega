import type { VisibleBoardsLookup } from '@collega/application/boards'
import type {
  AuditEventWriter,
  Clock,
  CurrentUserContext,
  RandomSource,
  UnitOfWork,
} from '@collega/application/common'
import type {
  OutcomeIdeasPort,
  OutcomeReadsPort,
  OutcomeRepository,
  OutcomeUsersPort,
} from '@collega/application/outcomes'
import { OutcomeService } from '@collega/application/outcomes'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { PORT_TOKENS } from '../common/tokens.js'
import { OutcomesController } from './outcomes.controller.js'

/**
 * Outcomes and the roadmap read. `OutcomeIdeasPort` is the "load an idea, write it back" slice of
 * `PrismaIdeaRepository` and `OutcomeUsersPort` the owner-check slice of `PrismaUserRepository`;
 * `common/persistence/adapters.providers.ts` owns that aliasing.
 *
 * `useFactory` rather than `@Injectable()` because `packages/application` may not import
 * `@nestjs/common`.
 */
@Module({
  imports: [PersistenceModule, AuthModule],
  controllers: [OutcomesController],
  providers: [
    {
      provide: OutcomeService,
      useFactory: (
        outcomes: OutcomeRepository,
        reads: OutcomeReadsPort,
        ideas: OutcomeIdeasPort,
        users: OutcomeUsersPort,
        unitOfWork: UnitOfWork,
        auditEvents: AuditEventWriter,
        currentUser: CurrentUserContext,
        clock: Clock,
        random: RandomSource,
        boardAccess: VisibleBoardsLookup,
      ) =>
        new OutcomeService(
          outcomes,
          reads,
          ideas,
          users,
          unitOfWork,
          auditEvents,
          currentUser,
          clock,
          random,
          boardAccess,
        ),
      inject: [
        PORT_TOKENS.OutcomeRepository,
        PORT_TOKENS.OutcomeReadsPort,
        PORT_TOKENS.OutcomeIdeasPort,
        PORT_TOKENS.OutcomeUsersPort,
        PORT_TOKENS.UnitOfWork,
        PORT_TOKENS.AuditEventWriter,
        PORT_TOKENS.CurrentUserContext,
        PORT_TOKENS.Clock,
        PORT_TOKENS.RandomSource,
        PORT_TOKENS.VisibleBoardsLookup,
      ],
    },
  ],
})
export class OutcomesModule {}
