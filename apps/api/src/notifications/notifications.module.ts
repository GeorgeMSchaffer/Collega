import type { Clock } from '@collega/application/common'
import type { NotificationEventRepository } from '@collega/application/notifications'
import { NotificationService } from '@collega/application/notifications'
import { Module } from '@nestjs/common'
import { PersistenceModule } from '../common/persistence/persistence.module.js'
import { PORT_TOKENS } from '../common/tokens.js'

/**
 * `NotificationService`, and nothing else - the one feature module in Wave D with no controller.
 *
 * Notifications is a write-only side effect of other features' mutations, so .NET gave it no
 * controller either (`packages/application/src/notifications/index.ts` says as much). It gets a
 * module rather than a provider inlined into `IdeasModule` because it has more than one consumer:
 * `IdeaService` takes it as its `NotificationsPort` today and `CommentService` takes it as its
 * `NotificationWriter` in D4, and the alternative is two factories building the same service -
 * the thing `UsersModule` importing `AuthenticationModule` already exists to avoid.
 *
 * **This is the wiring `common/tokens.ts` says is NOT on the port-token list.** `NotificationsPort`
 * is satisfied by an Application-layer class, not by an infrastructure adapter, so no
 * `PORT_ALIASES` entry can produce one. It is built here from the two ports that ARE on the list:
 * `NotificationEventRepository` (the Prisma writer) and `Clock`. Self-notification suppression
 * lives inside the service, which is why consumers must depend on it rather than reaching for
 * `NotificationEventRepository` directly.
 */
@Module({
  imports: [PersistenceModule],
  providers: [
    {
      provide: NotificationService,
      useFactory: (notifications: NotificationEventRepository, clock: Clock) =>
        new NotificationService(notifications, clock),
      inject: [PORT_TOKENS.NotificationEventRepository, PORT_TOKENS.Clock],
    },
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}
