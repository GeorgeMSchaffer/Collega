import {
  type InboxPage,
  NotificationInboxService,
  type UnreadCountResult,
} from '@collega/application/notifications'
import { Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard.js'
import { optionalInt } from '../common/request-values.js'
import { UuidParamPipe } from '../common/uuid-param.pipe.js'

/**
 * The caller's own inbox (`SPEC/contracts/notifications.md` "Notification Inbox Contracts"). No
 * route takes a user id: the recipient is always the current user, which under View As is the
 * target, and `NotificationInboxService` applies the 90-day window and the soft-delete rule.
 */
@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly inbox: NotificationInboxService) {}

  @Get()
  async list(@Query() query: Record<string, unknown>): Promise<InboxPage> {
    return this.inbox.list({
      page: optionalInt(query.page),
      pageSize: optionalInt(query.pageSize),
    })
  }

  @Get('unread-count')
  async unreadCount(): Promise<UnreadCountResult> {
    return this.inbox.unreadCount()
  }

  @Post('read-all')
  @HttpCode(204)
  async markAllRead(): Promise<void> {
    await this.inbox.markAllRead()
  }

  @Post(':notificationId/read')
  @HttpCode(204)
  async markRead(@Param('notificationId', UuidParamPipe) notificationId: string): Promise<void> {
    await this.inbox.markRead(notificationId)
  }
}
