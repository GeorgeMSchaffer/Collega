import type {
  AuditEventWriter,
  Clock,
  CurrentUserContext,
  UnitOfWork,
} from '@collega/application/common'
import type {
  FieldDefinitionRepository,
  OrganizationExistenceLookup,
} from '@collega/application/fields'
import { FieldDefinitionService } from '@collega/application/fields'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { PORT_TOKENS } from '../common/tokens.js'
import { FieldDefinitionsController } from './field-definitions.controller.js'

/**
 * D5's User-Defined Field surface: list, get, create, reorder, update and soft-delete, all
 * org-scoped.
 */
@Module({
  imports: [PersistenceModule, AuthModule],
  controllers: [FieldDefinitionsController],
  providers: [
    {
      provide: FieldDefinitionService,
      useFactory: (
        fieldDefinitions: FieldDefinitionRepository,
        organizations: OrganizationExistenceLookup,
        unitOfWork: UnitOfWork,
        auditEvents: AuditEventWriter,
        currentUser: CurrentUserContext,
        clock: Clock,
      ) =>
        new FieldDefinitionService(
          fieldDefinitions,
          organizations,
          unitOfWork,
          auditEvents,
          currentUser,
          clock,
        ),
      inject: [
        PORT_TOKENS.FieldDefinitionRepository,
        PORT_TOKENS.OrganizationExistenceLookup,
        PORT_TOKENS.UnitOfWork,
        PORT_TOKENS.AuditEventWriter,
        PORT_TOKENS.CurrentUserContext,
        PORT_TOKENS.Clock,
      ],
    },
  ],
  exports: [FieldDefinitionService],
})
export class FieldDefinitionsModule {}
