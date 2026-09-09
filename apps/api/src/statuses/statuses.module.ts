import type { BoardRepository } from '@collega/application/boards'
import type {
  AuditEventWriter,
  Clock,
  CurrentUserContext,
  UnitOfWork,
} from '@collega/application/common'
import type { OrganizationExistenceLookup, StatusRepository } from '@collega/application/statuses'
import { StatusService } from '@collega/application/statuses'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { PORT_TOKENS } from '../common/tokens.js'
import { StatusesController } from './statuses.controller.js'

/**
 * D2's status surface: the org-scoped list, create and reorder, plus update and soft-delete.
 *
 * `BoardsModule` is not imported for the `BoardRepository` this service needs - that is a
 * persistence port `PersistenceModule` already provides, not `BoardService`. See
 * `boards.module.ts`: the two feature modules need each other's REPOSITORIES, never each other's
 * services, so neither imports the other.
 */
@Module({
  imports: [PersistenceModule, AuthModule],
  controllers: [StatusesController],
  providers: [
    {
      provide: StatusService,
      useFactory: (
        statuses: StatusRepository,
        boards: BoardRepository,
        organizations: OrganizationExistenceLookup,
        unitOfWork: UnitOfWork,
        auditEvents: AuditEventWriter,
        currentUser: CurrentUserContext,
        clock: Clock,
      ) =>
        new StatusService(
          statuses,
          boards,
          organizations,
          unitOfWork,
          auditEvents,
          currentUser,
          clock,
        ),
      inject: [
        PORT_TOKENS.StatusRepository,
        PORT_TOKENS.BoardRepository,
        PORT_TOKENS.OrganizationExistenceLookup,
        PORT_TOKENS.UnitOfWork,
        PORT_TOKENS.AuditEventWriter,
        PORT_TOKENS.CurrentUserContext,
        PORT_TOKENS.Clock,
      ],
    },
  ],
  exports: [StatusService],
})
export class StatusesModule {}
