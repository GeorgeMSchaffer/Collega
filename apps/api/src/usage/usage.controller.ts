import { UsageService } from '@collega/application/usage'
import { Body, Controller, Get, HttpCode, Post, Put, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard.js'
import { CronSecretGuard } from '../auth/cron-secret.guard.js'

/** Usage analytics (`SPEC/contracts/usage.md`). Authorization and validation are the service's. */
@Controller()
export class UsageController {
  constructor(private readonly usage: UsageService) {}

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

  /** `GET` because Vercel Cron calls a path with `GET`. */
  @Get('internal/usage/rollup')
  @UseGuards(CronSecretGuard)
  async rollUp(): Promise<{ daysRolledUp: number; rowsDeleted: number }> {
    return this.usage.rollUp()
  }
}
