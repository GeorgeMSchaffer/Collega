import type {
  AuditEventWriter,
  Clock,
  CurrentUserContext,
  UnitOfWork,
} from '@collega/application/common'
import type { FieldDefinitionRepository } from '@collega/application/fields'
import type {
  IdeaTypeRepository,
  OrganizationExistenceLookup,
} from '@collega/application/idea-fields'
import { IdeaTypeService } from '@collega/application/idea-fields'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { PORT_TOKENS } from '../common/tokens.js'
import { IdeaTypesController } from './idea-types.controller.js'

/**
 * D5's Idea Type surface: the org-scoped list, create, reorder, field selection and appearance,
 * plus update and soft-delete.
 *
 * `FieldDefinitionsModule` is not imported for the `FieldDefinitionRepository` this service needs
 * to check a curated selection - that is a persistence port `PersistenceModule` already provides,
 * not `FieldDefinitionService`. The two feature modules need each other's REPOSITORIES, never each
 * other's services, so neither imports the other (see `statuses.module.ts` on `BoardRepository`).
 */
@Module({
  imports: [PersistenceModule, AuthModule],
  controllers: [IdeaTypesController],
  providers: [
    {
      provide: IdeaTypeService,
      useFactory: (
        ideaTypes: IdeaTypeRepository,
        fieldDefinitions: FieldDefinitionRepository,
        organizations: OrganizationExistenceLookup,
        unitOfWork: UnitOfWork,
        auditEvents: AuditEventWriter,
        currentUser: CurrentUserContext,
        clock: Clock,
      ) =>
        new IdeaTypeService(
          ideaTypes,
          fieldDefinitions,
          organizations,
          unitOfWork,
          auditEvents,
          currentUser,
          clock,
        ),
      inject: [
        PORT_TOKENS.IdeaTypeRepository,
        PORT_TOKENS.FieldDefinitionRepository,
        PORT_TOKENS.OrganizationExistenceLookup,
        PORT_TOKENS.UnitOfWork,
        PORT_TOKENS.AuditEventWriter,
        PORT_TOKENS.CurrentUserContext,
        PORT_TOKENS.Clock,
      ],
    },
  ],
  exports: [IdeaTypeService],
})
export class IdeaTypesModule {}
