// The nine domain enums, mirrored from packages/infrastructure/prisma/schema.prisma.
//
// Hand-written rather than re-exported from the generated Prisma client, because
// packages/domain imports nothing - that is the layer rule biome.json enforces. The
// integers are the values the .NET columns held; seven enums were stored as the member
// name and two as an int, and F3's transform needs both facts.
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
