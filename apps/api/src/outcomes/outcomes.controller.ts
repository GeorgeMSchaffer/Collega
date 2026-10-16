import {
  type IdeaOutcomeResult,
  type OutcomeDetail,
  type OutcomeItem,
  type OutcomePage,
  OutcomeService,
  type Roadmap,
} from '@collega/application/outcomes'
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
import { optional, optionalGuid, optionalInt } from '../common/request-values.js'
import { UuidParamPipe } from '../common/uuid-param.pipe.js'

type OutcomeBody = {
  name?: unknown
  description?: unknown
  targetStartDate?: unknown
  targetEndDate?: unknown
  ownerUserId?: unknown
  color?: unknown
}

/** A present `color` is passed through as text so a bad one is a 400 on `color`, never read as absent. */
function colorValue(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null
  }
  return typeof value === 'string' ? value : ''
}

function fields(body: OutcomeBody) {
  return {
    name: optional(body.name) ?? '',
    description: optional(body.description),
    targetStartDate: optional(body.targetStartDate) ?? '',
    targetEndDate: optional(body.targetEndDate) ?? '',
    ownerUserId: optionalGuid(body.ownerUserId),
  }
}

/**
 * Outcomes and the roadmap (`SPEC/contracts/outcomes.md`). Authorization is `OutcomeService`'s:
 * every member reads, an in-scope Org Admin manages, and a Site Admin acting directly is refused
 * on every route. Field validation is the domain's, surfaced as the field-keyed 400.
 */
@Controller()
@UseGuards(AuthGuard)
export class OutcomesController {
  constructor(private readonly outcomes: OutcomeService) {}

  @Get('organizations/:organizationId/outcomes')
  async list(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<OutcomePage> {
    const page = optionalInt(query.page)
    const pageSize = optionalInt(query.pageSize)
    return this.outcomes.list(organizationId, {
      ...(page === null ? {} : { page }),
      ...(pageSize === null ? {} : { pageSize }),
    })
  }

  @Post('organizations/:organizationId/outcomes')
  @HttpCode(201)
  async create(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Body() body: OutcomeBody,
  ): Promise<OutcomeItem> {
    return this.outcomes.create(organizationId, { ...fields(body), color: colorValue(body.color) })
  }

  /** `order` is a literal segment: declared before `:outcomeId` so it is not read as an id. */
  @Put('organizations/:organizationId/outcomes/order')
  @HttpCode(204)
  async reorder(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Body() body: { orderedIds?: unknown },
  ): Promise<void> {
    if (
      body.orderedIds !== undefined &&
      body.orderedIds !== null &&
      !Array.isArray(body.orderedIds)
    ) {
      throw new RequestValidationError({ orderedIds: ['Ordered Ids must be a list.'] })
    }
    const orderedIds = Array.isArray(body.orderedIds)
      ? body.orderedIds.map((id: unknown) => (typeof id === 'string' ? id : ''))
      : null
    await this.outcomes.reorder(organizationId, orderedIds)
  }

  @Get('organizations/:organizationId/roadmap')
  async roadmap(@Param('organizationId', UuidParamPipe) organizationId: string): Promise<Roadmap> {
    return this.outcomes.roadmap(organizationId)
  }

  @Get('organizations/:organizationId/outcomes/:outcomeId')
  async getById(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Param('outcomeId', UuidParamPipe) outcomeId: string,
  ): Promise<OutcomeDetail> {
    return this.outcomes.get(organizationId, outcomeId)
  }

  @Put('organizations/:organizationId/outcomes/:outcomeId')
  async update(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Param('outcomeId', UuidParamPipe) outcomeId: string,
    @Body() body: OutcomeBody,
  ): Promise<OutcomeItem> {
    // Absent leaves the colour unchanged; an explicit null reaches the service as null and is a 400.
    const color =
      'color' in body ? (body.color === null ? null : colorValue(body.color)) : undefined
    return this.outcomes.update(organizationId, outcomeId, { ...fields(body), color })
  }

  @Delete('organizations/:organizationId/outcomes/:outcomeId')
  @HttpCode(204)
  async delete(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Param('outcomeId', UuidParamPipe) outcomeId: string,
  ): Promise<void> {
    await this.outcomes.delete(organizationId, outcomeId)
  }

  @Put('ideas/:ideaId/outcomes')
  async setIdeaOutcome(
    @Param('ideaId', UuidParamPipe) ideaId: string,
    @Body() body: { outcomeId?: unknown },
  ): Promise<IdeaOutcomeResult> {
    if (body.outcomeId === undefined || body.outcomeId === null) {
      return this.outcomes.setIdeaOutcome(ideaId, null)
    }
    // A non-GUID value reaches the service as '', which is no Outcome: a 400 keyed outcomeId.
    return this.outcomes.setIdeaOutcome(ideaId, optionalGuid(body.outcomeId) ?? '')
  }
}
