// The fourteen domain enums, mirrored from packages/infrastructure/prisma/schema.prisma.
//
// Hand-written rather than re-exported from the generated Prisma client, because
// packages/domain imports nothing - that is the layer rule biome.json enforces. The
// integers are the values the .NET columns held; seven enums were stored as the member
// name and two as an int, and F3's transform needs both facts.
//
// The last five - IdeaPhase, EffortLevel, DeliveryStatus, SprintState, IssueTaskState - have
// no .NET ancestor at all: Issues-and-Delivery was never built there, so there is no legacy
// column and nothing for F3 to transform. SPEC/20-feature-issues-and-delivery.md numbers
// their members because it is written in the C# idiom; those numbers are recorded beside each
// member as declaration order, but the stored value is the member NAME, like every other enum
// here. Nothing persists the integer.
//
// These live here rather than under src/common because every feature partition in Wave B
// needs Role in particular, and the kernel that S0.3 builds is written against it.

export enum Role {
  SiteAdmin = 'SiteAdmin',
  OrgAdmin = 'OrgAdmin',
  User = 'User',
  ReadOnly = 'ReadOnly',
}

export enum UserStatus {
  Active = 'Active',
  Inactive = 'Inactive',
}

export enum Priority {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Critical = 'Critical',
}

/** Stored as int in the .NET schema, numbered from 1. F3 maps 1..7 in this order. */
export enum FieldType {
  Text = 'Text',
  Number = 'Number',
  Date = 'Date',
  Boolean = 'Boolean',
  Dropdown = 'Dropdown',
  MultiSelect = 'MultiSelect',
  Url = 'Url',
}

/** Stored as int in the .NET schema: AllActiveFields = 0, Curated = 1. */
export enum IdeaTypeFieldMode {
  AllActiveFields = 'AllActiveFields',
  Curated = 'Curated',
}

export enum ImpersonationEndReason {
  ExitedByUser = 'ExitedByUser',
  IdleTimeout = 'IdleTimeout',
  AbsoluteTimeout = 'AbsoluteTimeout',
  TargetNoLongerValid = 'TargetNoLongerValid',
  RealUserNoLongerAuthorized = 'RealUserNoLongerAuthorized',
}

export enum NotificationEventType {
  IdeaMention = 'IdeaMention',
  CommentMention = 'CommentMention',
  CommentAdded = 'CommentAdded',
  IdeaStatusChanged = 'IdeaStatusChanged',
}

export enum AiCallOutcome {
  Succeeded = 'Succeeded',
  Refused = 'Refused',
  Failed = 'Failed',
}

export enum AiKeySource {
  Platform = 'Platform',
  Organization = 'Organization',
}

/**
 * Which half of its life an item is in (SPEC/20-feature-issues-and-delivery.md). An Issue is not
 * a separate entity - it is an Idea whose phase is `Delivery`, the same row, which is what makes
 * promotion lossless.
 */
export enum IdeaPhase {
  Discovery = 'Discovery', // 0
  Delivery = 'Delivery', // 1
}

/** T-shirt sizing, deliberately not story points. Optional in Discovery, required at promotion. */
export enum EffortLevel {
  Low = 'Low', // 0
  Medium = 'Medium', // 1
  High = 'High', // 2
}

/**
 * The fixed delivery lifecycle, and the sprint board's five swimlanes. Not org-configurable in
 * this slice, and entirely separate from the org-configured ideation statuses that govern
 * Discovery - an item keeps both, and `Complete` here means something different from ideation's
 * `Complete`.
 */
export enum DeliveryStatus {
  Pending = 'Pending', // 0
  Scoping = 'Scoping', // 1
  Development = 'Development', // 2
  Review = 'Review', // 3
  Complete = 'Complete', // 4
}

/** Start and complete are explicit actions, never derived from the sprint's dates. */
export enum SprintState {
  Planned = 'Planned', // 0
  Active = 'Active', // 1
  Completed = 'Completed', // 2
}

/**
 * Three states rather than a bare checkbox, because "started but not finished" is the state a
 * standup actually asks about. The `N of M done` rollup counts only `Done`.
 */
export enum IssueTaskState {
  NotStarted = 'NotStarted', // 0
  InProgress = 'InProgress', // 1
  Done = 'Done', // 2
}
