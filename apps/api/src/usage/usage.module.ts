import type { AuditEventWriter, Clock, CurrentUserContext } from '@collega/application/common'
import {
  type UsageEventStore,
  UsageService,
  type UsageTrackingPreferences,
} from '@collega/application/usage'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { CronSecretGuard } from '../auth/cron-secret.guard.js'
import { CONFIG, ConfigModule } from '../common/config/config.module.js'
import type { Config } from '../common/config/index.js'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { PORT_TOKENS } from '../common/tokens.js'
import { consoleUsageFailureLog } from './console-usage-failure-log.js'
import { UsageController } from './usage.controller.js'

/**
 * Usage analytics. `useFactory` rather than `@Injectable()` because `packages/application` may not
 * import `@nestjs/common`.
 */
@Module({
  imports: [PersistenceModule, AuthModule, ConfigModule],
  controllers: [UsageController],
  providers: [
    CronSecretGuard,
    {
      provide: UsageService,
      useFactory: (
        store: UsageEventStore,
        preferences: UsageTrackingPreferences,
        auditEvents: AuditEventWriter,
        currentUser: CurrentUserContext,
        clock: Clock,
        config: Config,
      ) =>
        new UsageService(
          store,
          preferences,
          auditEvents,
          currentUser,
          clock,
          consoleUsageFailureLog,
          {
            enabled: config.usage.enabled,
            retentionDays: config.usage.retentionDays,
          },
        ),
      inject: [
        PORT_TOKENS.UsageEventStore,
        PORT_TOKENS.UsageTrackingPreferences,
        PORT_TOKENS.AuditEventWriter,
        PORT_TOKENS.CurrentUserContext,
        PORT_TOKENS.Clock,
        CONFIG,
      ],
    },
  ],
})
export class UsageModule {}
