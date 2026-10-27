// Organization-owned user group: a named set of the organization's users (SPEC/contracts/groups.md).
// Its use is a Restricted board's access list, so membership is read at request time and a change
// here changes access on every board the group is on without touching any board.
//
// Plain immutable data plus transition functions, per `packages/domain/src/common`.

import { type Auditable, markCreated, markUpdated } from '../common/index.js'

export const GROUP_NAME_MAX_LENGTH = 100
export const GROUP_DESCRIPTION_MAX_LENGTH = 500

/** Keyed on the offending property so the application layer can raise a field-keyed `400`. */
export class GroupDomainError extends Error {
  readonly field: string

  constructor(field: string, message: string) {
    super(message)
    this.name = 'GroupDomainError'
    this.field = field
  }
}

export type Group = Auditable & {
  readonly id: string
  readonly organizationId: string
  readonly name: string
  /** Trimmed, lower-cased `name`; backs the unique `(organization_id, normalized_name)` index. */
  readonly normalizedName: string
  readonly description: string | null
  readonly memberUserIds: readonly string[]
}

export function normalizeGroupName(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase()
}

function validName(name: string): string {
  const trimmed = (name ?? '').trim()
  if (trimmed.length === 0) {
    throw new GroupDomainError('name', 'Group name is required.')
  }
  if (trimmed.length > GROUP_NAME_MAX_LENGTH) {
    throw new GroupDomainError(
      'name',
      `Group name must be ${GROUP_NAME_MAX_LENGTH} characters or fewer.`,
    )
  }
  return trimmed
}

function validDescription(description: string | null): string | null {
  const trimmed = (description ?? '').trim()
  if (trimmed.length === 0) {
    return null
  }
  if (trimmed.length > GROUP_DESCRIPTION_MAX_LENGTH) {
    throw new GroupDomainError(
      'description',
      `Description must be ${GROUP_DESCRIPTION_MAX_LENGTH} characters or fewer.`,
    )
  }
  return trimmed
}

/** Callers check that each member is a user of the organization; this checks only that none repeats. */
function validMembers(userIds: readonly string[]): readonly string[] {
  if (new Set(userIds).size !== userIds.length) {
    throw new GroupDomainError('userIds', 'A user can be named only once.')
  }
  return [...userIds]
}

export function createGroup(props: {
  readonly id: string
  readonly organizationId: string
  readonly name: string
  readonly description: string | null
  readonly memberUserIds: readonly string[]
  readonly nowUtc: Date
  readonly actorUserId: string | null
}): Group {
  const name = validName(props.name)
  return {
    id: props.id,
    organizationId: props.organizationId,
    name,
    normalizedName: normalizeGroupName(name),
    description: validDescription(props.description),
    memberUserIds: validMembers(props.memberUserIds),
    ...markCreated(props.nowUtc, props.actorUserId),
  }
}

export function updateGroup(
  group: Group,
  input: { readonly name: string; readonly description: string | null },
  nowUtc: Date,
  actorUserId: string | null,
): Group {
  const name = validName(input.name)
  return markUpdated(
    {
      ...group,
      name,
      normalizedName: normalizeGroupName(name),
      description: validDescription(input.description),
    },
    nowUtc,
    actorUserId,
  )
}

/** Replaces the whole membership. */
export function setGroupMembers(
  group: Group,
  userIds: readonly string[],
  nowUtc: Date,
  actorUserId: string | null,
): Group {
  return markUpdated({ ...group, memberUserIds: validMembers(userIds) }, nowUtc, actorUserId)
}
