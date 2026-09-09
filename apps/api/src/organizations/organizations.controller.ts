import { ValidationError } from '@collega/application/common'
import {
  type CreateOrganizationResult,
  type OrganizationDetail,
  type OrganizationListResult,
  OrganizationService,
  type RegenerateInviteCodeResult,
} from '@collega/application/organizations'
import type {
  CreateUserResult,
  OrganizationMember,
  UserImportResult,
  UserListResult,
} from '@collega/application/users'
import { UserService } from '@collega/application/users'
import {
  ORGANIZATION_ADDRESS_MAX_LENGTH,
  ORGANIZATION_CITY_MAX_LENGTH,
  ORGANIZATION_CONTACT_NAME_MAX_LENGTH,
  ORGANIZATION_DESCRIPTION_MAX_LENGTH,
  ORGANIZATION_LOGO_URL_MAX_LENGTH,
  ORGANIZATION_PHONE_MAX_LENGTH,
  ORGANIZATION_STATE_MAX_LENGTH,
  ORGANIZATION_TITLE_MAX_LENGTH,
  ORGANIZATION_ZIP_MAX_LENGTH,
  type OrganizationProfile,
} from '@collega/domain/organizations'
import { parseUserImportCsv } from '@collega/infrastructure/integrations/csv'
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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { AuthGuard } from '../auth/auth.guard.js'
import {
  type FieldRules,
  requirePresent,
  validateFields,
} from '../common/errors/request-validation.error.js'
import { optional, queryBool } from '../common/request-values.js'
import { UuidParamPipe } from '../common/uuid-param.pipe.js'

/** The seven optional address/contact fields shared by create and update. */
type OrganizationProfileBody = {
  address?: string
  city?: string
  state?: string
  zip?: string
  phone?: string
  primaryContactFirstName?: string
  primaryContactLastName?: string
}

type CreateOrganizationBody = OrganizationProfileBody & {
  title?: string
  description?: string
  logoUrl?: string
}

type UpdateOrganizationBody = CreateOrganizationBody

/** `PUT /organizations/{id}/logo` - the image is resized client-side and sent as a data URI. */
type SetLogoBody = { thumbnailDataUri?: string; heightPx?: number }

type CreateUserBody = {
  firstName?: string
  lastName?: string
  email?: string
  role?: string
  initialPassword?: string
  status?: string
}

/**
 * The `[RequiredField]` / `[MaxLengthField]` set that `CreateOrganizationRequest` and
 * `UpdateOrganizationRequest` share - identical field for field on the .NET side.
 *
 * The domain enforces the same lengths (`packages/domain/src/organizations/organization.ts`) and
 * must keep doing so: that check is the invariant, this one is the contract. They are not
 * redundant. Only this one produces the model-binding envelope a DTO attribute produced, and the
 * domain's judges the trimmed value where `MaxLengthAttribute` judged the raw one.
 */
function organizationBodyRules(body: CreateOrganizationBody): Record<string, FieldRules> {
  return {
    title: { value: body.title, required: true, maxLength: ORGANIZATION_TITLE_MAX_LENGTH },
    description: {
      value: body.description,
      required: true,
      maxLength: ORGANIZATION_DESCRIPTION_MAX_LENGTH,
    },
    logoUrl: { value: body.logoUrl, maxLength: ORGANIZATION_LOGO_URL_MAX_LENGTH },
    address: { value: body.address, maxLength: ORGANIZATION_ADDRESS_MAX_LENGTH },
    city: { value: body.city, maxLength: ORGANIZATION_CITY_MAX_LENGTH },
    state: { value: body.state, maxLength: ORGANIZATION_STATE_MAX_LENGTH },
    zip: { value: body.zip, maxLength: ORGANIZATION_ZIP_MAX_LENGTH },
    phone: { value: body.phone, maxLength: ORGANIZATION_PHONE_MAX_LENGTH },
    primaryContactFirstName: {
      value: body.primaryContactFirstName,
      maxLength: ORGANIZATION_CONTACT_NAME_MAX_LENGTH,
    },
    primaryContactLastName: {
      value: body.primaryContactLastName,
      maxLength: ORGANIZATION_CONTACT_NAME_MAX_LENGTH,
    },
  }
}

function toProfile(body: OrganizationProfileBody): OrganizationProfile {
  return {
    address: optional(body.address),
    city: optional(body.city),
    state: optional(body.state),
    zip: optional(body.zip),
    phone: optional(body.phone),
    primaryContactFirstName: optional(body.primaryContactFirstName),
    primaryContactLastName: optional(body.primaryContactLastName),
  }
}

/**
 * Query strings arrive as strings or, for a repeated key, as an array. Anything that is not a
 * finite number becomes `null` so the Application layer applies its own default.
 *
 * **A KNOWN DIVERGENCE, deliberate.** ASP.NET did NOT bind an unparseable `int?` to null: the
 * value-conversion failure landed in ModelState and `[ApiController]` answered 400 through the
 * `InvalidModelStateResponseFactory` that `ProblemDetailsServiceCollectionExtensions` installs
 * (it replaces the factory, it does not suppress the filter). So `?page=abc` was a 400 there and
 * is a defaulted 200 here.
 *
 * Not corrected because the message text cannot be reproduced faithfully: it is ASP.NET's own
 * binding resource string, not one of the templates in `SPEC/30-Contracts.md`, and no fixture in
 * the corpus records one - so implementing the 400 means guessing the wording of the `errors`
 * entry, which is exactly the trap this comment used to be. Record a fixture against the frozen
 * .NET app first, then this becomes a two-line change.
 */
function optionalInt(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Organizations, plus the user endpoints that are scoped by an organization in the route rather
 * than by a user - list, members, create and CSV import. The .NET controller drew the line the
 * same way and the corpus recorded these paths, so moving them onto the users controller would
 * change routes the oracle pins.
 *
 * Authorization lives in the Application services throughout: a Site Admin sees the organization
 * list, an Org Admin does not, and `members` is open to any authenticated caller in scope because
 * a plain User has to be able to populate an assignee picker. None of that is decided here.
 */
@Controller('organizations')
@UseGuards(AuthGuard)
export class OrganizationsController {
  constructor(
    private readonly organizations: OrganizationService,
    private readonly users: UserService,
  ) {}

  /**
   * `isArchived` is a .NET `bool` rather than `bool?`, so an ABSENT value binds to `false` and the
   * list excludes archived organizations - see `queryBool` for the divergences that carries.
   */
  @Get()
  async list(@Query() query: Record<string, unknown>): Promise<OrganizationListResult> {
    return this.organizations.list({
      page: optionalInt(query.page),
      pageSize: optionalInt(query.pageSize),
      search: optional(query.search),
      includeArchived: queryBool(query.isArchived),
      sortBy: optional(query.sortBy),
      sortDirection: optional(query.sortDirection),
    })
  }

  @Post()
  @HttpCode(201)
  async create(@Body() body: CreateOrganizationBody): Promise<CreateOrganizationResult> {
    validateFields(organizationBodyRules(body))

    return this.organizations.create({
      title: body.title ?? '',
      description: body.description ?? '',
      logoUrl: optional(body.logoUrl),
      profile: toProfile(body),
    })
  }

  @Get(':organizationId')
  async getById(
    @Param('organizationId', UuidParamPipe) organizationId: string,
  ): Promise<OrganizationDetail> {
    return this.organizations.getById(organizationId)
  }

  @Put(':organizationId')
  async update(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Body() body: UpdateOrganizationBody,
  ): Promise<OrganizationDetail> {
    validateFields(organizationBodyRules(body))

    return this.organizations.update(organizationId, {
      title: body.title ?? '',
      description: body.description ?? '',
      logoUrl: optional(body.logoUrl),
      profile: toProfile(body),
    })
  }

  @Post(':organizationId/invite-code/regenerate')
  @HttpCode(200)
  async regenerateInviteCode(
    @Param('organizationId', UuidParamPipe) organizationId: string,
  ): Promise<RegenerateInviteCodeResult> {
    return this.organizations.regenerateInviteCode(organizationId)
  }

  /** Archive is a soft delete and answers 204, unlike the logo endpoints which return the detail. */
  @Post(':organizationId/archive')
  @HttpCode(204)
  async archive(@Param('organizationId', UuidParamPipe) organizationId: string): Promise<void> {
    await this.organizations.archive(organizationId)
  }

  @Put(':organizationId/logo')
  async setLogo(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Body() body: SetLogoBody,
  ): Promise<OrganizationDetail> {
    requirePresent({ thumbnailDataUri: body.thumbnailDataUri })

    return this.organizations.setLogo(organizationId, {
      thumbnailDataUri: body.thumbnailDataUri ?? null,
      // `heightPx` has no [RequiredField] on the .NET request, so an absent value bound to the
      // `int` default rather than failing validation.
      heightPx: typeof body.heightPx === 'number' ? body.heightPx : 0,
    })
  }

  @Delete(':organizationId/logo')
  async clearLogo(
    @Param('organizationId', UuidParamPipe) organizationId: string,
  ): Promise<OrganizationDetail> {
    return this.organizations.clearLogo(organizationId)
  }

  @Get(':organizationId/users')
  async listUsers(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<UserListResult> {
    return this.users.listByOrganization(organizationId, {
      page: optionalInt(query.page),
      pageSize: optionalInt(query.pageSize),
      search: optional(query.search),
      role: optional(query.role),
      status: optional(query.status),
      sortBy: optional(query.sortBy),
      sortDirection: optional(query.sortDirection),
    })
  }

  /** Id, name and email only - this is the assignee picker's source, not an admin listing. */
  @Get(':organizationId/members')
  async listMembers(
    @Param('organizationId', UuidParamPipe) organizationId: string,
  ): Promise<readonly OrganizationMember[]> {
    return this.users.listAssignableMembers(organizationId)
  }

  @Post(':organizationId/users')
  @HttpCode(201)
  async createUser(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @Body() body: CreateUserBody,
  ): Promise<CreateUserResult> {
    validateFields({
      firstName: { value: body.firstName, required: true, maxLength: 100 },
      lastName: { value: body.lastName, required: true, maxLength: 100 },
      email: { value: body.email, required: true, email: true },
      role: { value: body.role, required: true },
      initialPassword: { value: body.initialPassword, required: true },
    })

    return this.users.create(organizationId, {
      firstName: body.firstName ?? '',
      lastName: body.lastName ?? '',
      email: body.email ?? '',
      role: body.role ?? '',
      initialPassword: body.initialPassword ?? '',
      // Optional: absent means the service picks the default status rather than being told one.
      status: optional(body.status),
    })
  }

  /**
   * Bulk create from an uploaded CSV. Rows are rejected individually and reported in the response,
   * so a file with one bad row still imports the rest and answers 200 - only a missing or empty
   * file is a 400.
   *
   * User import is **direct**, deliberately: unlike idea import it does not require a View As
   * session (`SPEC/50-typescript-migration.md`, C2's note). That rule lives in the Application
   * layer, so nothing here enforces or bypasses it.
   */
  @Post(':organizationId/users/import')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('csvFile'))
  async importUsers(
    @Param('organizationId', UuidParamPipe) organizationId: string,
    @UploadedFile() csvFile: { buffer?: Buffer } | undefined,
  ): Promise<UserImportResult> {
    const buffer = csvFile?.buffer
    if (buffer === undefined || buffer.length === 0) {
      // The kernel error, not `RequestValidationError`: the .NET handler threw
      // `ValidationAppException` here rather than failing model binding, so this renders with a
      // `traceId` and no charset. The corpus has no fixture for a missing file, so the .NET
      // source is the only evidence of which of the two envelopes it produced.
      throw new ValidationError('One or more fields are invalid.', {
        csvFile: ['A CSV file is required.'],
      })
    }

    return this.users.import(organizationId, parseUserImportCsv(buffer.toString('utf8')))
  }
}
