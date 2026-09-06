import type { NotificationEvent } from '@collega/domain/notifications'

/** Pure persistence: one insert per call, no batching in MVP - mirrors .NET's
 * `EfNotificationEventWriter`, minus the business logic that lives in `NotificationService`
 * instead (SPEC/50-typescript-migration.md section 3: Infrastructure holds no business rules). */
export interface NotificationEventRepository {
  add(event: NotificationEvent): Promise<void>
}
