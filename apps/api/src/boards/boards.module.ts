import type { BoardRepository, OrganizationExistenceLookup } from '@collega/application/boards'
import { BoardService } from '@collega/application/boards'
import type {
  AuditEventWriter,
  Clock,
  CurrentUserContext,
  UnitOfWork,
} from '@collega/application/common'
import { type IdeaRepository, IdeaService } from '@collega/application/ideas'
import type { StatusRepository } from '@collega/application/statuses'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { PORT_TOKENS } from '../common/tokens.js'
import { IdeasModule } from '../ideas/ideas.module.js'
import { BoardsController } from './boards.controller.js'

/**
 * D2's board surface: the org-scoped list and create, plus detail, update and swimlane reorder.
 *
 * Nothing is imported from `StatusesModule` even though `BoardService` needs a `StatusRepository`:
 * that is a persistence PORT, satisfied by the adapter `PersistenceModule` already provides, not
 * by `StatusService`. Importing the sibling module for it would couple the two feature modules to
 * no purpose - and the coupling runs both ways, since `StatusService` needs `BoardRepository`.
 *
 * `IdeasModule` is imported for `IdeaService`, which owns the one task-creation path: a pull or an
 * `ideaMoves` entry into an `autoCreateTask` lane creates its task through it, in the board save's
 * unit of work.
 *
 * `BoardService` is constructed here rather than carrying `@Injectable()` because
 * `packages/application` may not import `@nestjs/common` (layer rule,
 * `SPEC/50-typescript-migration.md` section 3).
 */
@Module({
  imports: [PersistenceModule, AuthModule, IdeasModule],
  controllers: [BoardsController],
  providers: [
    {
      provide: BoardService,
      useFactory: (
        boards: BoardRepository,
        statuses: StatusRepository,
        organizations: OrganizationExistenceLookup,
        unitOfWork: UnitOfWork,
        auditEvents: AuditEventWriter,
        currentUser: CurrentUserContext,
        clock: Clock,
        ideas: IdeaRepository,
        tasks: IdeaService,
      ) =>
        new BoardService(
          boards,
          statuses,
          organizations,
          unitOfWork,
          auditEvents,
          currentUser,
          clock,
          ideas,
          tasks,
        ),
      inject: [
        PORT_TOKENS.BoardRepository,
        PORT_TOKENS.StatusRepository,
        PORT_TOKENS.OrganizationExistenceLookup,
        PORT_TOKENS.UnitOfWork,
        PORT_TOKENS.AuditEventWriter,
        PORT_TOKENS.CurrentUserContext,
        PORT_TOKENS.Clock,
        PORT_TOKENS.IdeaRepository,
        IdeaService,
      ],
    },
  ],
  exports: [BoardService],
})
export class BoardsModule {}
