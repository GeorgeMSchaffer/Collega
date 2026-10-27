import type { BoardAccessLookup } from '@collega/application/boards'
import type {
  AuditEventWriter,
  Clock,
  CurrentUserContext,
  UnitOfWork,
} from '@collega/application/common'
import type {
  IdeaMetricValuesPort,
  MetricIdeasPort,
  MetricTypeRepository,
} from '@collega/application/metric-types'
import { IdeaMetricsService, MetricTypeService } from '@collega/application/metric-types'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { PORT_TOKENS } from '../common/tokens.js'
import { MetricTypesController } from './metric-types.controller.js'

/**
 * Metric types and item values. `MetricIdeasPort` is the "load an idea" slice of
 * `PrismaIdeaRepository`; `common/persistence/adapters.providers.ts` owns that aliasing.
 *
 * `useFactory` rather than `@Injectable()` because `packages/application` may not import
 * `@nestjs/common`.
 */
@Module({
  imports: [PersistenceModule, AuthModule],
  controllers: [MetricTypesController],
  providers: [
    {
      provide: MetricTypeService,
      useFactory: (
        metricTypes: MetricTypeRepository,
        unitOfWork: UnitOfWork,
        auditEvents: AuditEventWriter,
        currentUser: CurrentUserContext,
        clock: Clock,
      ) => new MetricTypeService(metricTypes, unitOfWork, auditEvents, currentUser, clock),
      inject: [
        PORT_TOKENS.MetricTypeRepository,
        PORT_TOKENS.UnitOfWork,
        PORT_TOKENS.AuditEventWriter,
        PORT_TOKENS.CurrentUserContext,
        PORT_TOKENS.Clock,
      ],
    },
    {
      provide: IdeaMetricsService,
      useFactory: (
        ideas: MetricIdeasPort,
        metricTypes: MetricTypeRepository,
        values: IdeaMetricValuesPort,
        unitOfWork: UnitOfWork,
        auditEvents: AuditEventWriter,
        currentUser: CurrentUserContext,
        clock: Clock,
        boardAccess: BoardAccessLookup,
      ) =>
        new IdeaMetricsService(
          ideas,
          metricTypes,
          values,
          unitOfWork,
          auditEvents,
          currentUser,
          clock,
          boardAccess,
        ),
      inject: [
        PORT_TOKENS.MetricIdeasPort,
        PORT_TOKENS.MetricTypeRepository,
        PORT_TOKENS.IdeaMetricValuesPort,
        PORT_TOKENS.UnitOfWork,
        PORT_TOKENS.AuditEventWriter,
        PORT_TOKENS.CurrentUserContext,
        PORT_TOKENS.Clock,
        PORT_TOKENS.BoardAccessLookup,
      ],
    },
  ],
})
export class MetricTypesModule {}
