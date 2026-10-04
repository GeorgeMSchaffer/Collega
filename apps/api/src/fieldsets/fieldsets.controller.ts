import { type FieldsetModel, FieldsetService } from '@collega/application/fieldsets'
import {
  FIELDSET_DESCRIPTION_MAX_LENGTH,
  FIELDSET_NAME_MAX_LENGTH,
} from '@collega/domain/fieldsets'
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard.js'
import {
  type FieldRules,
  RequestValidationError,
  validateFields,
} from '../common/errors/request-validation.error.js'
import { guidOrEmpty, optional, optionalInt32 } from '../common/request-values.js'
import { UuidParamPipe } from '../common/uuid-param.pipe.js'

type SaveFieldsetBody = {
  name?: string
  description?: unknown
  displayOrder?: unknown
}

type SetFieldsetFieldsBody = { fieldDefinitionIds?: unknown }

/** Create and update share one body (SPEC/contracts/fieldsets.md). */
function fieldsetBodyRules(body: SaveFieldsetBody): Record<string, FieldRules> {
  return {
    name: { value: body.name, required: true, maxLength: FIELDSET_NAME_MAX_LENGTH },
    description: { value: body.description, maxLength: FIELDSET_DESCRIPTION_MAX_LENGTH },
  }
}

/**
 * `fieldDefinitionIds` is required: absent, an explicit `null` and a non-array all answer the
 * request-shape `400`, because reading them as an empty list would silently empty the fieldset.
 * A member that is not a GUID becomes the empty GUID, which the service refuses as an unknown field.
 */
function requireFieldDefinitionIds(body: SetFieldsetFieldsBody): readonly string[] {
  if (!Array.isArray(body.fieldDefinitionIds)) {
    throw new RequestValidationError({
      fieldDefinitionIds: ['Field Definition Ids is required.'],
    })
  }
  return body.fieldDefinitionIds.map(guidOrEmpty)
}

/**
 * Organization fieldsets (SPEC/contracts/fieldsets.md). Every route hangs off
 * `organizations/{organizationId}/fieldsets`. Authorization, name uniqueness, membership checks and
 * the delete-while-attached refusal live in `FieldsetService`.
 */
@Controller()
@UseGuards(AuthGuard)
export class FieldsetsController {
  constructor(private readonly fieldsets: FieldsetService) {}

  @Get('organizations/:organizationId/fieldsets')
  async list(
    @Param('organizationId', UuidParamPipe) organizationId: string,
  ): Promise<readonly FieldsetModel[]> {
    return this.fieldsets.list(organizationId)
  }

  @Get('organizations/:organizationId/fieldsets/:id')
  async get(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Param('id', UuidParamPipe) id: string,
  ): Promise<FieldsetModel> {
    return this.fieldsets.getById(organizationId, id)
  }

  @Post('organizations/:organizationId/fieldsets')
  @HttpCode(201)
  async create(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Body() body: SaveFieldsetBody,
  ): Promise<FieldsetModel> {
    validateFields(fieldsetBodyRules(body))

    return this.fieldsets.create(organizationId, {
      name: body.name ?? '',
      description: optional(body.description),
      displayOrder: optionalInt32(body.displayOrder),
    })
  }

  @Put('organizations/:organizationId/fieldsets/:id')
  async update(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Param('id', UuidParamPipe) id: string,
    @Body() body: SaveFieldsetBody,
  ): Promise<FieldsetModel> {
    validateFields(fieldsetBodyRules(body))

    return this.fieldsets.update(organizationId, id, {
      name: body.name ?? '',
      description: optional(body.description),
      displayOrder: optionalInt32(body.displayOrder),
    })
  }

  /** Replaces the members and their order. */
  @Put('organizations/:organizationId/fieldsets/:id/fields')
  async setFields(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Param('id', UuidParamPipe) id: string,
    @Body() body: SetFieldsetFieldsBody,
  ): Promise<FieldsetModel> {
    return this.fieldsets.setFields(organizationId, id, {
      fieldDefinitionIds: requireFieldDefinitionIds(body),
    })
  }

  /** A hard delete, refused with `409` while any idea type has the fieldset attached. */
  @Delete('organizations/:organizationId/fieldsets/:id')
  @HttpCode(204)
  async delete(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Param('id', UuidParamPipe) id: string,
  ): Promise<void> {
    await this.fieldsets.delete(organizationId, id)
  }
}
