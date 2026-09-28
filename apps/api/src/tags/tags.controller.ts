import { type TagItem, TagService } from '@collega/application/tags'
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

type TagBody = { name?: unknown; color?: unknown }

/**
 * Organization-scoped tags (`SPEC/30-Contracts.md` "Tag Contracts" and "Tag colour and
 * management"): the autocomplete, the member-readable catalog, and the Org Admin routes behind
 * Settings → Tags. Inline creation while tagging an idea stays with Ideas.
 *
 * **No controller prefix**, matching the rest of Wave D: the catalog and create hang off
 * `organizations/{id}/tags`, update and delete off `tags/{id}`.
 *
 * `search` is passed through as the empty string when absent, not as `null`: .NET's action did
 * `search ?? string.Empty`, and `TagService.suggest` then measures the normalized prefix against
 * its 2-character minimum and returns `[]`. That is the recorded behaviour of the bare
 * `GET /organizations/{id}/tags` - a 200 with an empty array, not every tag in the organization.
 *
 * Validation, scoping and the Org Admin gate are `TagService`'s. A `color` that is absent or
 * `null` reaches it as `null`; any other non-string is stringified so the service refuses it on
 * `color` rather than the controller inventing a second message.
 */
@Controller()
@UseGuards(AuthGuard)
export class TagsController {
  constructor(private readonly tags: TagService) {}

  @Get('organizations/:organizationId/tags')
  async suggest(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<readonly string[]> {
    return this.tags.suggest(organizationId, optional(query.search) ?? '', optionalInt(query.limit))
  }

  @Get('organizations/:organizationId/tags/catalog')
  async catalog(
    @Param('organizationId', UuidParamPipe) organizationId: string,
  ): Promise<readonly TagItem[]> {
    return this.tags.catalog(organizationId)
  }

  @Post('organizations/:organizationId/tags')
  @HttpCode(201)
  async create(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Body() body: TagBody,
  ): Promise<TagItem> {
    return this.tags.create(organizationId, parseTagBody(body))
  }

  @Put('tags/:tagId')
  async update(
    @Param('tagId', UuidParamPipe) tagId: string,
    @Body() body: TagBody,
  ): Promise<TagItem> {
    return this.tags.update(tagId, parseTagBody(body))
  }

  @Delete('tags/:tagId')
  @HttpCode(204)
  async delete(@Param('tagId', UuidParamPipe) tagId: string): Promise<void> {
    await this.tags.delete(tagId)
  }
}

function parseTagBody(body: TagBody | undefined): { name: string; color: string | null } {
  const name = body?.name
  const color = body?.color
  return {
    name: typeof name === 'string' ? name : '',
    color: color === undefined || color === null ? null : String(color),
  }
}
