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

/**
 * `Options` on both request records, read as omitted when it is not a JSON array.
 *
 * **A KNOWN DIVERGENCE, and the only one in this slice that makes a request SUCCEED where .NET
 * failed.** `Options` carries no `[RequiredField]` and the property is initialised to `new()`, so
 * System.Text.Json wrote an explicit `null` straight over the initialiser and
 * `FieldDefinitionsController.cs:62` and `:96` then called `request.Options.Select(...)` with no
 * `?? new()` guard - unlike `SetFields` at `:87`, which has one. So `{"options": null}`, and a
 * null ELEMENT, were a **500** there and are a 201 here. Kept: a `Text` field legitimately has no
 * options, and answering 500 to a request that asks for none is not worth reproducing.
 */
function optionBodies(body: CreateFieldDefinitionBody): readonly FieldOptionBody[] {
  return Array.isArray(body.options) ? body.options : []
}

/**
 * The attribute set `CreateFieldDefinitionRequest` and `UpdateFieldDefinitionRequest` share -
 * identical field for field, including the nested `FieldOptionRequest` list. `IsRequired` (`bool`)
 * and `DisplayOrder` (`int?`) carry none, and `OptionId` is a `Guid?`.
 *
 * **The nested option key is settled from source, not guessed.** ASP.NET's `ValidationVisitor`
 * keys a nested collection failure by index and then property - `Options[0].Label` - and
 * `ProblemDetailsServiceCollectionExtensions.CreateValidationProblemResult` rewrites every
 * ModelState key through `ToCamelCasePath` (`:66-90`), which splits on `.`, camelCases each
 * segment's property part and re-attaches the `[n]` suffix. Its own worked example is
 * `"Assignees[0].UserId" -> "assignees[0].userId"`, so `options[0].label` is what the wire
 * carried. The MESSAGE is separate and equally pinned: `SpacedDisplayNameMetadataProvider` fills
 * `DisplayName` from the property's own name alone, hence `"Label is required."` rather than the
 * path.
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

/**
 * `Options` -> the service's command list. `OptionId` is a `Guid?`, and its three states are three
 * different requests: ABSENT or `null` means "this option is new" and the service mints an id;
 * a canonical GUID means "update that option".
 *
 * A PRESENT BUT MALFORMED id is the third, and it is **refused**. It used to be read as the first,
 * so `{"optionId":"not-a-guid"}` answered **201 with a freshly minted id** - the caller asked to
 * update one specific option and silently got a different one created instead, with nothing in the
 * response to say so. Passing the raw text through is not the alternative: it reaches a `uuid`
 * column with no guard between here and Prisma, raises `P2023` and answers 500.
 *
 * **The message wording is ours, not transcribed.** .NET answered 400 here too - System.Text.Json
 * could not bind `"not-a-guid"` to a `Guid?` - but no fixture in the corpus records one, so there
 * is no recorded text to match. This follows the canonical "invalid format" template in
 * `SPEC/30-Contracts.md` "Validation Message Conventions" (`<FieldName> must be a valid
 * <FormatName>.`), with "GUID" as the format name that section's "Shared Data Rules" already uses
 * for identifiers.
 *
 * The KEY is settled from source rather than invented: `ToCamelCasePath`
 * (`src/Collega.API/ErrorHandling/ProblemDetailsServiceCollectionExtensions.cs:66-90`) camelCases
 * each segment and re-attaches the `[n]` suffix, so a nested failure keys as
 * `options[0].optionId` - the same shape as the `options[0].label` rule above.
 *
 * Every malformed id is collected rather than only the first, matching what ModelState did across
 * a collection.
 */
function optionCommands(body: CreateFieldDefinitionBody): readonly FieldOptionCommand[] {
  const options = optionBodies(body)
  const failures: Record<string, readonly string[]> = {}
  for (const [index, option] of options.entries()) {
    const optionId = option?.optionId
    if (optionId !== undefined && optionId !== null && !isGuid(optionId)) {
      failures[`options[${index}].optionId`] = ['Option Id must be a valid GUID.']
    }
  }
  if (Object.keys(failures).length > 0) {
    throw new RequestValidationError(failures)
  }

  return options.map((option) => ({
    // `null` rather than `EMPTY_GUID` because the all-zero GUID is a real, collidable id, where
    // null is exactly "this option is new".
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
