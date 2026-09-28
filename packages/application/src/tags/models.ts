import type { TagBoard } from './ports.js'

/** The tag item shape (SPEC/30-Contracts.md "Tag colour and management"). */
export type TagItem = {
  readonly tagId: string
  readonly name: string
  readonly color: string
  readonly ideaCount: number
  /** Ordered by name, case-insensitively; archived boards included. */
  readonly boards: readonly TagBoard[]
  readonly createdAtUtc: Date
  readonly createdBy: { readonly userId: string; readonly displayName: string } | null
}

export type CreateTagCommand = {
  readonly name: string
  /** `null` is absent: a random palette colour. */
  readonly color: string | null
}

export type UpdateTagCommand = {
  readonly name: string
  /** `null` is absent: the stored colour stays. */
  readonly color: string | null
}
