import { randomUUID } from 'node:crypto'
import { normalizeInviteCode } from './invite-code.js'

// The top-level ownership boundary for all business data
// (SPEC/20-feature-organizations-and-users.md "Organization Rules"). Created by Site Admin with
// only a Title and Description; a Logo Address is optional. Owns invite-code regeneration and
// archive invariants. Binary logo upload (logoThumbnailUrl/logoHeightPx population) and
// organization AI-key management are separate follow-ups and are not built on this entity yet.

export const ORGANIZATION_TITLE_MAX_LENGTH = 200
export const ORGANIZATION_DESCRIPTION_MAX_LENGTH = 1000
export const ORGANIZATION_LOGO_URL_MAX_LENGTH = 500

/** Max length of the stored logo thumbnail data URI (~a small resized PNG in base64). */
export const ORGANIZATION_LOGO_THUMBNAIL_MAX_LENGTH = 300_000

/** The uploaded logo is rendered at most this tall. */
export const ORGANIZATION_LOGO_MAX_HEIGHT_PX = 150

export const ORGANIZATION_ADDRESS_MAX_LENGTH = 200
export const ORGANIZATION_CITY_MAX_LENGTH = 100
export const ORGANIZATION_STATE_MAX_LENGTH = 50
export const ORGANIZATION_ZIP_MAX_LENGTH = 20
export const ORGANIZATION_PHONE_MAX_LENGTH = 25
export const ORGANIZATION_CONTACT_NAME_MAX_LENGTH = 100

/**
 * Cap on `aiScopeStatement`. Short on purpose: the statement goes into the system prompt on
 * every AI assist turn, so it is a per-call cost as well as a policy.
 */
export const ORGANIZATION_AI_SCOPE_STATEMENT_MAX_LENGTH = 500

export type OrganizationProfile = {
  readonly address: string | null
  readonly city: string | null
  readonly state: string | null
  readonly zip: string | null
  readonly phone: string | null
  readonly primaryContactFirstName: string | null
  readonly primaryContactLastName: string | null
}

const EMPTY_PROFILE: OrganizationProfile = {
  address: null,
  city: null,
  state: null,
  zip: null,
  phone: null,
  primaryContactFirstName: null,
  primaryContactLastName: null,
}

export type Organization = {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly inviteCode: string
  readonly isArchived: boolean
  /** Optional org-provided logo address (contract field `logoUrl`). */
  readonly logoUrl: string | null
  /** System-managed after a binary logo upload; null until that feature lands. */
  readonly logoThumbnailUrl: string | null
  /** System-managed rendered height, capped at 150px; null until a logo is uploaded. */
  readonly logoHeightPx: number | null
  readonly address: string | null
  readonly city: string | null
  readonly state: string | null
  readonly zip: string | null
  readonly phone: string | null
  readonly primaryContactFirstName: string | null
  readonly primaryContactLastName: string | null
  /**
   * Optional free text narrowing what the AI assistant will discuss for this organization
   * (SPEC/20-feature-ai-idea-assist.md rules 6-9). Null or empty means "no narrowing beyond the
   * organization's active Idea Types" - it can only tighten that boundary, never widen it.
   */
  readonly aiScopeStatement: string | null
  readonly createdAtUtc: Date
  readonly updatedAtUtc: Date
  readonly createdByUserId: string | null
  readonly updatedByUserId: string | null
}

function normalize(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.trim().length === 0) {
    return null
  }
  return value.trim()
}

function requireNonBlank(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} is required.`)
  }
}

function applyProfile(profile: OrganizationProfile | null | undefined): OrganizationProfile {
  if (!profile) {
    return EMPTY_PROFILE
  }
  return {
    address: normalize(profile.address),
    city: normalize(profile.city),
    state: normalize(profile.state),
    zip: normalize(profile.zip),
    phone: normalize(profile.phone),
    primaryContactFirstName: normalize(profile.primaryContactFirstName),
    primaryContactLastName: normalize(profile.primaryContactLastName),
  }
}

export type CreateOrganizationInput = {
  readonly title: string
  readonly description: string
  readonly inviteCode: string
  readonly logoUrl?: string | null
  readonly profile?: OrganizationProfile | null
}

export function createOrganization(
  input: CreateOrganizationInput,
  nowUtc: Date,
  actorUserId: string | null,
): Organization {
  requireNonBlank(input.title, 'Title')
  requireNonBlank(input.description, 'Description')
  requireNonBlank(input.inviteCode, 'Invite code')

  const profile = applyProfile(input.profile)

  return {
    id: randomUUID(),
    title: input.title.trim(),
    description: input.description.trim(),
    inviteCode: normalizeInviteCode(input.inviteCode),
    isArchived: false,
    logoUrl: normalize(input.logoUrl),
    logoThumbnailUrl: null,
    logoHeightPx: null,
    ...profile,
    aiScopeStatement: null,
    createdAtUtc: nowUtc,
    updatedAtUtc: nowUtc,
    createdByUserId: actorUserId,
    updatedByUserId: actorUserId,
  }
}

export type UpdateOrganizationInput = {
  readonly title: string
  readonly description: string
  readonly logoUrl: string | null
  readonly profile: OrganizationProfile
}

/** Applies an edit to organization detail (org-and-users requirement #7). Invite code, archive
 * state, and system-managed logo fields are changed only through their dedicated functions. */
export function updateOrganization(
  organization: Organization,
  input: UpdateOrganizationInput,
  nowUtc: Date,
  actorUserId: string | null,
): Organization {
  requireNonBlank(input.title, 'Title')
  requireNonBlank(input.description, 'Description')

  return {
    ...organization,
    title: input.title.trim(),
    description: input.description.trim(),
    logoUrl: normalize(input.logoUrl),
    ...applyProfile(input.profile),
    updatedAtUtc: nowUtc,
    updatedByUserId: actorUserId,
  }
}

/**
 * Stores an uploaded logo as a resized image data URI plus its rendered height (org-and-users
 * binary-logo feature). The image is resized client-side to at most
 * `ORGANIZATION_LOGO_MAX_HEIGHT_PX`; this validates the payload is an image data URI within the
 * size cap and clamps the height.
 */
export function setOrganizationLogo(
  organization: Organization,
  thumbnailDataUri: string,
  heightPx: number,
  nowUtc: Date,
  actorUserId: string | null,
): Organization {
  if (thumbnailDataUri.trim().length === 0) {
    throw new Error('A logo image is required.')
  }

  if (!thumbnailDataUri.toLowerCase().startsWith('data:image/')) {
    throw new Error('Logo must be an image.')
  }

  if (thumbnailDataUri.length > ORGANIZATION_LOGO_THUMBNAIL_MAX_LENGTH) {
    throw new Error('Logo image is too large.')
  }

  return {
    ...organization,
    logoThumbnailUrl: thumbnailDataUri,
    logoHeightPx: Math.min(Math.max(heightPx, 1), ORGANIZATION_LOGO_MAX_HEIGHT_PX),
    updatedAtUtc: nowUtc,
    updatedByUserId: actorUserId,
  }
}

/** Removes the uploaded logo. Idempotent. */
export function clearOrganizationLogo(
  organization: Organization,
  nowUtc: Date,
  actorUserId: string | null,
): Organization {
  return {
    ...organization,
    logoThumbnailUrl: null,
    logoHeightPx: null,
    updatedAtUtc: nowUtc,
    updatedByUserId: actorUserId,
  }
}

/**
 * Regenerates the invite code, immediately invalidating the previous one (org-and-users
 * requirement #6). Uniqueness across organizations is enforced by the caller against the store.
 */
export function regenerateInviteCode(
  organization: Organization,
  newInviteCode: string,
  nowUtc: Date,
  actorUserId: string | null,
): Organization {
  if (newInviteCode.trim().length === 0) {
    throw new Error('Invite code is required.')
  }

  return {
    ...organization,
    inviteCode: normalizeInviteCode(newInviteCode),
    updatedAtUtc: nowUtc,
    updatedByUserId: actorUserId,
  }
}

/**
 * Sets or clears the AI assist scope statement (rule 6). Null, empty, or whitespace clears it,
 * leaving the organization's active Idea Types as the only boundary - clearing is a legitimate
 * choice, not a reset to an unset state, so it takes the same path as setting.
 */
export function setOrganizationAiScopeStatement(
  organization: Organization,
  scopeStatement: string | null,
  nowUtc: Date,
  actorUserId: string | null,
): Organization {
  const normalized = normalize(scopeStatement)

  if (normalized !== null && normalized.length > ORGANIZATION_AI_SCOPE_STATEMENT_MAX_LENGTH) {
    throw new Error(
      `Scope statement cannot exceed ${ORGANIZATION_AI_SCOPE_STATEMENT_MAX_LENGTH} characters.`,
    )
  }

  return {
    ...organization,
    aiScopeStatement: normalized,
    updatedAtUtc: nowUtc,
    updatedByUserId: actorUserId,
  }
}

/** Archives without hard-deleting (org-and-users requirement #8). Idempotent. */
export function archiveOrganization(
  organization: Organization,
  nowUtc: Date,
  actorUserId: string | null,
): Organization {
  if (organization.isArchived) {
    return organization
  }

  return {
    ...organization,
    isArchived: true,
    updatedAtUtc: nowUtc,
    updatedByUserId: actorUserId,
  }
}
