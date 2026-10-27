// Group use cases (SPEC/contracts/groups.md, SPEC/20-feature-board-access-and-groups.md BAG-1).
// Reading is open to a Site Admin and to any member of the organization, because a board's access
// list names groups; writing is the organization's Org Admin only (a Site Admin acts through View As).

import { randomUUID } from 'node:crypto'
import { Role } from '@collega/domain/enums'
import {
  createGroup,
  type Group,
  GroupDomainError,
  setGroupMembers,
  updateGroup,
} from '@collega/domain/groups'
import type { User } from '@collega/domain/users'
import {
  type AuditEventWriter,
  attributeAudit,
  type Clock,
  type CurrentUserContext,
  ensureNotDirectSiteAdmin,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  type UnitOfWork,
  ValidationError,
} from '../common/index.js'
import type {
  CreateGroupCommand,
  GroupDetail,
  GroupListItem,
  GroupMemberModel,
  SetGroupMembersCommand,
  UpdateGroupCommand,
} from './models.js'
import type { GroupMemberLookup, GroupRepository, OrganizationExistenceLookup } from './ports.js'

const INVALID = 'One or more fields are invalid.'

export class GroupService {
  constructor(
    private readonly groups: GroupRepository,
    private readonly users: GroupMemberLookup,
    private readonly organizations: OrganizationExistenceLookup,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditEvents: AuditEventWriter,
    private readonly currentUser: CurrentUserContext,
    private readonly clock: Clock,
  ) {}

  async list(organizationId: string): Promise<readonly GroupListItem[]> {
    this.ensureReadScope(organizationId)
    await this.ensureOrganizationExists(organizationId)

    return [...(await this.groups.listByOrganization(organizationId))]
      .sort(
        (a, b) =>
          a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.id.localeCompare(b.id),
      )
      .map((group) => ({
        groupId: group.id,
        organizationId: group.organizationId,
        name: group.name,
        description: group.description,
        memberCount: group.memberUserIds.length,
      }))
  }

  async getById(groupId: string): Promise<GroupDetail> {
    const group = await this.requireReadableGroup(groupId)
    return this.toDetail(group)
  }

  async create(organizationId: string, command: CreateGroupCommand): Promise<GroupDetail> {
    this.ensureAdminScope(organizationId)
    await this.ensureOrganizationExists(organizationId)
    await this.ensureNameAvailable(organizationId, command.name, null)
    await this.ensureMembersOfOrganization(organizationId, command.userIds)

    const now = this.clock.now()
    const group = runDomain(createGroup, {
      id: randomUUID(),
      organizationId,
      name: command.name,
      description: command.description,
      memberUserIds: command.userIds,
      nowUtc: now,
      actorUserId: this.currentUser.userId,
    })

    await this.groups.add(group)
    await this.unitOfWork.saveChanges()
    await this.audit('GroupCreated', group, `Group '${group.name}' created.`, now, {
      name: group.name,
      userIds: group.memberUserIds,
    })

    return this.toDetail(group)
  }

  async update(groupId: string, command: UpdateGroupCommand): Promise<GroupDetail> {
    const existing = await this.requireManageableGroup(groupId)
    await this.ensureNameAvailable(existing.organizationId, command.name, existing.id)

    const now = this.clock.now()
    const group = runDomain(
      updateGroup,
      existing,
      {
        name: command.name,
        description: command.description === undefined ? existing.description : command.description,
      },
      now,
      this.currentUser.userId,
    )

    await this.groups.save(group)
    await this.unitOfWork.saveChanges()
    await this.audit('GroupUpdated', group, `Group '${group.name}' updated.`, now, {
      name: { from: existing.name, to: group.name },
      description: { from: existing.description, to: group.description },
    })

    return this.toDetail(group)
  }

  /** Replaces the whole membership. Takes effect on each member's next request; no board is written. */
  async setMembers(groupId: string, command: SetGroupMembersCommand): Promise<GroupDetail> {
    const existing = await this.requireManageableGroup(groupId)
    await this.ensureMembersOfOrganization(existing.organizationId, command.userIds)

    const now = this.clock.now()
    const group = runDomain(
      setGroupMembers,
      existing,
      command.userIds,
      now,
      this.currentUser.userId,
    )

    const before = new Set(existing.memberUserIds)
    const after = new Set(group.memberUserIds)
    const addedUserIds = group.memberUserIds.filter((id) => !before.has(id))
    const removedUserIds = existing.memberUserIds.filter((id) => !after.has(id))
    if (addedUserIds.length === 0 && removedUserIds.length === 0) {
      return this.toDetail(existing)
    }

    await this.groups.save(group)
    await this.unitOfWork.saveChanges()
    await this.audit(
      'GroupMembersChanged',
      group,
      `Group '${group.name}' members changed (${group.memberUserIds.length}).`,
      now,
      { addedUserIds, removedUserIds },
    )

    return this.toDetail(group)
  }

  async delete(groupId: string): Promise<void> {
    const existing = await this.requireManageableGroup(groupId)

    await this.groups.delete(existing.id)
    await this.unitOfWork.saveChanges()
    await this.audit(
      'GroupDeleted',
      existing,
      `Group '${existing.name}' deleted.`,
      this.clock.now(),
      {
        name: existing.name,
        userIds: existing.memberUserIds,
      },
    )
  }

  private async requireReadableGroup(groupId: string): Promise<Group> {
    const group = await this.groups.getById(groupId)
    if (group === null || !this.canRead(group.organizationId)) {
      throw new NotFoundError('Group not found.')
    }
    return group
  }

  private async requireManageableGroup(groupId: string): Promise<Group> {
    const group = await this.requireReadableGroup(groupId)
    this.ensureAdminScope(group.organizationId)
    return group
  }

  private async toDetail(group: Group): Promise<GroupDetail> {
    const members = [...(await this.users.listByIds(group.memberUserIds))]
      .sort(
        (a, b) =>
          a.lastName.toLowerCase().localeCompare(b.lastName.toLowerCase()) ||
          a.firstName.toLowerCase().localeCompare(b.firstName.toLowerCase()) ||
          a.id.localeCompare(b.id),
      )
      .map(toMemberModel)
    return {
      groupId: group.id,
      organizationId: group.organizationId,
      name: group.name,
      description: group.description,
      members,
      canManage: this.canManage(group.organizationId),
    }
  }

  private async ensureNameAvailable(
    organizationId: string,
    name: string,
    excludeId: string | null,
  ): Promise<void> {
    if (!name || name.trim().length === 0) {
      // Let the domain produce the canonical "Group name is required." message.
      return
    }
    if (await this.groups.existsByName(organizationId, name, excludeId)) {
      throw new ValidationError(INVALID, { name: ['A group with this name already exists.'] })
    }
  }

  private async ensureMembersOfOrganization(
    organizationId: string,
    userIds: readonly string[],
  ): Promise<void> {
    if (new Set(userIds).size !== userIds.length) {
      throw new ValidationError(INVALID, { userIds: ['A user can be named only once.'] })
    }
    const found = new Set(
      (await this.users.listByIds(userIds))
        .filter((user) => user.organizationId === organizationId)
        .map((user) => user.id),
    )
    const missing = userIds.find((id) => !found.has(id))
    if (missing !== undefined) {
      throw new ValidationError(INVALID, { userIds: [`User '${missing}' was not found.`] })
    }
  }

  private async ensureOrganizationExists(organizationId: string): Promise<void> {
    if (!(await this.organizations.existsById(organizationId))) {
      throw new NotFoundError('Organization not found.')
    }
  }

  /** Site Admin (any org) or a member of the organization (any role). */
  private canRead(organizationId: string): boolean {
    const role = this.requireAuthenticatedRole()
    return role === Role.SiteAdmin || this.currentUser.organizationId === organizationId
  }

  private canManage(organizationId: string): boolean {
    return (
      this.currentUser.role === Role.OrgAdmin && this.currentUser.organizationId === organizationId
    )
  }

  private ensureReadScope(organizationId: string): void {
    if (!this.canRead(organizationId)) {
      throw new NotFoundError('Organization not found.')
    }
  }

  /** Only the Org Admin of the organization may write; anyone else outside it gets `404`. */
  private ensureAdminScope(organizationId: string): void {
    const role = this.requireAuthenticatedRole()
    ensureNotDirectSiteAdmin(this.currentUser)
    if (this.currentUser.organizationId !== organizationId) {
      throw new NotFoundError('Organization not found.')
    }
    if (role !== Role.OrgAdmin) {
      throw new ForbiddenError('You are not allowed to manage groups in this organization.')
    }
  }

  private requireAuthenticatedRole(): Role {
    if (!this.currentUser.isAuthenticated || this.currentUser.role === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }
    return this.currentUser.role
  }

  private async audit(
    eventType: string,
    group: Group,
    message: string,
    occurredAtUtc: Date,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    // Rule 14: while acting as someone, the real administrator is the actor.
    const attribution = attributeAudit(this.currentUser, this.currentUser.userId)
    await this.auditEvents.write({
      eventType,
      entityType: 'Group',
      message,
      occurredAtUtc,
      organizationId: group.organizationId,
      attribution,
      entityId: group.id,
      metadataJson: JSON.stringify(metadata),
    })
  }
}

function toMemberModel(user: User): GroupMemberModel {
  return {
    userId: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    status: user.status,
  }
}

/** A `GroupDomainError` surfaces as a field-keyed `400` rather than a 500. */
function runDomain<Args extends readonly unknown[], T>(fn: (...args: Args) => T, ...args: Args): T {
  try {
    return fn(...args)
  } catch (error) {
    if (error instanceof GroupDomainError) {
      throw new ValidationError(INVALID, { [error.field]: [error.message] })
    }
    throw error
  }
}
