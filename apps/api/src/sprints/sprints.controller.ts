import { type DeliveryCard, IdeaService } from '@collega/application/ideas'
import { type SprintItem, SprintService } from '@collega/application/sprints'
import { SprintState } from '@collega/domain/enums'
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
import { RequestValidationError } from '../common/errors/request-validation.error.js'
import { optional, optionalGuid } from '../common/request-values.js'
import { UuidParamPipe } from '../common/uuid-param.pipe.js'

type SprintBody = {
  name?: unknown
  goal?: unknown
  startDate?: unknown
  endDate?: unknown
  ownerUserId?: unknown
}

/** One sprint with the Issues assigned to it - see `getById` for why the two are composed here. */
type SprintDetail = SprintItem & { readonly issues: readonly DeliveryCard[] }

/**
 * `?state=` on the sprint list, parsed because `SprintService.list` takes the enum rather than the
 * text. Absent or blank means "every state"; an unrecognised value is refused rather than read as
 * absent, since silently listing everything answers 200 with rows the caller explicitly excluded.
 */
function sprintStateFilter(value: unknown): SprintState | null {
  const text = optional(value)
  if (text === null) {
    return null
  }
  const match = Object.values(SprintState).find(
    (s) => s.toLowerCase() === text.trim().toLowerCase(),
  )
  if (!match) {
    throw new RequestValidationError({
      state: [`State must be one of: ${Object.values(SprintState).join(', ')}.`],
    })
  }
  return match
}

/**
 * Sprints (`SPEC/30-Contracts.md` "Sprint Contracts", `SPEC/20-feature-issues-and-delivery.md`
 * "Sprints"). Every route hangs off `organizations/{organizationId}/sprints`, because a sprint has
 * no life outside its organization and the list is the screen these are reached from.
 *
 * Authorization is `SprintService`'s: reading the list and one sprint is open to every member of
 * the organization (the sprint board is ticked for Read Only in the spec's Permissions table),
 * while create, update, start, complete and delete are admin-only and refuse a direct Site Admin.
 * Cross-tenant ids answer 404 rather than 403 throughout.
 *
 * **No body validation here.** Name, goal and the date window are the domain's invariants
 * (`packages/domain/src/sprints/sprint.ts`), surfaced as the same field-keyed 400 a controller
 * check would produce; owner membership is the Application layer's. Restating any of them here
 * would be a second, differently-worded answer to the same question.
 */
@Controller()
@UseGuards(AuthGuard)
export class SprintsController {
  constructor(
    private readonly sprints: SprintService,
    private readonly ideas: IdeaService,
  ) {}

  @Get('organizations/:organizationId/sprints')
  async list(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<readonly SprintItem[]> {
    return this.sprints.list(organizationId, sprintStateFilter(query.state))
  }

  /**
   * One sprint with its Issues.
   *
   * **The composition is the API's, deliberately.** `SprintService.get` does not embed its cards:
   * a delivery card is `IdeaService.listDelivery`'s projection - the ideation card plus effort,
   * delivery status, sprint, task rollup and provenance - and answering the same shape from two
   * services would be two places to keep it right (`packages/application/src/sprints/models.ts`
   * says so). The sprint board reads both anyway; this route saves it a round trip.
   *
   * Order matters: the sprint read runs first, so a cross-tenant or missing id is the sprint's own
   * 404 rather than an empty issue list beside a sprint the caller may not see.
   */
  @Get('organizations/:organizationId/sprints/:sprintId')
  async getById(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Param('sprintId', UuidParamPipe) sprintId: string,
  ): Promise<SprintDetail> {
    const sprint = await this.sprints.get(organizationId, sprintId)
    const issues = await this.ideas.listDelivery(organizationId, {
      sprintId,
      deliveryStatus: null,
    })
    return { ...sprint, issues }
  }

  @Post('organizations/:organizationId/sprints')
  @HttpCode(201)
  async create(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Body() body: SprintBody,
  ): Promise<SprintItem> {
    return this.sprints.create(organizationId, toCommand(body))
  }

  @Put('organizations/:organizationId/sprints/:sprintId')
  async update(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Param('sprintId', UuidParamPipe) sprintId: string,
    @Body() body: SprintBody,
  ): Promise<SprintItem> {
    return this.sprints.update(organizationId, sprintId, toCommand(body))
  }

  /** `Planned -> Active`. Starting anything else is a 400 keyed `state`. */
  @Post('organizations/:organizationId/sprints/:sprintId/start')
  @HttpCode(204)
  async start(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Param('sprintId', UuidParamPipe) sprintId: string,
  ): Promise<void> {
    await this.sprints.start(organizationId, sprintId)
  }

  /** `Active -> Completed`, returning every unfinished Issue to the delivery backlog. */
  @Post('organizations/:organizationId/sprints/:sprintId/complete')
  @HttpCode(204)
  async complete(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Param('sprintId', UuidParamPipe) sprintId: string,
  ): Promise<void> {
    await this.sprints.complete(organizationId, sprintId)
  }

  /** Soft delete. Assigned Issues are unassigned to the backlog first; no Issue is ever deleted. */
  @Delete('organizations/:organizationId/sprints/:sprintId')
  @HttpCode(204)
  async delete(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Param('sprintId', UuidParamPipe) sprintId: string,
  ): Promise<void> {
    await this.sprints.delete(organizationId, sprintId)
  }
}

/** Create and update take the identical shape, as their commands do. */
function toCommand(body: SprintBody): {
  name: string
  goal: string | null
  startDate: string
  endDate: string
  ownerUserId: string | null
} {
  return {
    name: optional(body.name) ?? '',
    goal: optional(body.goal),
    startDate: optional(body.startDate) ?? '',
    endDate: optional(body.endDate) ?? '',
    ownerUserId: optionalGuid(body.ownerUserId),
  }
}
