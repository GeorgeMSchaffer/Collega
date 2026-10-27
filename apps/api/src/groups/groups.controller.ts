import { type GroupDetail, type GroupListItem, GroupService } from '@collega/application/groups'
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard.js'
import { RequestValidationError } from '../common/errors/request-validation.error.js'
import { isGuid } from '../common/request-values.js'
import { UuidParamPipe } from '../common/uuid-param.pipe.js'

type GroupBody = {
  name?: unknown
  description?: unknown
  userIds?: unknown
}

type MembersBody = { userIds?: unknown }

/** Name and description reach the domain as text, so its messages are the contract's. */
function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** `undefined` when the key is absent, so an update can leave the description unchanged. */
function description(body: GroupBody): string | null | undefined {
  if (!('description' in body)) {
    return undefined
  }
  return typeof body.description === 'string' ? body.description : null
}

function userIds(value: unknown, required: boolean): readonly string[] {
  if (value === undefined && !required) {
    return []
  }
  if (!Array.isArray(value) || !value.every(isGuid)) {
    throw new RequestValidationError({ userIds: ['User ids must be an array of ids.'] })
  }
  return value.map((id: string) => id.trim().toLowerCase())
}

/**
 * Organization user groups (SPEC/contracts/groups.md). Authorization, name uniqueness and the
 * membership checks live in `GroupService`.
 */
@Controller()
@UseGuards(AuthGuard)
export class GroupsController {
  constructor(private readonly groups: GroupService) {}

  @Get('organizations/:organizationId/groups')
  async list(
    @Param('organizationId', UuidParamPipe) organizationId: string,
  ): Promise<readonly GroupListItem[]> {
    return this.groups.list(organizationId)
  }

  @Post('organizations/:organizationId/groups')
  @HttpCode(201)
  async create(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Body() body: GroupBody,
  ): Promise<GroupDetail> {
    return this.groups.create(organizationId, {
      name: text(body.name),
      description: description(body) ?? null,
      userIds: userIds(body.userIds ?? undefined, false),
    })
  }

  @Get('groups/:groupId')
  async get(@Param('groupId', UuidParamPipe) groupId: string): Promise<GroupDetail> {
    return this.groups.getById(groupId)
  }

  @Put('groups/:groupId')
  async update(
    @Param('groupId', UuidParamPipe) groupId: string,
    @Body() body: GroupBody,
  ): Promise<GroupDetail> {
    return this.groups.update(groupId, { name: text(body.name), description: description(body) })
  }

  /** Replaces the whole membership; `[]` empties the group. */
  @Put('groups/:groupId/members')
  async setMembers(
    @Param('groupId', UuidParamPipe) groupId: string,
    @Body() body: MembersBody,
  ): Promise<GroupDetail> {
    return this.groups.setMembers(groupId, { userIds: userIds(body.userIds, true) })
  }

  /** A hard delete; memberships go with it. */
  @Delete('groups/:groupId')
  @HttpCode(204)
  async delete(@Param('groupId', UuidParamPipe) groupId: string): Promise<void> {
    await this.groups.delete(groupId)
  }
}
