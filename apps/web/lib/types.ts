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
 *
 * `lib/mock.ts` is typed against this module too, so a fixture-backed reader and a real one return
 * the same thing and a screen cannot tell which it got.
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
 * `colorName` is the human name shown in the status settings table, and it has no API field —
 * a status carries a hex colour and nothing else. Optional rather than invented: the settings
 * screen renders the swatch alone when the name is absent, which is honest, and inventing
 * "Slate" from `#64748B` would be a lookup table nobody maintains.
 */
export type Status = {
  id: string
  name: string
  color: string
  colorName?: string
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
  /** The first tag, which is all a card shows. Null when an idea carries none. */
  tag: string | null
  assigneeInitials: string | null
  upvotes: number
  /** Whether the reader is one of them, which is what fills the chip rather than outlining it. */
  hasUpvoted: boolean
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
 * The two catalogs authoring an idea has to choose from.
 *
 * One type rather than two loose lists because the create form needs both or neither: the API
 * requires an active Idea Type *and* an active Business Impact on every idea, so a form holding one
 * of them cannot be submitted.
 */
export type IdeaOptions = {
  ideaTypes: { id: string; name: string }[]
  businessImpacts: { id: string; name: string }[]
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
 * The inspector's shape: everything a card shows, plus the prose and provenance behind it.
 *
 * **There is no `reference`.** Comp Q's `IDEA-101` eyebrow has no column behind it — a real one is a
 * per-organization sequence allocated under a row lock, which needs a schema amendment, and the
 * schema is frozen at S0.2. Deriving one from the id or the row order would be a plausible-looking
 * identifier that changes when the data does, which is worse for trust than having none: a tester
 * cannot tell a fabricated reference from a real one, and the whole point of this screen is that
 * what it shows is what the server holds. So the field does not exist, rather than existing empty.
 *
 * `comments` is the thread as `GET /ideas/{id}` embeds it — the full list, chronological, not a
 * page. See `getIdea` for why the inspector reads it from here.
 */
export type IdeaDetail = Idea & {
  description: string
  author: Person | null
  createdOn: string
  comments: Comment[]
}
