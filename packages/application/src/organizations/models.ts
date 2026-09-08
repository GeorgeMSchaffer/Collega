import type { OrganizationProfile } from '@collega/domain/organizations'

export type OrganizationProfileFields = OrganizationProfile

export type CreateOrganizationCommand = {
  readonly title: string
  readonly description: string
  readonly logoUrl: string | null
  readonly profile: OrganizationProfileFields
}

export type UpdateOrganizationCommand = {
  readonly title: string
  readonly description: string
  readonly logoUrl: string | null
  readonly profile: OrganizationProfileFields
}

export type OrganizationListQuery = {
  readonly page: number | null
  readonly pageSize: number | null
  readonly search: string | null
  readonly includeArchived: boolean
  readonly sortBy: string | null
  readonly sortDirection: string | null
}

/** Shape matches `GET /api/v1/organizations` (SPEC/30-Contracts.md "Shared Data Rules"). */
export type OrganizationListResult = {
  readonly items: readonly OrganizationListItem[]
  readonly page: number
  readonly pageSize: number
  readonly totalCount: number
  readonly sortBy: string | null
  readonly sortDirection: string
}

/** Shape matches a `GET /api/v1/organizations` paged item. */
export type OrganizationListItem = {
  readonly organizationId: string
  readonly title: string
  readonly description: string
  readonly inviteCode: string
  readonly city: string | null
  readonly state: string | null
  readonly phone: string | null
  readonly logoThumbnailUrl: string | null
  readonly isArchived: boolean
}

/** Shape matches `GET /api/v1/organizations/{id}`. */
export type OrganizationDetail = {
  readonly organizationId: string
  readonly title: string
  readonly description: string
  readonly inviteCode: string
  readonly logoUrl: string | null
  readonly logoThumbnailUrl: string | null
  readonly logoHeightPx: number | null
  readonly address: string | null
  readonly city: string | null
  readonly state: string | null
  readonly zip: string | null
  readonly phone: string | null
  readonly primaryContactFirstName: string | null
  readonly primaryContactLastName: string | null
  readonly isArchived: boolean
  readonly createdAtUtc: Date
  readonly updatedAtUtc: Date
}

/** Shape matches the `POST /api/v1/organizations` success response. */
export type CreateOrganizationResult = {
  readonly organizationId: string
  readonly inviteCode: string
  readonly defaultBoardId: string
  readonly defaultStatusCount: number
}

/** Shape matches the invite-code regenerate response. */
export type RegenerateInviteCodeResult = {
  readonly inviteCode: string
}

/** A resized logo (image data URI) and its rendered height, produced client-side. */
export type SetLogoCommand = {
  readonly thumbnailDataUri: string | null
  readonly heightPx: number
}
