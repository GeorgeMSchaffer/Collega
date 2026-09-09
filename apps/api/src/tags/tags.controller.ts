import { TagService } from '@collega/application/tags'
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard.js'
import { optional } from '../common/request-values.js'
import { UuidParamPipe } from '../common/uuid-param.pipe.js'

/**
 * `int?` from the query string. `?limit=abc` defaults rather than answering the ASP.NET
 * model-binding 400 no fixture records - the divergence `ideas.controller.ts` documents at length.
 */
function optionalInt(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Organization-scoped tag autocomplete (`SPEC/30-Contracts.md` "Tag Contracts").
 *
 * One route, and no tag create endpoint by design: tags come into existence implicitly when an
 * idea is saved, which belongs to Ideas' `TagsPort.getOrCreate`, so this controller only reads.
 *
 * **No controller prefix**, matching the rest of Wave D, even though .NET used
 * `[Route("organizations")]` here and could get away with it on a single route. The path is
 * written out in full so it reads the same as every other route in the app and cannot move if a
 * second, differently-rooted tag route is ever added.
 *
 * `search` is passed through as the empty string when absent, not as `null`: .NET's action did
 * `search ?? string.Empty`, and `TagService.suggest` then measures the normalized prefix against
 * its 2-character minimum and returns `[]`. That is the recorded behaviour of the bare
 * `GET /organizations/{id}/tags` - a 200 with an empty array, not every tag in the organization.
 *
 * Scoping is `TagService`'s: a Site Admin may read any organization, everyone else only their own,
 * and a mismatch is a 404 rather than a 403.
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
}
