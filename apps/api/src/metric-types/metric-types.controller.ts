import {
  type IdeaMetric,
  IdeaMetricsService,
  type MetricTypeItem,
  MetricTypeService,
} from '@collega/application/metric-types'
import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard.js'
import { RequestValidationError } from '../common/errors/request-validation.error.js'
import { optional, queryBool } from '../common/request-values.js'
import { UuidParamPipe } from '../common/uuid-param.pipe.js'

type MetricTypeBody = { name?: unknown; unit?: unknown; isArchived?: unknown }

/** A JSON number passes through; absent or `null` is no value; anything else reaches the domain as NaN, a 400. */
function numberOrNull(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null
  }
  return typeof value === 'number' ? value : Number.NaN
}

/**
 * Metric types and the values an item carries (`SPEC/contracts/metric-types.md`). Authorization is
 * the services': every member reads, an in-scope Org Admin manages types, whoever may edit an item
 * writes its values, and a Site Admin acting directly is refused on every route.
 */
@Controller()
@UseGuards(AuthGuard)
export class MetricTypesController {
  constructor(
    private readonly metricTypes: MetricTypeService,
    private readonly ideaMetrics: IdeaMetricsService,
  ) {}

  @Get('organizations/:organizationId/metric-types')
  async list(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<readonly MetricTypeItem[]> {
    return this.metricTypes.list(organizationId, queryBool(query.includeArchived))
  }

  @Post('organizations/:organizationId/metric-types')
  @HttpCode(201)
  async create(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Body() body: MetricTypeBody,
  ): Promise<MetricTypeItem> {
    return this.metricTypes.create(organizationId, {
      name: optional(body.name) ?? '',
      unit: optional(body.unit),
    })
  }

  @Put('organizations/:organizationId/metric-types/:metricTypeId')
  async update(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Param('metricTypeId', UuidParamPipe) metricTypeId: string,
    @Body() body: MetricTypeBody,
  ): Promise<MetricTypeItem> {
    // A full replacement: every field is required, `unit` as text or an explicit null.
    const unitInvalid = body.unit !== null && typeof body.unit !== 'string'
    if (unitInvalid || typeof body.isArchived !== 'boolean') {
      throw new RequestValidationError({
        ...(unitInvalid ? { unit: ['Unit is required.'] } : {}),
        ...(typeof body.isArchived !== 'boolean'
          ? { isArchived: ['Is Archived is required.'] }
          : {}),
      })
    }
    return this.metricTypes.update(organizationId, metricTypeId, {
      name: optional(body.name) ?? '',
      unit: optional(body.unit),
      isArchived: body.isArchived,
    })
  }

  @Get('ideas/:ideaId/metrics')
  async getIdeaMetrics(
    @Param('ideaId', UuidParamPipe) ideaId: string,
  ): Promise<readonly IdeaMetric[]> {
    return this.ideaMetrics.get(ideaId)
  }

  @Put('ideas/:ideaId/metrics')
  async setIdeaMetrics(
    @Param('ideaId', UuidParamPipe) ideaId: string,
    @Body() body: { metrics?: unknown },
  ): Promise<readonly IdeaMetric[]> {
    if (!Array.isArray(body.metrics)) {
      throw new RequestValidationError({ metrics: ['Metrics must be a list.'] })
    }
    return this.ideaMetrics.replace(
      ideaId,
      body.metrics.map((entry: Record<string, unknown> | null) => ({
        // A non-GUID id is '' here, which names no type: the 400 "Metric type not found."
        metricTypeId: typeof entry?.metricTypeId === 'string' ? entry.metricTypeId : '',
        projected: numberOrNull(entry?.projected),
        realized: numberOrNull(entry?.realized),
      })),
    )
  }
}
