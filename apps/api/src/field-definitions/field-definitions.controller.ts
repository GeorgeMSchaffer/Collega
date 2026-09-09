import {
  type FieldDefinitionModel,
  FieldDefinitionService,
  type FieldOptionCommand,
} from '@collega/application/fields'
import {
  FIELD_DESCRIPTION_MAX_LENGTH,
  FIELD_NAME_MAX_LENGTH,
  FIELD_OPTION_LABEL_MAX_LENGTH,
} from '@collega/domain/fields'
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
import {
  guidOrEmpty,
  isGuid,
  optional,
  optionalInt32,
  queryBool,
} from '../common/request-values.js'
import { UuidParamPipe } from '../common/uuid-param.pipe.js'

type FieldOptionBody = {
  optionId?: unknown
  label?: unknown
  displayOrder?: unknown
}

type CreateFieldDefinitionBody = {
  name?: string
  description?: unknown
  fieldType?: string
  isRequired?: unknown
  displayOrder?: unknown
  options?: unknown
}

type UpdateFieldDefinitionBody = CreateFieldDefinitionBody

type ReorderFieldDefinitionsBody = { orderedIds?: unknown }

/** `Options` on both request records, read as omitted when it is not a JSON array. */
function optionBodies(body: CreateFieldDefinitionBody): readonly FieldOptionBody[] {
  return Array.isArray(body.options) ? body.options : []
}

/**
 * The attribute set `CreateFieldDefinitionRequest` and `UpdateFieldDefinitionRequest` share -
 * identical field for field, including the nested `FieldOptionRequest` list. `IsRequired` (`bool`)
 * and `DisplayOrder` (`int?`) carry none, and `OptionId` is a `Guid?`.
 *
 * **The option keys are the one part of this not pinned by a fixture.** ASP.NET's
 * `ValidationVisitor` builds a nested key by index and then property - `options[0].label`, in
 * camelCase because `AddControllers` registers the System.Text.Json validation metadata provider
 * (which is also why the flat keys in the recorded 400s are camelCase). The MESSAGE text is
 * certain: `SpacedDisplayNameMetadataProvider` fed the attribute the property's own spaced name,
 * `Label`, not the path. Nothing in the corpus sends a bad option, so if a recording ever
 * contradicts the key shape, this is the line to change - not the messages.
 */
function fieldDefinitionBodyRules(body: CreateFieldDefinitionBody): Record<string, FieldRules> {
  const rules: Record<string, FieldRules> = {
    name: { value: body.name, required: true, maxLength: FIELD_NAME_MAX_LENGTH },
    description: { value: body.description, maxLength: FIELD_DESCRIPTION_MAX_LENGTH },
    // `[RequiredField]` only. The allowed-values check is `FieldDefinitionService.parseFieldType`'s,
    // and it answers with the Application envelope - which is where it answered on the .NET side
    // too, since `FieldType` is a plain `string` on the contract and carries no `[AllowedValues]`.
    fieldType: { value: body.fieldType, required: true },
  }
  for (const [index, option] of optionBodies(body).entries()) {
    rules[`options[${index}].label`] = {
      value: option?.label,
      required: true,
      maxLength: FIELD_OPTION_LABEL_MAX_LENGTH,
      displayName: 'Label',
    }
  }
  return rules
}

function optionCommands(body: CreateFieldDefinitionBody): readonly FieldOptionCommand[] {
  return optionBodies(body).map((option) => ({
    // `Guid?`: absent, null and anything that is not a canonical GUID all bind to null, and the
    // service mints a fresh id for each - which is what "this option is new" means on the wire.
    // The shape check is not optional: `id` reaches a `uuid` column with no guard between here and
    // Prisma, so passing raw text on raised `P2023` and answered **500** (`{"optionId":
    // "not-a-guid"}`, reproduced live). `null` rather than `EMPTY_GUID` because the all-zero GUID
    // is a real, collidable id, where null is exactly "this option is new".
    optionId: isGuid(option?.optionId) ? option.optionId.trim() : null,
    label: typeof option?.label === 'string' ? option.label : '',
    displayOrder: optionalInt32(option?.displayOrder) ?? 0,
  }))
}

/**
 * `[RequiredField]` on `ReorderFieldDefinitionsRequest.OrderedIds`, a `List<Guid>` initialised to
 * `new()` - the same two-envelope split `statuses.controller.ts` documents at length for
 * `requireOrderedStatusIds`: `RequiredAttribute` fails on NULL ONLY.
 *
 * The tail differs from the other two reorders, though, and only because the service does:
 * `FieldDefinitionService.reorder` has no coverage check - unknown ids and repeats are skipped and
 * the omitted actives are appended in their prior order - so `{}` is an accepted no-op renumber
 * there where it is a 400 on the option catalogs. That asymmetry is the .NET's, not this file's.
 */
function requireOrderedIds(body: ReorderFieldDefinitionsBody): readonly string[] {
  if (body.orderedIds === null) {
    throw new RequestValidationError({ orderedIds: ['Ordered Ids is required.'] })
  }
  if (!Array.isArray(body.orderedIds)) {
    return []
  }
  return body.orderedIds.map(guidOrEmpty)
}

/**
 * Organization User-Defined Field definitions (SPEC/20-feature-user-defined-fields.md
 * "API Endpoints"). Every route hangs off `organizations/{organizationId}/field-definitions`.
 *
 * **`reorder` is declared before `{id}` and must stay there.** Both are `PUT` on a three-segment
 * path, Nest registers handlers in declaration order, and `UuidParamPipe` would 404 the literal
 * `reorder` if `{id}` matched first. The .NET was immune - `{id:guid}` was a route CONSTRAINT, so
 * `reorder` never matched it whatever the declaration order - which is exactly why the ordering
 * has to be deliberate here.
 *
 * Authorization lives in `FieldDefinitionService`: any member may read the active schema because
 * every idea form needs it, while create/update/delete/reorder and `includeDeleted` are Org Admin
 * only. Field-type immutability, name uniqueness and the option rules are its (and the domain's).
 */
@Controller()
@UseGuards(AuthGuard)
export class FieldDefinitionsController {
  constructor(private readonly fieldDefinitions: FieldDefinitionService) {}

  /**
   * `includeDeleted` is a .NET `bool` rather than `bool?`, so an ABSENT value binds to `false`.
   * A non-admin asking for it is not refused - the service quietly narrows the answer to the
   * active schema, which is its rule, not this one's.
   */
  @Get('organizations/:organizationId/field-definitions')
  async list(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<readonly FieldDefinitionModel[]> {
    return this.fieldDefinitions.list(organizationId, queryBool(query.includeDeleted))
  }

  @Get('organizations/:organizationId/field-definitions/:id')
  async get(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Param('id', UuidParamPipe) id: string,
  ): Promise<FieldDefinitionModel> {
    return this.fieldDefinitions.getById(organizationId, id)
  }

  @Post('organizations/:organizationId/field-definitions')
  @HttpCode(201)
  async create(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Body() body: CreateFieldDefinitionBody,
  ): Promise<FieldDefinitionModel> {
    validateFields(fieldDefinitionBodyRules(body))

    return this.fieldDefinitions.create(organizationId, {
      name: body.name ?? '',
      description: optional(body.description),
      fieldType: body.fieldType ?? '',
      isRequired: body.isRequired === true,
      displayOrder: optionalInt32(body.displayOrder),
      options: optionCommands(body),
    })
  }

  /** Declared before `PUT .../{id}` on purpose - see the controller comment. Answers 204. */
  @Put('organizations/:organizationId/field-definitions/reorder')
  @HttpCode(204)
  async reorder(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Body() body: ReorderFieldDefinitionsBody,
  ): Promise<void> {
    await this.fieldDefinitions.reorder(organizationId, { orderedIds: requireOrderedIds(body) })
  }

  @Put('organizations/:organizationId/field-definitions/:id')
  async update(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Param('id', UuidParamPipe) id: string,
    @Body() body: UpdateFieldDefinitionBody,
  ): Promise<FieldDefinitionModel> {
    validateFields(fieldDefinitionBodyRules(body))

    return this.fieldDefinitions.update(organizationId, id, {
      name: body.name ?? '',
      description: optional(body.description),
      fieldType: body.fieldType ?? '',
      isRequired: body.isRequired === true,
      displayOrder: optionalInt32(body.displayOrder),
      options: optionCommands(body),
    })
  }

  /** Soft delete: existing idea field values keep resolving, so this is not a row removal. */
  @Delete('organizations/:organizationId/field-definitions/:id')
  @HttpCode(204)
  async delete(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Param('id', UuidParamPipe) id: string,
  ): Promise<void> {
    await this.fieldDefinitions.delete(organizationId, id)
  }
}
