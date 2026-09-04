/**
 * The payload shapes the settings screens read.
 *
 * Written from the golden corpus, like `@/lib/types`, and kept here rather than there
 * because these are the administrative endpoints only this slice consumes — `Organization`
 * in `@/lib/types` carries the three fields the desk shell needs, and widening it for the
 * admin screens would make every screen recompile for a field none of them read.
 *
 * Only fields a screen actually renders are declared.
 */

import type { Role } from "@/lib/types";

/** `GET /organizations` — the Site Admin's platform list. */
export interface OrganizationRow {
  readonly organizationId: string;
  readonly title: string;
  readonly description: string | null;
  /** `<redacted>` throughout the corpus: the capture strips it, it is not absent. */
  readonly inviteCode: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly phone: string | null;
  readonly logoThumbnailUrl: string | null;
  readonly isArchived: boolean;
}

/** `GET /organizations/{id}` — everything the detail panel shows. */
export interface OrganizationDetail extends OrganizationRow {
  readonly logoUrl: string | null;
  readonly logoHeightPx: number | null;
  readonly address: string | null;
  readonly zip: string | null;
  readonly primaryContactFirstName: string | null;
  readonly primaryContactLastName: string | null;
  readonly createdAtUtc: string;
  readonly updatedAtUtc: string;
}

/** `GET /organizations/{id}/users`. */
export interface OrgUser {
  readonly userId: string;
  readonly organizationId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly role: Role;
  readonly status: string;
}

/** `GET /users/{userId}` — the three fields the list row does not carry. */
export interface UserDetail extends OrgUser {
  readonly mustChangePassword: boolean;
  readonly createdAtUtc: string;
  readonly updatedAtUtc: string;
}

/** `GET /organizations/{id}/field-definitions`. */
export interface FieldDefinition {
  readonly fieldDefinitionId: string;
  readonly name: string;
  readonly description: string | null;
  readonly fieldType: string;
  readonly isRequired: boolean;
  readonly displayOrder: number;
  readonly isDeleted: boolean;
  readonly options: readonly string[];
}

/**
 * `GET /organizations/{id}/idea-types`. Wider than `@/lib/types`' `IdeaType`: the admin
 * screen shows which fields a type carries, which the ideas list has no use for.
 */
export interface IdeaTypeAdmin {
  readonly ideaTypeId: string;
  readonly name: string;
  readonly colorHex: string | null;
  readonly icon: string | null;
  readonly sortOrder: number;
  readonly isDeleted: boolean;
  /** `AllActiveFields` or `SelectedFields`. */
  readonly fieldMode: string;
  readonly fields: readonly { readonly fieldDefinitionId: string; readonly isRequired: boolean }[];
}

/** `GET /organizations/{id}/ai-assist/settings`. */
export interface AiAssistSettings {
  readonly aiAssistAvailable: boolean;
  readonly scopeStatement: string | null;
}

/** `GET /ai-assist/usage` and its organization-scoped twin. */
export interface AiUsage {
  readonly fromUtc: string;
  readonly toUtc: string;
  readonly organizations: readonly {
    readonly organizationId: string;
    readonly organizationTitle?: string;
    readonly calls: number;
    readonly totalTokens: number;
    readonly estimatedCost: number;
  }[];
  readonly dailyTokenLimit: number | null;
  readonly tokensUsedToday: number | null;
  readonly totalCalls: number;
  readonly totalTokens: number;
  readonly totalEstimatedCost: number;
}

/** `GET /ai-assist/prompt` — the platform-wide assistant instructions. */
export interface AiPrompt {
  readonly body: string;
  readonly outOfScopeRedirect: string;
  readonly conversationClosedRedirect: string;
  readonly version: number | null;
  readonly isBuiltInDefault: boolean;
  readonly versions: readonly {
    readonly version: number;
    readonly createdAtUtc: string;
    readonly createdByUserId: string | null;
    readonly createdByDisplayName: string | null;
    readonly isActive: boolean;
  }[];
}
