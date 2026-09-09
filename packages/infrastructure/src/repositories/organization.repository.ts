// Satisfies `OrganizationRepository` (organizations/ports.ts), and structurally also
// `ImpersonationOrganizationsPort` (impersonation/ports.ts: `getById` -> {id, title, isArchived},
// a subset of `Organization`) and `AiOrganizationRepository` (ai/ports.ts: `getById`/`update`,
// exact same method names/shapes) - one adapter for the `organizations` table satisfies all three
// feature ports that read or write it.
//
// `InviteCodeGenerator` does NOT live here - it originally did, as a small class alongside this
// repository, but C2 independently built the same adapter under
// `integrations/organizations/random-invite-code-generator.ts` (a defensible home too: it is
// pure `node:crypto` randomness, no Prisma). Removed from here rather than left as a second,
// competing implementation of the same port - C2's is the one Wave D should wire up.

import type { AiOrganizationRepository } from '@collega/application/ai'
import type { ImpersonationOrganizationsPort } from '@collega/application/impersonation'
import type {
  OrganizationListFilter,
  OrganizationPage,
  OrganizationRepository,
} from '@collega/application/organizations'
import type { Organization } from '@collega/domain/organizations'
import type { organizations as OrganizationRow, Prisma } from '../generated/prisma/index.js'
import type { PrismaClient } from '../persistence/prisma-client.js'
import type { PrismaUnitOfWork } from '../persistence/unit-of-work.js'

function organizationFromRow(row: OrganizationRow): Organization {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    inviteCode: row.invite_code,
    isArchived: row.is_archived,
    logoUrl: row.logo_url,
    logoThumbnailUrl: row.logo_thumbnail_url,
    logoHeightPx: row.logo_height_px,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    phone: row.phone,
    primaryContactFirstName: row.primary_contact_first_name,
    primaryContactLastName: row.primary_contact_last_name,
    aiScopeStatement: row.ai_scope_statement,
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
  }
}

function toWriteData(organization: Organization): Prisma.organizationsUncheckedCreateInput {
  return {
    id: organization.id,
    title: organization.title,
    description: organization.description,
    invite_code: organization.inviteCode,
    is_archived: organization.isArchived,
    logo_url: organization.logoUrl,
    logo_thumbnail_url: organization.logoThumbnailUrl,
    logo_height_px: organization.logoHeightPx,
    address: organization.address,
    city: organization.city,
    state: organization.state,
    zip: organization.zip,
    phone: organization.phone,
    primary_contact_first_name: organization.primaryContactFirstName,
    primary_contact_last_name: organization.primaryContactLastName,
    ai_scope_statement: organization.aiScopeStatement,
    created_at_utc: organization.createdAtUtc,
    updated_at_utc: organization.updatedAtUtc,
    created_by_user_id: organization.createdByUserId,
    updated_by_user_id: organization.updatedByUserId,
  }
}

export class PrismaOrganizationRepository
  implements OrganizationRepository, ImpersonationOrganizationsPort, AiOrganizationRepository
{
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork,
  ) {}

  async getById(organizationId: string): Promise<Organization | null> {
    const row = await this.prisma.organizations.findUnique({ where: { id: organizationId } })
    return row ? organizationFromRow(row) : null
  }

  async getByInviteCode(inviteCode: string): Promise<Organization | null> {
    const row = await this.prisma.organizations.findFirst({ where: { invite_code: inviteCode } })
    return row ? organizationFromRow(row) : null
  }

  async inviteCodeExists(inviteCode: string): Promise<boolean> {
    const found = await this.prisma.organizations.findFirst({
      where: { invite_code: inviteCode },
      select: { id: true },
    })
    return found !== null
  }

  async list(filter: OrganizationListFilter): Promise<OrganizationPage> {
    // `createdAt` is the OPT-IN and company name the default, matching the switch in
    // `EfOrganizationRepository`. Both the field and the direction are matched on the trimmed,
    // lowercased value, as `SortBy?.Trim().ToLowerInvariant()` and `SortDirection.IsDescending`
    // did - so `?sortBy=CreatedAt&sortDirection=DESC` sorts the way it reads.
    const sortBy =
      (filter.sortBy ?? '').trim().toLowerCase() === 'createdat' ? 'createdAt' : 'companyName'
    const direction = (filter.sortDirection ?? '').trim().toLowerCase() === 'desc' ? 'desc' : 'asc'

    // Explicit scope, not a global filter (SPEC/decisions.md: the .NET has no EF global query
    // filters). Archived organizations are excluded unless the caller asks for them.
    const where: Prisma.organizationsWhereInput = {
      ...(filter.includeArchived ? {} : { is_archived: false }),
      ...(filter.search
        ? {
            OR: [
              { title: { contains: filter.search, mode: 'insensitive' } },
              { description: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    // TOTAL ORDER: tie-broken on the other meaningful column, never on id.
    const orderBy: Prisma.organizationsOrderByWithRelationInput[] =
      sortBy === 'companyName'
        ? [{ title: direction }, { created_at_utc: 'asc' }]
        : [{ created_at_utc: direction }, { title: 'asc' }]

    const [rows, totalCount] = await Promise.all([
      this.prisma.organizations.findMany({
        where,
        orderBy,
        skip: (filter.page.page - 1) * filter.page.pageSize,
        take: filter.page.pageSize,
      }),
      this.prisma.organizations.count({ where }),
    ])

    return {
      items: rows.map(organizationFromRow),
      page: filter.page.page,
      pageSize: filter.page.pageSize,
      totalCount,
      // The REQUESTED sort field, not the resolved one: `EfOrganizationRepository` passed
      // `filter.SortBy` straight into `PagedResult`, so a caller who sent nothing got `null` back
      // rather than the default the query actually used.
      sortBy: filter.sortBy,
      sortDirection: direction,
    }
  }

  async add(organization: Organization): Promise<void> {
    this.unitOfWork.enqueue(this.prisma.organizations.create({ data: toWriteData(organization) }))
  }

  async update(organization: Organization): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.organizations.update({
        where: { id: organization.id },
        data: toWriteData(organization),
      }),
    )
  }
}
