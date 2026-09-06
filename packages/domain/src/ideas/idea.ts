import type { Priority } from '../enums/index.js'
import { IdeaDomainError } from './errors.js'

export const TITLE_MAX_LENGTH = 150
export const DESCRIPTION_MAX_LENGTH = 4000
export const MAX_ASSIGNEES = 5
export const MAX_TAGS = 10

/** A single User-Defined Field value submitted for an idea. A null/blank value clears it. */
export type IdeaFieldValueInput = {
  readonly fieldDefinitionId: string
  readonly value: string | null
}

/** A stored (non-empty) User-Defined Field value on an idea. */
export type IdeaFieldValueRecord = {
  readonly fieldDefinitionId: string
  readonly value: string
}

export type CreateIdeaProps = {
  readonly organizationId: string
  readonly boardId: string
  readonly statusId: string
  readonly title: string
  readonly description: string
  readonly priority: Priority
  readonly ideaTypeId: string
  readonly businessImpactId: string
  readonly dueDate: string | null
  /** The acting user, recorded as author AND as created/updated-by (SPEC/20-feature-view-as.md
   * rule 15 - authorship records the TARGET, never rewritten to the real administrator). */
  readonly authorUserId: string
  readonly assigneeUserIds: readonly string[]
  readonly tagIds: readonly string[]
  readonly mentionedUserIds: readonly string[]
  readonly nowUtc: Date
}

/** Rehydrates an `Idea` from storage. No invariants are re-checked - persisted rows are already
 * valid, and re-validating would reject historical data that was valid under older rules. */
export type RestoreIdeaProps = {
  readonly id: string
  readonly organizationId: string
  readonly boardId: string
  readonly statusId: string
  readonly title: string
  readonly description: string
  readonly priority: Priority
  readonly ideaTypeId: string
  readonly businessImpactId: string
  readonly dueDate: string | null
  readonly authorUserId: string
  readonly isDeleted: boolean
  readonly createdAtUtc: Date
  readonly updatedAtUtc: Date
  readonly createdByUserId: string | null
  readonly updatedByUserId: string | null
  readonly assigneeUserIds: readonly string[]
  readonly tagIds: readonly string[]
  readonly mentionedUserIds: readonly string[]
  readonly fieldValues: readonly IdeaFieldValueRecord[]
}

function assertRequiredId(field: string, value: string, message: string): string {
  if (!value || value.trim().length === 0) {
    throw new IdeaDomainError(field, message)
  }
  return value
}

function normalizeTitle(title: string): string {
  const trimmed = (title ?? '').trim()
  if (trimmed.length === 0) {
    throw new IdeaDomainError('title', 'Title is required.')
  }
  if (trimmed.length > TITLE_MAX_LENGTH) {
    throw new IdeaDomainError('title', `Title must be ${TITLE_MAX_LENGTH} characters or fewer.`)
  }
  return trimmed
}

function normalizeDescription(description: string): string {
  const trimmed = (description ?? '').trim()
  if (trimmed.length === 0) {
    throw new IdeaDomainError('description', 'Description is required.')
  }
  if (trimmed.length > DESCRIPTION_MAX_LENGTH) {
    throw new IdeaDomainError(
      'description',
      `Description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer.`,
    )
  }
  return trimmed
}

function distinctIds(ids: readonly string[] | null | undefined): string[] {
  if (!ids) {
    return []
  }
  const seen = new Set<string>()
  const result: string[] = []
  for (const id of ids) {
    if (!id || seen.has(id)) {
      continue
    }
    seen.add(id)
    result.push(id)
  }
  return result
}

function normalizeAssignees(assigneeUserIds: readonly string[]): string[] {
  const distinct = distinctIds(assigneeUserIds)
  if (distinct.length > MAX_ASSIGNEES) {
    throw new IdeaDomainError(
      'assigneeUserIds',
      `An idea can have at most ${MAX_ASSIGNEES} assignees.`,
    )
  }
  return distinct
}

function normalizeTags(tagIds: readonly string[]): string[] {
  const distinct = distinctIds(tagIds)
  if (distinct.length > MAX_TAGS) {
    throw new IdeaDomainError('tagIds', `An idea can have at most ${MAX_TAGS} tags.`)
  }
  return distinct
}

/**
 * An idea on a board (SPEC/20-feature-ideas-and-engagement.md "Idea Rules"). Aggregate root that
 * owns its assignee and mention associations directly. Tags, idea type, business impact and
 * custom-field values are referenced by plain id only: Tags (`idea_tags`) belong to B4, and Idea
 * Type / Business Impact / User-Defined Fields (`idea_types`, `business_impacts`,
 * `field_definitions`, `idea_field_values`) belong to B5. Status is derived from the swimlane the
 * idea sits in; deletion is a soft delete that preserves the row and its audit history (rule #11).
 *
 * `Idea.OutcomeId` (SPEC/decisions.md 2026-09-02, single-parent Outcome<->Issue linkage: a nullable
 * FK, never a join table) belongs to a later slice - the frozen `ideas` table for this slice
 * carries no `outcome_id` column ("Nothing in Slice 1 depended on this"), so it is deliberately not
 * modeled here.
 */
export class Idea {
  #id: string
  #organizationId: string
  #boardId: string
  #statusId: string
  #title: string
  #description: string
  #priority: Priority
  #ideaTypeId: string
  #businessImpactId: string
  #dueDate: string | null
  #authorUserId: string
  #isDeleted: boolean
  #createdAtUtc: Date
  #updatedAtUtc: Date
  #createdByUserId: string | null
  #updatedByUserId: string | null
  #assigneeUserIds: string[]
  #tagIds: string[]
  #mentionedUserIds: string[]
  #fieldValues: Map<string, string>

  private constructor(state: {
    id: string
    organizationId: string
    boardId: string
    statusId: string
    title: string
    description: string
    priority: Priority
    ideaTypeId: string
    businessImpactId: string
    dueDate: string | null
    authorUserId: string
    isDeleted: boolean
    createdAtUtc: Date
    updatedAtUtc: Date
    createdByUserId: string | null
    updatedByUserId: string | null
    assigneeUserIds: string[]
    tagIds: string[]
    mentionedUserIds: string[]
    fieldValues: Map<string, string>
  }) {
    this.#id = state.id
    this.#organizationId = state.organizationId
    this.#boardId = state.boardId
    this.#statusId = state.statusId
    this.#title = state.title
    this.#description = state.description
    this.#priority = state.priority
    this.#ideaTypeId = state.ideaTypeId
    this.#businessImpactId = state.businessImpactId
    this.#dueDate = state.dueDate
    this.#authorUserId = state.authorUserId
    this.#isDeleted = state.isDeleted
    this.#createdAtUtc = state.createdAtUtc
    this.#updatedAtUtc = state.updatedAtUtc
    this.#createdByUserId = state.createdByUserId
    this.#updatedByUserId = state.updatedByUserId
    this.#assigneeUserIds = state.assigneeUserIds
    this.#tagIds = state.tagIds
    this.#mentionedUserIds = state.mentionedUserIds
    this.#fieldValues = state.fieldValues
  }

  static create(props: CreateIdeaProps): Idea {
    const organizationId = assertRequiredId(
      'organizationId',
      props.organizationId,
      'Organization id is required.',
    )
    const boardId = assertRequiredId('boardId', props.boardId, 'Board id is required.')
    const statusId = assertRequiredId('statusId', props.statusId, 'Status id is required.')
    const authorUserId = assertRequiredId(
      'authorUserId',
      props.authorUserId,
      'Author id is required.',
    )
    const ideaTypeId = assertRequiredId('ideaTypeId', props.ideaTypeId, 'Idea Type is required.')
    const businessImpactId = assertRequiredId(
      'businessImpactId',
      props.businessImpactId,
      'Business Impact is required.',
    )

    return new Idea({
      id: crypto.randomUUID(),
      organizationId,
      boardId,
      statusId,
      title: normalizeTitle(props.title),
      description: normalizeDescription(props.description),
      priority: props.priority,
      ideaTypeId,
      businessImpactId,
      dueDate: props.dueDate,
      authorUserId,
      isDeleted: false,
      createdAtUtc: props.nowUtc,
      updatedAtUtc: props.nowUtc,
      // Rule 15: authorship records the TARGET (the acting user), never rewritten to the real
      // administrator - content created through View As genuinely belongs to that organization.
      createdByUserId: authorUserId,
      updatedByUserId: authorUserId,
      assigneeUserIds: normalizeAssignees(props.assigneeUserIds),
      tagIds: normalizeTags(props.tagIds),
      mentionedUserIds: distinctIds(props.mentionedUserIds),
      fieldValues: new Map(),
    })
  }

  static restore(props: RestoreIdeaProps): Idea {
    return new Idea({
      id: props.id,
      organizationId: props.organizationId,
      boardId: props.boardId,
      statusId: props.statusId,
      title: props.title,
      description: props.description,
      priority: props.priority,
      ideaTypeId: props.ideaTypeId,
      businessImpactId: props.businessImpactId,
      dueDate: props.dueDate,
      authorUserId: props.authorUserId,
      isDeleted: props.isDeleted,
      createdAtUtc: props.createdAtUtc,
      updatedAtUtc: props.updatedAtUtc,
      createdByUserId: props.createdByUserId,
      updatedByUserId: props.updatedByUserId,
      assigneeUserIds: [...props.assigneeUserIds],
      tagIds: [...props.tagIds],
      mentionedUserIds: [...props.mentionedUserIds],
      fieldValues: new Map(props.fieldValues.map((v) => [v.fieldDefinitionId, v.value])),
    })
  }

  get id(): string {
    return this.#id
  }

  get organizationId(): string {
    return this.#organizationId
  }

  get boardId(): string {
    return this.#boardId
  }

  get statusId(): string {
    return this.#statusId
  }

  get title(): string {
    return this.#title
  }

  get description(): string {
    return this.#description
  }

  get priority(): Priority {
    return this.#priority
  }

  get ideaTypeId(): string {
    return this.#ideaTypeId
  }

  get businessImpactId(): string {
    return this.#businessImpactId
  }

  get dueDate(): string | null {
    return this.#dueDate
  }

  get authorUserId(): string {
    return this.#authorUserId
  }

  get isDeleted(): boolean {
    return this.#isDeleted
  }

  get createdAtUtc(): Date {
    return this.#createdAtUtc
  }

  get updatedAtUtc(): Date {
    return this.#updatedAtUtc
  }

  get createdByUserId(): string | null {
    return this.#createdByUserId
  }

  get updatedByUserId(): string | null {
    return this.#updatedByUserId
  }

  get assigneeUserIds(): readonly string[] {
    return this.#assigneeUserIds
  }

  get tagIds(): readonly string[] {
    return this.#tagIds
  }

  get mentionedUserIds(): readonly string[] {
    return this.#mentionedUserIds
  }

  get fieldValues(): readonly IdeaFieldValueRecord[] {
    return Array.from(this.#fieldValues, ([fieldDefinitionId, value]) => ({
      fieldDefinitionId,
      value,
    }))
  }

  private markUpdated(nowUtc: Date, actorUserId: string | null): void {
    this.#updatedAtUtc = nowUtc
    this.#updatedByUserId = actorUserId
  }

  /**
   * Updates the core editable fields (rule #6 keeps this available in the Complete status).
   * Assignees, tags and mentions are replaced through their own methods. Idea Type is immutable
   * here (SPEC/20-feature-idea-type-fields.md) - only `reassignIdeaType` may change it.
   */
  updateContent(
    title: string,
    description: string,
    priority: Priority,
    businessImpactId: string,
    dueDate: string | null,
    nowUtc: Date,
    actorUserId: string | null,
  ): void {
    this.#title = normalizeTitle(title)
    this.#description = normalizeDescription(description)
    this.#priority = priority
    this.#businessImpactId = assertRequiredId(
      'businessImpactId',
      businessImpactId,
      'Business Impact is required.',
    )
    this.#dueDate = dueDate
    this.markUpdated(nowUtc, actorUserId)
  }

  /** Admin-only reassignment of the idea's type - the only path that mutates `ideaTypeId` after
   * creation (SPEC/20-feature-idea-type-fields.md). Field-value reconciliation against the new
   * type's resolved set is the caller's responsibility. */
  reassignIdeaType(ideaTypeId: string, nowUtc: Date, actorUserId: string | null): void {
    this.#ideaTypeId = assertRequiredId('ideaTypeId', ideaTypeId, 'Idea Type is required.')
    this.markUpdated(nowUtc, actorUserId)
  }

  changeStatus(statusId: string, nowUtc: Date, actorUserId: string | null): void {
    this.#statusId = assertRequiredId('statusId', statusId, 'Status id is required.')
    this.markUpdated(nowUtc, actorUserId)
  }

  replaceAssignees(
    assigneeUserIds: readonly string[],
    nowUtc: Date,
    actorUserId: string | null,
  ): void {
    this.#assigneeUserIds = normalizeAssignees(assigneeUserIds)
    this.markUpdated(nowUtc, actorUserId)
  }

  replaceTags(tagIds: readonly string[], nowUtc: Date, actorUserId: string | null): void {
    this.#tagIds = normalizeTags(tagIds)
    this.markUpdated(nowUtc, actorUserId)
  }

  replaceMentions(
    mentionedUserIds: readonly string[],
    nowUtc: Date,
    actorUserId: string | null,
  ): void {
    this.#mentionedUserIds = distinctIds(mentionedUserIds)
    this.markUpdated(nowUtc, actorUserId)
  }

  /**
   * Reconciles this idea's field values to the submitted set (authoritative): a field with a
   * null/blank value is cleared, a changed value overwrites in place, a new value is added, and
   * unchanged values are left untouched. Values must already be validated/serialized by the
   * Application layer (delegated to B5's field-value port).
   *
   * @param reconciledFieldDefinitionIds The field definitions this reconcile is authoritative
   * over - the caller's active/effective set for the idea's type. Only values for these fields
   * may be cleared; values for out-of-scope definitions (e.g. removed from a curated type, or
   * archived on reassignment) are preserved untouched so historical data is not lost
   * (SPEC/20-feature-user-defined-fields.md).
   */
  replaceFieldValues(
    fieldValues: readonly IdeaFieldValueInput[],
    reconciledFieldDefinitionIds: readonly string[],
    nowUtc: Date,
    actorUserId: string | null,
  ): void {
    const scoped = new Set(reconciledFieldDefinitionIds)

    // Last submission wins if a field id is repeated.
    const desired = new Map<string, string | null>()
    for (const input of fieldValues) {
      if (!input.fieldDefinitionId) {
        continue
      }
      const blank = input.value === null || input.value.trim().length === 0
      desired.set(input.fieldDefinitionId, blank ? null : input.value)
    }

    const next = new Map(this.#fieldValues)
    // Only clear values for in-scope definitions; leave out-of-scope (archived) values in place.
    for (const fieldDefinitionId of Array.from(next.keys())) {
      if (!scoped.has(fieldDefinitionId)) {
        continue
      }
      const desiredValue = desired.get(fieldDefinitionId)
      if (desiredValue === undefined || desiredValue === null) {
        next.delete(fieldDefinitionId)
      }
    }

    for (const [fieldDefinitionId, value] of desired) {
      if (value === null) {
        continue
      }
      next.set(fieldDefinitionId, value)
    }

    this.#fieldValues = next
    this.markUpdated(nowUtc, actorUserId)
  }

  softDelete(nowUtc: Date, actorUserId: string | null): void {
    this.#isDeleted = true
    this.markUpdated(nowUtc, actorUserId)
  }
}
