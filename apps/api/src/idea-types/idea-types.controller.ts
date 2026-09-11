import {
  type IdeaTypeFieldSelectionInput,
  type IdeaTypeItem,
  IdeaTypeService,
} from '@collega/application/idea-fields'
import {
  IDEA_TYPE_COLOR_HEX_LENGTH,
  IDEA_TYPE_ICON_MAX_LENGTH,
  IDEA_TYPE_NAME_MAX_LENGTH,
} from '@collega/domain/idea-fields'
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
import { guidOrEmpty, optional, optionalInt32, queryBool } from '../common/request-values.js'
import { UuidParamPipe } from '../common/uuid-param.pipe.js'

type CreateIdeaTypeBody = {
  name?: string
  sortOrder?: unknown
}

type UpdateIdeaTypeBody = CreateIdeaTypeBody

type ReorderIdeaTypesBody = { orderedIdeaTypeIds?: unknown }

type IdeaTypeFieldSelectionBody = {
  fieldDefinitionId?: unknown
  displayOrder?: unknown
  isRequired?: unknown
}

type SetIdeaTypeFieldsBody = { fields?: unknown }

type SetIdeaTypeAppearanceBody = {
  colorHex?: unknown
  icon?: unknown
}

/**
 * The attribute set `CreateIdeaTypeRequest` and `UpdateIdeaTypeRequest` share - identical field
 * for field. `SortOrder` is a bare `int?` and carries none.
 */
function ideaTypeBodyRules(body: CreateIdeaTypeBody): Record<string, FieldRules> {
  return {
    name: { value: body.name, required: true, maxLength: IDEA_TYPE_NAME_MAX_LENGTH },
  }
}

/**
 * `[RequiredField]` on `ReorderIdeaTypesRequest.OrderedIdeaTypeIds`, a `List<Guid>` initialised to
 * `new()` - the same two-envelope split `statuses.controller.ts` documents at length for
 * `requireOrderedStatusIds`, and for the same reason: `RequiredAttribute` fails on NULL ONLY.
 *
 * `{}` left the initialiser in place and arrived as an EMPTY LIST that passed validation, so it
 * was refused later by `IdeaTypeService.reorder`'s coverage check (the Application envelope).
 * `{"orderedIdeaTypeIds": null}` overwrote the initialiser and failed here instead (the model-
 * binding envelope). `validateFields` judges a non-string as `''` and cannot tell the two apart.
 */
function requireOrderedIdeaTypeIds(body: ReorderIdeaTypesBody): readonly string[] {
  if (body.orderedIdeaTypeIds === null) {
    throw new RequestValidationError({
      orderedIdeaTypeIds: ['Ordered Idea Type Ids is required.'],
    })
  }
  if (!Array.isArray(body.orderedIdeaTypeIds)) {
    return []
  }
  // A non-GUID member cannot match an active option id, so the coverage check refuses the request
  // - which is what a non-Guid member did on the .NET side too, one binding envelope earlier.
  return body.orderedIdeaTypeIds.map(guidOrEmpty)
}

/**
 * `SetIdeaTypeFieldsRequest.Fields` carries NO `[RequiredField]`, and the .NET action itself wrote
 * `request.Fields ?? new List<...>()` - so an omitted key, an explicit `null` and `[]` are all the
 * same request, and all three clear the type back to `AllActiveFields`.
 *
 * Nothing inside an item can be a boundary failure either. `FieldDefinitionId` is a non-nullable
 * `Guid` whose `[RequiredField]` is a no-op (see `guidOrEmpty`); `DisplayOrder` is a bare `int`
 * and `IsRequired` a bare `bool`, both of which bound to their default for an absent key.
 */
function fieldSelection(body: SetIdeaTypeFieldsBody): readonly IdeaTypeFieldSelectionInput[] {
  if (!Array.isArray(body.fields)) {
    return []
  }
  return body.fields.map((entry: IdeaTypeFieldSelectionBody) => ({
    fieldDefinitionId: guidOrEmpty(entry?.fieldDefinitionId),
    displayOrder: optionalInt32(entry?.displayOrder) ?? 0,
    isRequired: entry?.isRequired === true,
  }))
}

/**
 * Idea Type option administration (SPEC/30-Contracts.md "Idea Field Option Contracts").
 *
 * `@Controller()` carries no prefix on purpose - see `boards.controller.ts` for the reasoning.
 * List, create, reorder, field selection and appearance hang off `organizations/{id}/idea-types`;
 * update and soft-delete hang off `idea-types/{id}`.
 *
 * Authorization lives in `IdeaTypeService`: the catalog is readable by any member of the
 * organization because every idea form needs it, while every mutation is Org Admin only. The
 * one-active-option floor, the name uniqueness rule and the field-selection checks are its rules
 * too.
 */
@Controller()
@UseGuards(AuthGuard)
export class IdeaTypesController {
  constructor(private readonly ideaTypes: IdeaTypeService) {}

  /**
   * `includeDeleted` is a .NET `bool` rather than `bool?`, so an ABSENT value binds to `false` and
   * the list excludes archived options - see `queryBool` for what else that means.
   */
  @Get('organizations/:organizationId/idea-types')
  async list(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<readonly IdeaTypeItem[]> {
    return this.ideaTypes.list(organizationId, queryBool(query.includeDeleted))
  }

  @Post('organizations/:organizationId/idea-types')
  @HttpCode(201)
  async create(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Body() body: CreateIdeaTypeBody,
  ): Promise<IdeaTypeItem> {
    validateFields(ideaTypeBodyRules(body))

    return this.ideaTypes.create(organizationId, {
      name: body.name ?? '',
      sortOrder: optionalInt32(body.sortOrder),
    })
  }

  @Put('idea-types/:ideaTypeId')
  async update(
    @Param('ideaTypeId', UuidParamPipe) ideaTypeId: string,
    @Body() body: UpdateIdeaTypeBody,
  ): Promise<IdeaTypeItem> {
    validateFields(ideaTypeBodyRules(body))

    return this.ideaTypes.update(ideaTypeId, {
      name: body.name ?? '',
      sortOrder: optionalInt32(body.sortOrder),
    })
  }

  /** Replaces the complete active-option order atomically; answers 204, like the .NET action. */
  @Post('organizations/:organizationId/idea-types/reorder')
  @HttpCode(204)
  async reorder(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Body() body: ReorderIdeaTypesBody,
  ): Promise<void> {
    await this.ideaTypes.reorder(organizationId, requireOrderedIdeaTypeIds(body))
  }

  /**
   * Replaces the type's User-Defined Field selection. A non-empty list switches it to `Curated`;
   * an empty list clears it back to `AllActiveFields`.
   */
  @Put('organizations/:organizationId/idea-types/:ideaTypeId/fields')
  @HttpCode(204)
  async setFields(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Param('ideaTypeId', UuidParamPipe) ideaTypeId: string,
    @Body() body: SetIdeaTypeFieldsBody,
  ): Promise<void> {
    await this.ideaTypes.setFieldSelection(organizationId, ideaTypeId, fieldSelection(body))
  }

  /**
   * Sets or clears the badge appearance. Both properties are `string?` with `[MaxLengthField]` and
   * no `[RequiredField]`, so an absent or null value passes the boundary and clears that half of
   * the badge - `MaxLengthAttribute.IsValid(null)` returns true, and `validateFields` reaches the
   * same answer by judging a non-string as `''`. The `#RRGGBB` shape is the domain's rule, not
   * this one's, and produces the Application envelope.
   *
   * That claim is true HERE and was not true of the status and business-impact colours, which is
   * why those two now carry a `hexColor` rule and this does not: `setIdeaTypeAppearance` really
   * does test `/^#[0-9a-fA-F]{6}$/`, and `IDEA_TYPE_COLOR_HEX_LENGTH` is 7 - too short to hold
   * even `url(//a)`. Adding a second, looser copy of the rule at the boundary would introduce an
   * inconsistency rather than remove one.
   */
  @Put('organizations/:organizationId/idea-types/:ideaTypeId/appearance')
  @HttpCode(204)
  async setAppearance(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Param('ideaTypeId', UuidParamPipe) ideaTypeId: string,
    @Body() body: SetIdeaTypeAppearanceBody,
  ): Promise<void> {
    validateFields({
      colorHex: { value: body.colorHex, maxLength: IDEA_TYPE_COLOR_HEX_LENGTH },
      icon: { value: body.icon, maxLength: IDEA_TYPE_ICON_MAX_LENGTH },
    })

    await this.ideaTypes.setAppearance(
      organizationId,
      ideaTypeId,
      optional(body.colorHex),
      optional(body.icon),
    )
  }

  /** Soft delete: existing idea references keep resolving, so this is not a row removal. */
  @Delete('idea-types/:ideaTypeId')
  @HttpCode(204)
  async delete(@Param('ideaTypeId', UuidParamPipe) ideaTypeId: string): Promise<void> {
    await this.ideaTypes.delete(ideaTypeId)
  }
}
