import {
  type BusinessImpactItem,
  BusinessImpactService,
} from '@collega/application/business-impacts'
import {
  BUSINESS_IMPACT_COLOR_MAX_LENGTH,
  BUSINESS_IMPACT_NAME_MAX_LENGTH,
} from '@collega/domain/business-impacts'
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
import {
  type FieldRules,
  RequestValidationError,
  validateFields,
} from '../common/errors/request-validation.error.js'
import { guidOrEmpty, optionalInt32, queryBool } from '../common/request-values.js'
import { UuidParamPipe } from '../common/uuid-param.pipe.js'

type CreateBusinessImpactBody = {
  name?: string
  color?: string
  sortOrder?: unknown
}

type UpdateBusinessImpactBody = CreateBusinessImpactBody

type ReorderBusinessImpactsBody = { orderedBusinessImpactIds?: unknown }

/**
 * The attribute set `CreateBusinessImpactRequest` and `UpdateBusinessImpactRequest` share -
 * identical field for field. `SortOrder` is a bare `int?` and carries none.
 *
 * `Color` is `[RequiredField]` here where the status catalog's is optional: an impact chip has no
 * neutral fallback, so the .NET contract made the color mandatory.
 *
 * The `#RRGGBB` shape was described as the domain's rule and was not actually anyone's -
 * `normalizeColor` only rejects a blank string - so twenty characters of anything, a working CSS
 * `url()` included, reached the `style` attribute the design system renders. `hexColor` is that
 * rule, checked here alongside the length it was always paired with. See `HEX_COLOR` in
 * `request-validation.error.ts`.
 */
function businessImpactBodyRules(body: CreateBusinessImpactBody): Record<string, FieldRules> {
  return {
    name: { value: body.name, required: true, maxLength: BUSINESS_IMPACT_NAME_MAX_LENGTH },
    color: {
      value: body.color,
      required: true,
      maxLength: BUSINESS_IMPACT_COLOR_MAX_LENGTH,
      hexColor: true,
    },
  }
}

/**
 * `[RequiredField]` on `ReorderBusinessImpactsRequest.OrderedBusinessImpactIds`, a `List<Guid>`
 * initialised to `new()` - the same two-envelope split `statuses.controller.ts` documents at
 * length for `requireOrderedStatusIds`: `RequiredAttribute` fails on NULL ONLY, so `{}` arrived as
 * an empty list the service refused (Application envelope) while an explicit `null` failed here
 * (model-binding envelope).
 */
function requireOrderedBusinessImpactIds(body: ReorderBusinessImpactsBody): readonly string[] {
  if (body.orderedBusinessImpactIds === null) {
    throw new RequestValidationError({
      orderedBusinessImpactIds: ['Ordered Business Impact Ids is required.'],
    })
  }
  if (!Array.isArray(body.orderedBusinessImpactIds)) {
    return []
  }
  return body.orderedBusinessImpactIds.map(guidOrEmpty)
}

/**
 * Business Impact option administration (SPEC/30-Contracts.md "Idea Field Option Contracts").
 * The same shape as `IdeaTypesController`, but each option carries an editable `#RRGGBB` color.
 *
 * `@Controller()` carries no prefix on purpose - see `boards.controller.ts` for the reasoning.
 * List, create and reorder hang off `organizations/{id}/business-impacts`; update and soft-delete
 * hang off `business-impacts/{id}`.
 *
 * Authorization, the one-active-option floor and name uniqueness live in `BusinessImpactService`.
 */
@Controller()
@UseGuards(AuthGuard)
export class BusinessImpactsController {
  constructor(private readonly businessImpacts: BusinessImpactService) {}

  @Get('organizations/:organizationId/business-impacts')
  async list(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<readonly BusinessImpactItem[]> {
    return this.businessImpacts.list(organizationId, queryBool(query.includeDeleted))
  }

  @Post('organizations/:organizationId/business-impacts')
  @HttpCode(201)
  async create(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Body() body: CreateBusinessImpactBody,
  ): Promise<BusinessImpactItem> {
    validateFields(businessImpactBodyRules(body))

    return this.businessImpacts.create(organizationId, {
      name: body.name ?? '',
      color: body.color ?? '',
      sortOrder: optionalInt32(body.sortOrder),
    })
  }

  @Put('business-impacts/:businessImpactId')
  async update(
    @Param('businessImpactId', UuidParamPipe) businessImpactId: string,
    @Body() body: UpdateBusinessImpactBody,
  ): Promise<BusinessImpactItem> {
    validateFields(businessImpactBodyRules(body))

    return this.businessImpacts.update(businessImpactId, {
      name: body.name ?? '',
      color: body.color ?? '',
      sortOrder: optionalInt32(body.sortOrder),
    })
  }

  /** Replaces the complete active-option order atomically; answers 204, like the .NET action. */
  @Post('organizations/:organizationId/business-impacts/reorder')
  @HttpCode(204)
  async reorder(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Body() body: ReorderBusinessImpactsBody,
  ): Promise<void> {
    await this.businessImpacts.reorder(organizationId, requireOrderedBusinessImpactIds(body))
  }

  /** Soft delete: existing idea references keep resolving, so this is not a row removal. */
  @Delete('business-impacts/:businessImpactId')
  @HttpCode(204)
  async delete(@Param('businessImpactId', UuidParamPipe) businessImpactId: string): Promise<void> {
    await this.businessImpacts.delete(businessImpactId)
  }
}
