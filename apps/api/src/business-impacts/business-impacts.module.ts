import type {
  BusinessImpactRepository,
  OrganizationExistenceLookup,
} from '@collega/application/business-impacts'
import { BusinessImpactService } from '@collega/application/business-impacts'
import type {
  AuditEventWriter,
  Clock,
  CurrentUserContext,
  UnitOfWork,
} from '@collega/application/common'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { PORT_TOKENS } from '../common/tokens.js'
import { BusinessImpactsController } from './business-impacts.controller.js'

/**
 * D5's Business Impact surface: the org-scoped list, create and reorder, plus update and
 * soft-delete.
 */
@Module({
  imports: [PersistenceModule, AuthModule],
  controllers: [BusinessImpactsController],
  providers: [
    {
      provide: BusinessImpactService,
      useFactory: (
        businessImpacts: BusinessImpactRepository,
        organizations: OrganizationExistenceLookup,
        unitOfWork: UnitOfWork,
        auditEvents: AuditEventWriter,
        currentUser: CurrentUserContext,
        clock: Clock,
      ) =>
        new BusinessImpactService(
          businessImpacts,
          organizations,
          unitOfWork,
          auditEvents,
          currentUser,
          clock,
        ),
      inject: [
        PORT_TOKENS.BusinessImpactRepository,
        PORT_TOKENS.OrganizationExistenceLookup,
        PORT_TOKENS.UnitOfWork,
        PORT_TOKENS.AuditEventWriter,
        PORT_TOKENS.CurrentUserContext,
        PORT_TOKENS.Clock,
      ],
    },
  ],
  exports: [BusinessImpactService],
})
export class BusinessImpactsModule {}
