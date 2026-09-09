// Satisfies `UserRepository` (users/ports.ts). One `users`-table adapter also structurally
// satisfies, via extra methods and User being a superset of each narrower projection:
// - `ImpersonationUsersPort` (impersonation/ports.ts: `getById`/`searchForImpersonation`, same
//   names/signatures, `ImpersonationUserSummary` is a subset of `User`)
// - `ideas.UsersPort` / `comments.UsersPort` (`findByNormalizedEmail`, `listByIds`)
// - `AiUsersPort` (`getDisplayNames`) and `AiMembersPort` (`listActiveDisplayNames`)
// "Prefer one adapter per entity" (the brief) - `users` is one entity, so this is one class.

import type { AiMembersPort, AiUsersPort } from '@collega/application/ai'
import type { UsersPort as CommentsUsersPort } from '@collega/application/comments'
import type { UsersPort as IdeasUsersPort } from '@collega/application/ideas'
import type { ImpersonationUsersPort } from '@collega/application/impersonation'
import type { UserListFilter, UserPage, UserRepository } from '@collega/application/users'
import { Role, UserStatus } from '@collega/domain/enums'
import type { User } from '@collega/domain/users'
import type { Prisma, users as UserRow } from '../generated/prisma/index.js'
import type { PrismaClient } from '../persistence/prisma-client.js'
import type { PrismaUnitOfWork } from '../persistence/unit-of-work.js'

function fromRow(row: UserRow): User {
  return {
    id: row.id,
    organizationId: row.organization_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    normalizedEmail: row.normalized_email,
    passwordHash: row.password_hash,
    role: row.role as Role,
    status: row.status as UserStatus,
    mustChangePassword: row.must_change_password,
    failedLoginCount: row.failed_login_count,
    lockoutWindowStartUtc: row.lockout_window_start_utc,
    lockedUntilUtc: row.locked_until_utc,
    temporaryPasswordExpiresAtUtc: row.temporary_password_expires_at_utc,
    portraitPng: row.portrait_png ? new Uint8Array(row.portrait_png) : null,
    securityStamp: row.security_stamp,
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
  }
}

function toWriteData(user: User): Prisma.usersUncheckedCreateInput {
  return {
    id: user.id,
    organization_id: user.organizationId,
    first_name: user.firstName,
    last_name: user.lastName,
    email: user.email,
    normalized_email: user.normalizedEmail,
    password_hash: user.passwordHash,
    role: user.role,
    status: user.status,
    must_change_password: user.mustChangePassword,
    failed_login_count: user.failedLoginCount,
    lockout_window_start_utc: user.lockoutWindowStartUtc,
    locked_until_utc: user.lockedUntilUtc,
    temporary_password_expires_at_utc: user.temporaryPasswordExpiresAtUtc,
    portrait_png: user.portraitPng ? Buffer.from(user.portraitPng) : null,
    security_stamp: user.securityStamp,
    created_at_utc: user.createdAtUtc,
    updated_at_utc: user.updatedAtUtc,
    created_by_user_id: user.createdByUserId,
    updated_by_user_id: user.updatedByUserId,
  }
}

export class PrismaUserRepository
  implements
    UserRepository,
    ImpersonationUsersPort,
    IdeasUsersPort,
    CommentsUsersPort,
    AiUsersPort,
    AiMembersPort
{
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork,
  ) {}

  async getById(userId: string): Promise<User | null> {
    const row = await this.prisma.users.findUnique({ where: { id: userId } })
    return row ? fromRow(row) : null
  }

  async getByNormalizedEmail(normalizedEmail: string): Promise<User | null> {
    const row = await this.prisma.users.findUnique({ where: { normalized_email: normalizedEmail } })
    return row ? fromRow(row) : null
  }

  /** `ideas.UsersPort` / `comments.UsersPort` mention-resolution lookup - same query as
   * `getByNormalizedEmail`, different name to match each port's declared shape. */
  async findByNormalizedEmail(normalizedEmail: string): Promise<User | null> {
    return this.getByNormalizedEmail(normalizedEmail)
  }

  async existsByNormalizedEmail(normalizedEmail: string): Promise<boolean> {
    const found = await this.prisma.users.findUnique({
      where: { normalized_email: normalizedEmail },
      select: { id: true },
    })
    return found !== null
  }

  async anySiteAdmin(): Promise<boolean> {
    const found = await this.prisma.users.findFirst({
      where: { role: Role.SiteAdmin },
      select: { id: true },
    })
    return found !== null
  }

  async listByOrganization(filter: UserListFilter): Promise<UserPage> {
    const sortBy =
      filter.sortBy === 'email' || filter.sortBy === 'createdAt' ? filter.sortBy : 'lastName'
    const direction = filter.sortDirection === 'desc' ? 'desc' : 'asc'

    const where: Prisma.usersWhereInput = {
      organization_id: filter.organizationId,
      ...(filter.role ? { role: filter.role } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.search
        ? {
            OR: [
              { first_name: { contains: filter.search, mode: 'insensitive' } },
              { last_name: { contains: filter.search, mode: 'insensitive' } },
              { email: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    // TOTAL ORDER: every branch tie-breaks on email, which is globally unique - never on id.
    const orderBy: Prisma.usersOrderByWithRelationInput[] =
      sortBy === 'email'
        ? [{ email: direction }]
        : sortBy === 'createdAt'
          ? [{ created_at_utc: direction }, { email: 'asc' }]
          : [{ last_name: direction }, { first_name: direction }, { email: 'asc' }]

    const [rows, totalCount] = await Promise.all([
      this.prisma.users.findMany({
        where,
        orderBy,
        skip: (filter.page.page - 1) * filter.page.pageSize,
        take: filter.page.pageSize,
      }),
      this.prisma.users.count({ where }),
    ])

    return {
      items: rows.map(fromRow),
      page: filter.page.page,
      pageSize: filter.page.pageSize,
      totalCount,
      // The REQUESTED sort field, not the resolved one - see the organization repository's note;
      // `EfUserRepository` echoed `filter.SortBy` the same way.
      sortBy: filter.sortBy,
      sortDirection: direction,
    }
  }

  async listByIds(userIds: readonly string[]): Promise<readonly User[]> {
    if (userIds.length === 0) {
      return []
    }
    const rows = await this.prisma.users.findMany({ where: { id: { in: [...userIds] } } })
    return rows.map(fromRow)
  }

  async searchForImpersonation(
    organizationId: string | null,
    search: string | null,
  ): Promise<readonly User[]> {
    const where: Prisma.usersWhereInput = {
      // Explicit scope: null means "every organization" (a Site Admin's picker), matching the
      // port's own contract rather than an implicit/global filter.
      ...(organizationId !== null ? { organization_id: organizationId } : {}),
      ...(search
        ? {
            OR: [
              { first_name: { contains: search, mode: 'insensitive' } },
              { last_name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }
    const rows = await this.prisma.users.findMany({
      where,
      orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }, { email: 'asc' }],
      take: 50,
    })
    return rows.map(fromRow)
  }

  async countActiveOrgAdmins(
    organizationId: string,
    excludingUserId?: string | null,
  ): Promise<number> {
    return this.prisma.users.count({
      where: {
        organization_id: organizationId,
        role: Role.OrgAdmin,
        status: UserStatus.Active,
        ...(excludingUserId ? { id: { not: excludingUserId } } : {}),
      },
    })
  }

  async add(user: User): Promise<void> {
    this.unitOfWork.enqueue(this.prisma.users.create({ data: toWriteData(user) }))
  }

  async update(user: User): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.users.update({ where: { id: user.id }, data: toWriteData(user) }),
    )
  }

  /** `AiUsersPort.getDisplayNames` - id -> "First Last", omitting ids with no user found. */
  async getDisplayNames(userIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
    if (userIds.length === 0) {
      return new Map()
    }
    const rows = await this.prisma.users.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, first_name: true, last_name: true },
    })
    return new Map(rows.map((r) => [r.id, `${r.first_name} ${r.last_name}`]))
  }

  /** `AiMembersPort.listActiveDisplayNames` - vocabulary only, capped by the caller. */
  async listActiveDisplayNames(organizationId: string, limit: number): Promise<readonly string[]> {
    const rows = await this.prisma.users.findMany({
      where: { organization_id: organizationId, status: UserStatus.Active },
      select: { first_name: true, last_name: true },
      orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }],
      take: limit,
    })
    return rows.map((r) => `${r.first_name} ${r.last_name}`)
  }
}
