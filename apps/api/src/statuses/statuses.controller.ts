import {
  type CreateStatusResult,
  type StatusItem,
  StatusService,
} from '@collega/application/statuses'
import { STATUS_COLOR_MAX_LENGTH, STATUS_NAME_MAX_LENGTH } from '@collega/domain/statuses'
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
import { optional, queryBool } from '../common/request-values.js'
import { UuidParamPipe } from '../common/uuid-param.pipe.js'

type CreateStatusBody = {
  name?: string
  color?: string | null
  sortOrder?: number | null
}

type UpdateStatusBody = CreateStatusBody

type ReorderStatusesBody = { orderedStatusIds?: readonly string[] | null }

/**
 * The attribute set `CreateStatusRequest` and `UpdateStatusRequest` share - identical field for
 * field. `sortOrder` carries none.
 *
 * `color` is `[MaxLengthField]` with no `[RequiredField]`, and it is `string?` on the .NET side,
 * so an absent or null value passed: `MaxLengthAttribute.IsValid(null)` returns true, and
 * `validateFields` reaches the same answer by judging a non-string as `''`.
 */
function statusBodyRules(body: CreateStatusBody): Record<string, FieldRules> {
  return {
    name: { value: body.name, required: true, maxLength: STATUS_NAME_MAX_LENGTH },
    color: { value: body.color, maxLength: STATUS_COLOR_MAX_LENGTH },
  }
}

/** `int` is 32-bit and signed on the .NET side; `Int` is the same column here. */
const INT32_MIN = -2147483648
const INT32_MAX = 2147483647

/**
 * `int?` on both request records, with no attributes. Only a JSON number **that an `int` could
 * hold** is a value; anything else is read as omitted so the service applies its own default
 * (append to the end of the catalog on create, keep the current order on update).
 *
 * The range and integer checks are not pedantry - both cases were live faults:
 * - `{"sortOrder": 99999999999}` overflowed Prisma's `Int` and answered **500**. .NET bound `int?`,
 *   failed the conversion, and answered 400.
 * - `{"sortOrder": 1.5}` was accepted, the response ECHOED `1.5`, and the row stored `1` - so the
 *   create response contradicted the very next read. That is a state inconsistency, not only an
 *   infidelity.
 *
 * **A KNOWN DIVERGENCE, deliberate**, and the same one D1 recorded for `?page=abc`: every value
 * this reads as omitted - `"abc"`, `1.5`, `99999999999` alike - was a System.Text.Json or
 * value-conversion binding failure on the .NET side, which is a different envelope again, not the
 * model-binding one and not the Application one. No fixture records it, so reproducing the 400
 * means guessing the wording. Record one against the frozen .NET app first.
 */
function optionalInt(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= INT32_MIN &&
    value <= INT32_MAX
    ? value
    : null
}

/**
 * `[RequiredField]` on `ReorderStatusesRequest.OrderedStatusIds`, which is a `List<Guid>`
 * initialised to `new()`.
 *
 * Written out rather than routed through `validateFields` because the rule genuinely differs on a
 * collection: `RequiredAttribute` fails on NULL ONLY. An omitted key left the initialiser in
 * place, so `{}` arrived as an EMPTY LIST that passed validation and was refused later by the
 * service - the Application envelope, with a different message. `{"orderedStatusIds": null}`
 * overwrote the initialiser and failed here instead. `validateFields` judges a non-string as
 * `''` and cannot tell those two apart.
 */
function requireOrderedStatusIds(body: ReorderStatusesBody): readonly string[] {
  if (body.orderedStatusIds === null) {
    throw new RequestValidationError({
      orderedStatusIds: ['Ordered Status Ids is required.'],
    })
  }
  if (!Array.isArray(body.orderedStatusIds)) {
    return []
  }
  // A non-string member cannot match an active status id, so the service's coverage check
  // refuses the request - which is what a non-Guid member did on the .NET side too, one binding
  // envelope earlier.
  return body.orderedStatusIds.map((id: unknown) => (typeof id === 'string' ? id : ''))
}

/**
 * Organization status configuration (SPEC/30-Contracts.md "Status Contracts").
 *
 * `@Controller()` carries no prefix on purpose - see `boards.controller.ts` for the reasoning.
 * List, create and reorder hang off `organizations/{id}/statuses`; update and soft-delete hang
 * off `statuses/{id}`.
 *
 * Authorization lives in `StatusService`: the catalog is readable by any member of the
 * organization because every board render needs it, while create, update, reorder and delete are
 * Org Admin only. The 2-active-status floor and the board-reference guard are its rules too.
 */
@Controller()
@UseGuards(AuthGuard)
export class StatusesController {
  constructor(private readonly statuses: StatusService) {}

  /**
   * `includeDeleted` is a .NET `bool` rather than `bool?`, so an ABSENT value binds to `false`
   * and the list excludes soft-deleted statuses - see `queryBool` for what else that means.
   *
   * Who may ask is not decided here: the corpus records every role getting the same answer, and
   * that is `StatusService`'s call, not this controller's.
   */
  @Get('organizations/:organizationId/statuses')
  async list(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<readonly StatusItem[]> {
    return this.statuses.list(organizationId, queryBool(query.includeDeleted))
  }

  @Post('organizations/:organizationId/statuses')
  @HttpCode(201)
  async create(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Body() body: CreateStatusBody,
  ): Promise<CreateStatusResult> {
    validateFields(statusBodyRules(body))

    return this.statuses.create(organizationId, {
      name: body.name ?? '',
      color: optional(body.color),
      sortOrder: optionalInt(body.sortOrder),
    })
  }

  @Put('statuses/:statusId')
  async update(
    @Param('statusId', UuidParamPipe) statusId: string,
    @Body() body: UpdateStatusBody,
  ): Promise<StatusItem> {
    validateFields(statusBodyRules(body))

    return this.statuses.update(statusId, {
      name: body.name ?? '',
      color: optional(body.color),
      sortOrder: optionalInt(body.sortOrder),
    })
  }

  /** Replaces the complete active-status order atomically; answers 204, like the .NET action. */
  @Post('organizations/:organizationId/statuses/reorder')
  @HttpCode(204)
  async reorder(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Body() body: ReorderStatusesBody,
  ): Promise<void> {
    await this.statuses.reorder(organizationId, requireOrderedStatusIds(body))
  }

  /** Soft delete: existing references keep resolving, so this is not a row removal. */
  @Delete('statuses/:statusId')
  @HttpCode(204)
  async delete(@Param('statusId', UuidParamPipe) statusId: string): Promise<void> {
    await this.statuses.delete(statusId)
  }
}
