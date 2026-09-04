/**
 * The payload shapes these screens read, written from the golden corpus rather than from a
 * generated client: Wave F1 gates cutover on Nest replaying the same recordings, so the
 * fields below are the contract either way. Only the fields a screen actually uses are
 * declared — an unread field is one more thing to keep in step for no benefit.
 */

export type Role = "SiteAdmin" | "OrgAdmin" | "User" | "ReadOnly";

export interface Me {
  readonly userId: string;
  /** Null for a Site Admin, who is a platform account and belongs to no organization. */
  readonly organizationId: string | null;
  readonly role: Role;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
}

export interface Organization {
  readonly organizationId: string;
  readonly title: string;
  readonly description: string | null;
}

export interface Paged<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
}

export interface BoardSummary {
  readonly boardId: string;
  readonly organizationId: string;
  readonly name: string;
  readonly allowUserStatusUpdate: boolean;
  readonly swimlaneCount: number;
}

export interface Swimlane {
  readonly statusId: string;
  readonly statusName: string;
  readonly statusColor: string | null;
  readonly order: number;
  readonly statusIsDeleted: boolean;
}

export interface BoardDetail {
  readonly boardId: string;
  readonly name: string;
  readonly allowUserStatusUpdate: boolean;
  readonly swimlanes: readonly Swimlane[];
}

export interface Status {
  readonly statusId: string;
  readonly name: string;
  readonly color: string | null;
  readonly sortOrder: number;
  readonly isDeleted: boolean;
}

export interface IdeaType {
  readonly ideaTypeId: string;
  readonly name: string;
  readonly colorHex: string | null;
  readonly sortOrder: number;
  readonly isDeleted: boolean;
}

export interface Assignee {
  readonly userId: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly displayName: string | null;
  readonly isActive: boolean;
}

/** The four values the API stores; the order below is the order they are ranked in. */
export const PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface IdeaListItem {
  readonly ideaId: string;
  readonly boardId: string;
  readonly title: string;
  readonly priority: Priority;
  readonly ideaTypeId: string;
  readonly ideaTypeName: string;
  readonly ideaTypeColorHex: string | null;
  readonly businessImpactId: string | null;
  readonly businessImpactName: string | null;
  readonly businessImpactColor: string | null;
  readonly dueDate: string | null;
  readonly assignees: readonly Assignee[];
  readonly tagNames: readonly string[];
  readonly statusId: string;
  readonly statusName: string;
  readonly upvoteCount: number;
  readonly hasUpvoted: boolean;
  readonly commentCount: number;
  readonly authorUserId: string;
  readonly createdAtUtc: string;
}

export interface Member {
  readonly userId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
}
