/**
 * The shapes the screens render.
 *
 * These are **view types, not wire types**, and the distinction is the whole reason this module
 * exists. `apps/web` may not import `@collega/application` — `biome.json`'s `noRestrictedImports`
 * fails the lint run on it — so the API's own DTOs cannot be shared. Rather than mirror them and
 * inherit every rename, the screens keep the vocabulary they were written in and each reader in
 * `lib/data/` adapts the wire shape into it (`lib/api/wire.ts` is where the wire shape is
 * declared, and `lib/api/adapt.ts` is where the mapping lives).
 *
 * That is a deliberate seam, not laziness: an idea's status arrives as `statusId` + `statusName`
 * on the list item and the board separately resolves colour from its swimlanes, while a card only
 * ever needed `statusId`. Adapting once, at the boundary, keeps that reconciliation in one file
 * instead of in every component.
 */

export type Role = 'SiteAdmin' | 'OrgAdmin' | 'User' | 'ReadOnly'
export type Priority = 'Low' | 'Medium' | 'High' | 'Critical'

/**
 * The real administrator behind a live View As session.
 *
 * Present on the type before the feature exists (D7) on purpose. `GET /auth/me` returns the
 * ACTING user with this populated, and the client is required to take its principal from there
 * rather than from what login handed back — so a session ended server-side cannot leave a stale
 * banner on screen. A principal type that could not express it would have to be widened later by
 * whoever builds D7, in the one place five other slices had already built on.
 */
export type ViewingAs = {
  realUserId: string
  realUserName: string
  expiresAtUtc: string
}

export type CurrentUser = {
  userId: string
  displayName: string
  initials: string
  role: Role
  roleLabel: string
  /** Null for a Site Admin, who belongs to no organization. */
  organizationId: string | null
  organizationName: string | null
  viewingAs: ViewingAs | null
}

/**
 * The signed-in account's own record, as `/settings/profile` edits it.
 *
 * The same `GET /auth/me` payload `CurrentUser` comes from, read for different fields. The
 * principal carries what the shell renders — a display name and initials — while the form edits the
 * two parts that name is composed from and shows the email read-only beside them. Keeping them as
 * two view types rather than widening `CurrentUser` is what stops one screen's fields appearing on
 * every gated component's principal.
 *
 * No `role`: the form renders `currentUser().roleLabel`, which is already resolved.
 */
export type Profile = {
  firstName: string
  lastName: string
  email: string
}

/**
/**
 * A tenant, as the Site Admin's list renders one.
 *
 * **`inviteCode` is a standing credential, not a label.** It never expires, and anyone holding one
 * can self-register into the organization it names (`app/(auth)/register/page.tsx` argues this at
 * length for the same value). So it may be rendered in the body of a page a Site Admin is already
 * reading, and it must never reach a URL, a query string or a link — those are copied into browser
 * history, request logs and a `Referer` without anybody choosing to copy them.
 *
 * No member, board or idea counts: comp P's table does not show them and `GET /organizations` does
 * not return them. The fixture had all three, which promised a column the endpoint cannot fill.
 *
 * `location` is comp P's single "Detroit, MI" cell, composed from the two nullable columns behind
 * it, and null when neither is recorded.
 */
export type Organization = {
  id: string
  name: string
  description: string
  location: string | null
  inviteCode: string
  isArchived: boolean
}

/**
 * One organization as its edit form needs it, which is a different question from what the list
 * shows.
 *
 * `Organization` answers "which one is this" — a composed `location` cell, for someone scanning a
 * table. This answers "what is recorded about it", with the profile columns kept apart because a
 * form has to post each one back separately.
 *
 * **Every field here is on the form because `PUT /organizations/{id}` is a full replace.** A field
 * the form omits is written as null, so reading fewer than it writes would quietly erase an
 * address every time somebody corrected a title. That is the whole reason this type is wider than
 * anything on this surface would otherwise justify.
 */
export type OrganizationDetail = {
  id: string
  name: string
  description: string
  inviteCode: string
  isArchived: boolean
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  primaryContactFirstName: string | null
  primaryContactLastName: string | null
}

/**
 * An account on an administration list.
 *
 * `organizationId` and `organizationName` are nullable for two different reasons, and both are real:
 * a Site Admin belongs to no organization, and the org-scoped listing does not carry the
 * organization's title because the route already named it. Only the cross-organization table renders
 * the name, and only `getMembers` — which reads the organization list to fan out — can supply it.
 */
export type Member = {
  id: string
  displayName: string
  initials: string
  email: string
  organizationId: string | null
  organizationName: string | null
  role: Role
  roleLabel: string
  status: 'Active' | 'Inactive'
}

/**
 * One account as its edit form needs it.
 *
 * `Member` answers "who is this" for a table — a composed `displayName` and initials. This answers
 * "what is recorded", with the name in the two columns `PUT /users/{id}` actually requires. Every
 * field here is posted back for the reason `OrganizationDetail` gives: the update is a replace.
 */
export type MemberDetail = {
  id: string
  firstName: string
  lastName: string
  email: string
  organizationId: string | null
  role: Role
  status: 'Active' | 'Inactive'
  mustChangePassword: boolean
}

/**
 * One row of a finished user import.
 *
 * `detail` is the temporary password when the row created an account and the reason when it did
 * not. One field rather than two because the column is one column: comp P's *"Temporary password /
 * reason"*, which renders as a credential chip or as prose according to `created`.
 */
export type ImportRow = {
  row: number
  email: string
  created: boolean
  detail: string
}

/**
 * What an import did, in full.
 *
 * **This is the response to a write, not something that can be read back.** The API stores no import
 * history and offers no endpoint for one, and the temporary passwords in it are generated once and
 * never retrievable again — so comp P's "Last import" panel can only ever show the import the
 * reader has just run, in the same session that ran it.
 */
export type ImportOutcome = {
  created: number
  rejected: number
  rows: ImportRow[]
}

/**
 * `colorName` is the human name comp P shows in the status settings table, and it has no API field
 * — a status carries a hex colour and nothing else, so a real one never has it and the settings
 * screen prints the hex beside the swatch instead. Optional rather than invented: inventing "Slate"
 * from `#64748B` would be a lookup table nobody maintains, and the hex is the value an
 * administrator typed into the create form anyway.
 */
export type Status = {
  id: string
  name: string
  color: string
  colorName?: string
}

/**
 * A board as `/settings/boards` administers it, which is a different question from what the
 * workspace list shows.
 *
 * `Board` answers "what is on it" — an idea count, for someone choosing where to look. This
 * answers "how is it configured" — how many lanes it has and who may move a card between them.
 * Both come from `GET /organizations/{id}/boards`, which carries every field either one needs;
 * they are two projections of one response rather than two requests.
 */
export type BoardAdmin = {
  id: string
  name: string
  laneCount: number
  /** Whether a plain User may move a card between lanes, or only an administrator. */
  userStatusMoves: boolean
}

/**
 * One of the kinds of idea people may raise.
 *
 * **No description and no idea count**, which comp Q's table has columns for: neither has a source.
 * `idea_types` carries no description column and the schema is frozen at S0.2, and no endpoint
 * reports how many ideas hold a given type. Rendering them empty would be worse than omitting the
 * columns — a reader cannot tell an empty description from an unwritten one. See `IdeaDetail` in
 * this file for the same decision about an idea's reference.
 *
 * `curatedFieldCount` is `null` for a type in `AllActiveFields` mode, which is not "no fields" but
 * "every active field in the organization" — a different sentence, so a different value.
 */
export type IdeaType = {
  id: string
  name: string
  curatedFieldCount: number | null
}

/**
 * One custom field an idea type may ask for.
 *
 * `usedBy` is the idea types that show this field, resolved by the reader from the idea-type
 * catalog: the mapping is owned by the type, so a field has no way to answer for itself.
 */
export type FieldDefinition = {
  id: string
  name: string
  fieldType: string
  required: boolean
  usedBy: string[]
}

/**
 * One custom field as its edit form needs it.
 *
 * `FieldDefinition` answers "what is this field and who asks for it" for a table. This answers
 * "what is recorded", including the options — whose `id` is the part that matters most, because
 * `PUT` treats an option without one as new and an option missing entirely as deleted, along with
 * every idea value pointing at it.
 *
 * `fieldType` is here to be posted back unchanged. The service refuses to change it after creation
 * outright, so the form shows it and does not offer to edit it.
 */
export type FieldDefinitionDetail = {
  id: string
  name: string
  description: string | null
  fieldType: string
  required: boolean
  displayOrder: number
  options: { id: string; label: string; displayOrder: number }[]
}

/** `focus` is demo-seed copy with no column behind it, so a real board simply has none. */
export type Board = {
  id: string
  name: string
  ideaCount: number
  laneCount: number
  focus?: string
}

/**
 * A board as the workspace Boards screen shows it, card or row.
 *
 * Its own type rather than more fields on `Board`, which the ideas table and the new-idea form
 * also take: they would carry a description, a creator and a tag tally they never render.
 */
export type BoardOverview = {
  id: string
  name: string
  description: string | null
  ideaCount: number
  laneCount: number
  /** ISO, for sorting; `createdOn` is the same instant as a reader sees it. */
  createdAtUtc: string
  createdOn: string
  createdBy: string | null
  lanes: { id: string; name: string; color: string; ideaCount: number }[]
  topTags: { name: string; ideaCount: number; color: string }[]
  tagCount: number
  /** Whether a plain User may move a card between lanes, or only an administrator. */
  userStatusMoves: boolean
  isArchived: boolean
  archivedOn: string | null
}

/**
 * A board opened, rather than listed.
 *
 * The lanes belong to the board and not to the organization: a board picks a subset of the status
 * catalog and puts it in its own order. Not an extension of `Board` — an opened board shows its
 * cards, so it has no use for the idea count a card in the list needs, and fetching one anyway
 * would be a request per page view for a number nothing renders.
 */
export type BoardWithLanes = {
  id: string
  name: string
  lanes: Status[]
  /** Whether a plain User may move a card between lanes, or only an administrator. */
  allowUserStatusUpdate: boolean
  description: string | null
  /** An archived board opens read-only (`20-feature-boards-and-statuses.md` rule 13). */
  isArchived: boolean
}

/**
 * A board as the idea screens refer to it: a name for a row that carries only a `boardId`, and
 * whether its ideas are read-only. Archived boards are included, because their ideas still appear
 * on Ideas.
 */
export type BoardRef = {
  id: string
  name: string
  isArchived: boolean
}

/** A tag where it labels something: its name, which is always the chip's text, and its colour. */
export type TagRef = { id: string; name: string; color: string }

/**
 * A tag in Settings → Tags (`20-feature-ideas-and-engagement.md` rules 11–12): the catalog item.
 * `organization` is set only on a Site Admin's cross-organization roll-up.
 */
export type TagOverview = TagRef & {
  ideaCount: number
  /** The boards its ideas are on, by name. */
  boards: { id: string; name: string }[]
  /** ISO, for sorting; `createdOn` is the same instant as a reader sees it. */
  createdAtUtc: string
  createdOn: string
  createdBy: string | null
  organization: { id: string; name: string } | null
}

/**
 * What a lane card and a table row need — the list shape, and no more.
 *
 * Split from `IdeaDetail` because the API splits them: `GET /boards/{id}/ideas` carries no
 * description and no author name, only an `authorUserId`. The fixture happened to carry both on
 * every idea, which quietly promised the list screens a field the list endpoint cannot supply.
 */
export type Idea = {
  id: string
  boardId: string
  statusId: string
  /**
   * The lane the idea sits in, spelled out. A list item carries it, so a row that names its status
   * does not have to join an id against the organization's catalog — which is what a board does,
   * from its own swimlanes, and what the ideas table used to do from a fixture.
   */
  statusName: string
  title: string
  priority: Priority
  ideaType: string
  businessImpact: string
  /** The first tag's name. Null when an idea carries none. */
  tag: string | null
  /** Every tag, alphabetically, with its colour. */
  tags: TagRef[]
  assigneeInitials: string | null
  /** At most five, by first then last name. */
  assignees: PersonRef[]
  upvotes: number
  /** Whether the reader is one of them, which is what fills the chip rather than outlining it. */
  hasUpvoted: boolean
  /** Optional in Discovery. The idea detail does not carry it, so a detail's is always null. */
  effort: Effort | null
}

/**
 * One page of the organization's ideas, and how much there is behind it.
 *
 * The list screen renders a page rather than a list because it is the one surface with no natural
 * ceiling — every board's ideas at once — so the count it reports and the rows it shows are two
 * different numbers and the type says so. `page` and `pageSize` are the API's answer, not the
 * request: a page beyond the end still echoes what was asked for, and the footer is drawn from
 * what came back.
 */
export type IdeaPage = {
  ideas: Idea[]
  page: number
  pageSize: number
  totalCount: number
}

/**
 * What the idea form offers: the Business Impact and Idea Type catalogs, and for each type the
 * custom fields it resolves to, in order, with whether each is required for that type.
 */
export type IdeaFormOptions = {
  ideaTypes: { id: string; name: string; fields: IdeaFormField[] }[]
  businessImpacts: { id: string; name: string }[]
  /** The organization's active members, for the assignee picker. */
  members: MemberOption[]
  /** The organization's tags, for the tag type-ahead. */
  tags: TagRef[]
}

/**
 * A custom field as the form renders it. `fieldType` is the API's own spelling (`Text`, `Url`,
 * `Number`, `Date`, `Boolean`, `Dropdown`, `MultiSelect`); a Dropdown or MultiSelect value is sent
 * as option ids, comma-separated for MultiSelect.
 *
 * An `archived` option is one the field no longer offers but the idea being edited still holds; the
 * form shows it only while it is selected.
 */
export type IdeaFormField = {
  id: string
  name: string
  fieldType: string
  required: boolean
  options: { id: string; label: string; archived: boolean }[]
}

/** The query behind a page of ideas — the list state, in the API's terms. */
export type IdeaListQuery = {
  search: string
  boardIds: string[]
  statusIds: string[]
  priorities: string[]
  tags: string[]
  sortBy: string | null
  sortDirection: 'asc' | 'desc'
  page: number
  pageSize: number
}

/**
 * A person attached to an idea — its author, an assignee, or a commenter.
 *
 * One type because the API sends one shape for all three, so the avatar and the name are read the
 * same way wherever they appear.
 */
export type Person = {
  name: string
  initials: string
}

/** With the id, which the edit form sends back: `PUT` replaces the assignee collection. */
export type PersonRef = Person & { id: string }

export type Comment = {
  id: string
  /**
   * Null when the API cannot resolve the row behind `authorUserId` — possible because that column
   * carries no foreign key and the schema is frozen at S0.2. Deactivation is not this case: an
   * inactive commenter still arrives named. Rendered as an unattributed comment rather than as an
   * invented name.
   */
  author: Person | null
  postedOn: string
  body: string
}

/**
 * The drawer's shape: everything a card shows, plus the structured fields, the prose and the
 * provenance behind it, and what an edit has to send back unchanged.
 *
 * **There is no `reference`.** Comp Q's `IDEA-101` eyebrow has no column behind it — a real one is a
 * per-organization sequence allocated under a row lock, which needs a schema amendment, and the
 * schema is frozen at S0.2. Deriving one from the id or the row order would be a plausible-looking
 * identifier that changes when the data does, which is worse for trust than having none: a tester
 * cannot tell a fabricated reference from a real one, and the whole point of this screen is that
 * what it shows is what the server holds. So the field does not exist, rather than existing empty.
 *
 * `comments` is the thread as `GET /ideas/{id}` embeds it — the full list, chronological, not a
 * page. See `getIdea` for why the drawer reads it from here.
 */
export type IdeaDetail = Idea & {
  problem: string
  proposedSolutions: string[]
  impactRationale: string
  /** An optional summary since 2026-09-27. */
  description: string | null
  ideaTypeId: string
  businessImpactId: string
  dueDate: string | null
  /** Who raised it; the author may edit the structured fields (`20-feature-ideas-and-engagement.md` rule 2a). */
  authorUserId: string | null
  author: Person | null
  createdOn: string
  mentionEmails: string[]
  fieldValues: { fieldDefinitionId: string; name: string; fieldType: string; value: string }[]
  /** The idea's own custom fields for the edit form, each with its stored value in write form. */
  formFields: (IdeaFormField & { value: string })[]
  comments: Comment[]
}

/**
 * The five fixed delivery statuses — `Pending`, `Scoping`, `Development`, `Review`, `Complete`.
 *
 * **Not the org-configurable ideation `Status` above**, and the two never mix: ideation statuses
 * govern Discovery, these govern Delivery, and an Issue retains both — ideation `Complete` and
 * delivery `Complete` are different terminal states (`SPEC/20-feature-issues-and-delivery.md`).
 *
 * `id` is the domain enum's own spelling, which is what arrives on `WireDeliveryCard.deliveryStatus`
 * — so the sprint board's lane join is an equality test against the value the API sent rather than
 * a lookup through a table the client invented.
 */
export type DeliveryStatus = { id: string; name: string; color: string }

/** T-shirt sizing, deliberately not story points. Required at the promotion gate. */
export type Effort = 'Low' | 'Medium' | 'High'

/** Explicit, never derived from the dates: a sprint past its end date is `Active` until completed. */
export type SprintState = 'Planned' | 'Active' | 'Completed'

/**
 * One sprint, as its header and the backlog's "start the next one" control read it.
 *
 * `startsOn`/`endsOn` are already formatted for display, because the wire's `YYYY-MM-DD` is a day
 * rather than an instant and formatting it in a component would invite `new Date(...)` and the
 * off-by-one-day that follows in any timezone west of Greenwich.
 *
 * `goal` is nullable — a sprint may be planned before anybody has written down what it is for.
 *
 * `startDate`/`endDate` keep the wire's `YYYY-MM-DD` days for the Roadmap, which places them on a
 * calendar rather than printing them. `issueCount`/`doneCount` are the API's, derived per read.
 */
export type Sprint = {
  id: string
  name: string
  goal: string | null
  startsOn: string
  endsOn: string
  startDate: string
  endDate: string
  /** The Sprint board's WINDOW cell, upper case: `10–24 SEP`, or `28 SEP – 5 OCT`. */
  window: string
  state: SprintState
  issueCount: number
  doneCount: number
}

/**
 * An Issue **is** the Idea, promoted — the same record carrying its own history and provenance
 * (`SPEC/20-feature-issues-and-delivery.md`), which is why it keeps an upvote snapshot from the
 * moment it was committed.
 *
 * **There is no `key`.** Comp Q's `CLG-114` eyebrow has no column behind it, exactly as
 * `IdeaDetail`'s `IDEA-101` does not — `SPEC/30-Contracts.md` "Delivery Contracts" is explicit that
 * an Issue is not a new resource and every route addresses it by `{ideaId}`. So the issue screens
 * are addressed by `id`, and nothing derives a plausible-looking key from it.
 *
 * `outcomeId` is nullable and **single-valued** — with one outcome per issue every roadmap total is
 * a plain count, where a checkbox list would make each total a cover, and covers do not add up
 * (`SPEC/decisions.md` 2026-09-02). It is present on the type and always `null` in practice, which
 * `lib/data/delivery.ts` explains: Outcomes are Slice 2 and have no table, service or route yet.
 */
export type Issue = {
  id: string
  title: string
  deliveryStatusId: string
  sprintId: string | null
  outcomeId: string | null
  effort: Effort
  assigneeInitials: string | null
  upvotesAtPromotion: number
  boardId: string
  authorUserId: string
  assignees: PersonRef[]
  tags: TagRef[]
  /** The sprint's name and WINDOW, or null in the backlog. */
  sprint: { id: string; name: string; window: string } | null
  upvotes: number
  taskSummary: { done: number; total: number }
  promotedOn: string | null
  promotedBy: string | null
}

export type IssueTaskState = 'NotStarted' | 'InProgress' | 'Done'

/** One step of an Issue's checklist, in its `sortOrder`. */
export type IssueTask = {
  id: string
  title: string
  state: IssueTaskState
  assigneeUserId: string | null
  assigneeName: string | null
}

/** An active member of the organization, for the sprint owner and task assignee pickers. */
export type MemberOption = { id: string; name: string }

/**
 * A named, dated theme that Issues are grouped under — a lens over the delivery set, not a
 * container that owns it (`SPEC/20-feature-issues-and-delivery.md` Slice 2).
 *
 * The type exists because the roadmap and the outcome picker are built; nothing populates it. See
 * `lib/data/delivery.ts` for why those readers answer empty rather than inventing rows.
 */
export type Outcome = { id: string; name: string; color: string; quarter: string }

/**
 * An organization's assistant settings, as `/settings/ai-assist` renders them.
 *
 * No refusal wording: the fixed refusal is part of the deployment's prompt (rule 34), which only a
 * Site Admin may read, and the organization's settings route does not carry it.
 */
export type AiAssistSettings = {
  scopeStatement: string
  available: boolean
}

/** One published version of the deployment's system prompt, newest first. */
export type PromptVersion = {
  version: number
  publishedAt: string
  author: string
  active: boolean
}

/**
 * The deployment's active system prompt and its two fixed redirects (rules 8, 10 and 34), plus the
 * version history. `version` is null while the built-in default is in force.
 */
export type AiPrompt = {
  text: string
  outOfScopeRedirect: string
  conversationClosedRedirect: string
  version: number | null
  isBuiltInDefault: boolean
  versions: PromptVersion[]
}

/**
 * One organization's AI assist consumption for a window (rules 28a-28e). Counts only.
 *
 * `cachedTokens` is both cache kinds together, and `totalTokens` is all four counts — the same sum
 * the daily ceiling is measured in, so a row and the budget bar speak the same unit.
 */
export type UsageRow = {
  organizationId: string
  organizationName: string
  conversations: number
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  totalTokens: number
  estimatedCost: number
}

/** Every organization's usage today, with the deployment's daily ceiling beside it. */
export type Usage = {
  rows: UsageRow[]
  conversations: number
  tokens: number
  estimatedCost: number
  dailyTokenLimit: number
  tokensUsedToday: number
}

/**
 * One KPI tile on Home. `value` is null when the tile's figure cannot be computed from what the API
 * serves; the tile still renders its definition, so the reader learns what will be counted there.
 */
export type HomeKpi = {
  label: string
  value: number | null
  detail: string | null
  definition: string
  href: string | null
}

/** A row of Home's attention queue. */
export type AttentionItem = {
  id: string
  title: string
  boardName: string | null
  ideaType: string
  status: Status
  priority: Priority
  createdAtUtc: string
}

/** Home for a member of an organization — Org Admin, User or Read Only. */
export type OrganizationHome = {
  counts: { ideas: number; boards: number; issues: number }
  statuses: Status[]
  kpis: HomeKpi[]
  attention: AttentionItem[]
}

/** A board on the Site Admin's roll-up, with the organization that owns it. */
export type PlatformBoard = {
  id: string
  name: string
  organizationName: string
  laneCount: number
}

/** Home for a Site Admin: the platform roll-up. */
export type PlatformHome = {
  counts: { organizations: number; ideas: number; issues: number }
  kpis: HomeKpi[]
  boards: PlatformBoard[]
}
