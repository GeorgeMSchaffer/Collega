import type {
  AuditEventWriter,
  Clock,
  CurrentUserContext,
  UnitOfWork,
} from '@collega/application/common'
import type { FieldDefinitionRepository } from '@collega/application/fields'
import type {
  FieldsetRepository,
  OrganizationExistenceLookup,
} from '@collega/application/fieldsets'
import { FieldsetService } from '@collega/application/fieldsets'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { PORT_TOKENS } from '../common/tokens.js'
import { FieldsetsController } from './fieldsets.controller.js'

/** Reusable groups of the organization's fields, attached to idea types by reference. */
@Module({
  imports: [PersistenceModule, AuthModule],
  controllers: [FieldsetsController],
  providers: [
    {
      provide: FieldsetService,
      useFactory: (
        fieldsets: FieldsetRepository,
        fieldDefinitions: FieldDefinitionRepository,
        organizations: OrganizationExistenceLookup,
        unitOfWork: UnitOfWork,
        auditEvents: AuditEventWriter,
        currentUser: CurrentUserContext,
        clock: Clock,
      ) =>
        new FieldsetService(
          fieldsets,
          fieldDefinitions,
          organizations,
          unitOfWork,
          auditEvents,
          currentUser,
          clock,
        ),
      inject: [
        PORT_TOKENS.FieldsetRepository,
        PORT_TOKENS.FieldDefinitionRepository,
        PORT_TOKENS.OrganizationExistenceLookup,
        PORT_TOKENS.UnitOfWork,
        PORT_TOKENS.AuditEventWriter,
        PORT_TOKENS.CurrentUserContext,
        PORT_TOKENS.Clock,
      ],
    },
  ],
  exports: [FieldsetService],
})
export class FieldsetsModule {}
