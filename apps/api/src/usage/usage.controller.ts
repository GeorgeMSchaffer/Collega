import type { Page } from '@collega/application/common'
import {
  type UsageOverview,
  type UsagePaths,
  UsageReportService,
  UsageService,
  type UsageTrailItem,
} from '@collega/application/usage'
import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard.js'
import { CronSecretGuard } from '../auth/cron-secret.guard.js'
import { UuidParamPipe } from '../common/uuid-param.pipe.js'

/** Usage analytics (`SPEC/contracts/usage.md`). Authorization and validation are the service's. */
@Controller()
export class UsageController {
  constructor(
    private readonly usage: UsageService,
    private readonly reports: UsageReportService,
  ) {}

  /** Always `202`: the client never waits on, or reacts to, this answer. */
  @Post('usage/events')
  @HttpCode(202)
  @UseGuards(AuthGuard)
  async record(@Body() body: unknown): Promise<{ accepted: number }> {
    return this.usage.record(body)
  }

  @Get('usage/tracking')
  @UseGuards(AuthGuard)
  async getTracking(): Promise<{ enabled: boolean }> {
    return this.usage.getTracking()
  }

  @Put('usage/tracking')
  @UseGuards(AuthGuard)
  async setTracking(@Body() body: unknown): Promise<{ enabled: boolean }> {
    return this.usage.setTracking(body)
  }

  @Get('usage/organizations/:organizationId/overview')
  @UseGuards(AuthGuard)
  async overview(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<UsageOverview> {
    return this.reports.overview(organizationId, query)
  }

  @Get('usage/organizations/:organizationId/paths')
  @UseGuards(AuthGuard)
  async paths(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<UsagePaths> {
    return this.reports.paths(organizationId, query)
  }

  @Get('usage/users/:userId/trail')
  @UseGuards(AuthGuard)
  async trail(
    @Param('userId', UuidParamPipe) userId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<Page<UsageTrailItem> & { optedOut: boolean }> {
    return this.reports.trail(userId, query)
  }

  /** `GET` because Vercel Cron calls a path with `GET`. */
  @Get('internal/usage/rollup')
  @UseGuards(CronSecretGuard)
  async rollUp(): Promise<{ daysRolledUp: number; rowsDeleted: number }> {
    return this.usage.rollUp()
  }
}
