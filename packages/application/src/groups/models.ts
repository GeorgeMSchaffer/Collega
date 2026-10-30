// Wire-facing read models and commands for groups (SPEC/contracts/groups.md).

export type GroupListItem = {
  readonly groupId: string
  readonly organizationId: string
  readonly name: string
  readonly description: string | null
  readonly memberCount: number
  /** Restricted boards naming the group, counted only among boards the caller can see. */
  readonly boardCount: number
}

export type GroupBoardModel = {
  readonly boardId: string
  readonly name: string
  readonly isArchived: boolean
}

export type GroupMemberModel = {
  readonly userId: string
  readonly firstName: string
  readonly lastName: string
  readonly email: string
  readonly role: string
  readonly status: string
}

export type GroupDetail = {
  readonly groupId: string
  readonly organizationId: string
  readonly name: string
  readonly description: string | null
  readonly members: readonly GroupMemberModel[]
  /** Restricted boards naming the group that the caller can see, by name. */
  readonly boards: readonly GroupBoardModel[]
  readonly canManage: boolean
}

export type CreateGroupCommand = {
  readonly name: string
  readonly description: string | null
  readonly userIds: readonly string[]
}

/** `description` `undefined` leaves the stored description unchanged; `null` clears it. */
export type UpdateGroupCommand = {
  readonly name: string
  readonly description: string | null | undefined
}

export type SetGroupMembersCommand = {
  readonly userIds: readonly string[]
}
