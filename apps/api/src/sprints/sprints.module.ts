import type {
  AuditEventWriter,
  Clock,
  CurrentUserContext,
  UnitOfWork,
} from '@collega/application/common'
import type {
  SprintIssuesPort,
  SprintRepository,
  SprintUsersPort,
} from '@collega/application/sprints'
import { SprintService } from '@collega/application/sprints'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { PORT_TOKENS } from '../common/tokens.js'
import { IdeasModule } from '../ideas/ideas.module.js'
import { SprintsController } from './sprints.controller.js'

/**
 * The seven sprint routes.
 *
 * `SprintService`'s three feature ports all resolve from `PORT_TOKENS`, and two of them are slices
 * of another feature's adapter rather than a repository of their own: `SprintIssuesPort` is the
 * "Issues in this sprint, and put them back in the backlog" slice of `PrismaIdeaRepository` (sprint
 * completion and deletion are cross-aggregate), and `SprintUsersPort` the "is this owner active and
 * in this org" slice of `PrismaUserRepository`. `common/persistence/adapters.providers.ts` owns
 * that aliasing; nothing is decided here.
 *
 * **`IdeasModule` is imported for `IdeaService`, not for its routes** - importing a module
 * registers its providers, never its controllers a second time. `GET .../sprints/{id}` composes
 * the sprint with its delivery cards, and those come from `IdeaService.listDelivery`; building a
 * second `IdeaService` here would mean repeating its fifteen-dependency factory. Same pattern as
 * `UsersModule` importing `AuthenticationModule` for `AuthService`.
 *
 * `useFactory` rather than `@Injectable()` because `packages/application` may not import
 * `@nestjs/common` (`SPEC/50-typescript-migration.md` section 3).
 */
@Module({
  imports: [PersistenceModule, AuthModule, IdeasModule],
  controllers: [SprintsController],
  providers: [
    {
      provide: SprintService,
      useFactory: (
        sprints: SprintRepository,
        issues: SprintIssuesPort,
        users: SprintUsersPort,
        unitOfWork: UnitOfWork,
        auditEvents: AuditEventWriter,
        currentUser: CurrentUserContext,
        clock: Clock,
      ) => new SprintService(sprints, issues, users, unitOfWork, auditEvents, currentUser, clock),
      inject: [
        PORT_TOKENS.SprintRepository,
        PORT_TOKENS.SprintIssuesPort,
        PORT_TOKENS.SprintUsersPort,
        PORT_TOKENS.UnitOfWork,
        PORT_TOKENS.AuditEventWriter,
        PORT_TOKENS.CurrentUserContext,
        PORT_TOKENS.Clock,
      ],
    },
  ],
})
export class SprintsModule {}
