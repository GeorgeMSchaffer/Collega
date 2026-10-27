import type { Page, PageRequest } from '@collega/application/common'
import {
  type LoginMessageAcknowledgementReport,
  type LoginMessageInput,
  type LoginMessageItem,
  LoginMessageService,
  type VisibleLoginMessage,
} from '@collega/application/login-messages'
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard.js'
import { optional, optionalInt } from '../common/request-values.js'
import { UuidParamPipe } from '../common/uuid-param.pipe.js'

type LoginMessageBody = {
  title?: unknown
  body?: unknown
  display?: unknown
  dismissalMode?: unknown
  startsAtUtc?: unknown
  endsAtUtc?: unknown
  showAgain?: unknown
}

/** Text parses as a date; anything else reaches the domain as an invalid Date, a 400. */
function date(value: unknown): Date {
  return new Date(typeof value === 'string' && value.length > 0 ? value : Number.NaN)
}

function toInput(body: LoginMessageBody): LoginMessageInput {
  return {
    title: optional(body.title) ?? '',
    body: optional(body.body) ?? '',
    display: optional(body.display) ?? '',
    dismissalMode: optional(body.dismissalMode) ?? '',
    startsAtUtc: date(body.startsAtUtc),
    endsAtUtc:
      body.endsAtUtc === undefined || body.endsAtUtc === null ? null : date(body.endsAtUtc),
  }
}

function pageOf(query: Record<string, unknown>): Partial<PageRequest> {
  const page = optionalInt(query.page)
  const pageSize = optionalInt(query.pageSize)
  return { ...(page === null ? {} : { page }), ...(pageSize === null ? {} : { pageSize }) }
}

/**
 * Sign-in messages (`SPEC/contracts/login-messages.md`). Authorization is the service's. The fixed
 * paths are declared before `login-messages/:messageId` so they are matched first.
 */
@Controller()
@UseGuards(AuthGuard)
export class LoginMessagesController {
  constructor(private readonly messages: LoginMessageService) {}

  @Get('login-messages/system')
  async listSystem(@Query() query: Record<string, unknown>): Promise<Page<LoginMessageItem>> {
    return this.messages.listSystem(pageOf(query))
  }

  @Post('login-messages/system')
  @HttpCode(201)
  async createSystem(@Body() body: LoginMessageBody): Promise<LoginMessageItem> {
    return this.messages.createSystem(toInput(body))
  }

  @Get('login-messages/visible')
  async visible(): Promise<{ items: readonly VisibleLoginMessage[] }> {
    return { items: await this.messages.listVisible() }
  }

  @Get('organizations/:organizationId/login-messages')
  async listForOrganization(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<Page<LoginMessageItem>> {
    return this.messages.listForOrganization(organizationId, pageOf(query))
  }

  @Post('organizations/:organizationId/login-messages')
  @HttpCode(201)
  async createForOrganization(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Body() body: LoginMessageBody,
  ): Promise<LoginMessageItem> {
    return this.messages.createForOrganization(organizationId, toInput(body))
  }

  @Get('login-messages/:messageId')
  async get(@Param('messageId', UuidParamPipe) messageId: string): Promise<LoginMessageItem> {
    return this.messages.get(messageId)
  }

  @Put('login-messages/:messageId')
  async update(
    @Param('messageId', UuidParamPipe) messageId: string,
    @Body() body: LoginMessageBody,
  ): Promise<LoginMessageItem> {
    return this.messages.update(messageId, { ...toInput(body), showAgain: body.showAgain === true })
  }

  @Delete('login-messages/:messageId')
  @HttpCode(204)
  async delete(@Param('messageId', UuidParamPipe) messageId: string): Promise<void> {
    await this.messages.delete(messageId)
  }

  @Get('login-messages/:messageId/acknowledgements')
  async acknowledgements(
    @Param('messageId', UuidParamPipe) messageId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<LoginMessageAcknowledgementReport> {
    return this.messages.acknowledgements(messageId, pageOf(query))
  }

  @Post('login-messages/:messageId/close')
  @HttpCode(204)
  async close(@Param('messageId', UuidParamPipe) messageId: string): Promise<void> {
    await this.messages.close(messageId)
  }

  @Post('login-messages/:messageId/acknowledge')
  @HttpCode(204)
  async acknowledge(@Param('messageId', UuidParamPipe) messageId: string): Promise<void> {
    await this.messages.acknowledge(messageId)
  }
}
