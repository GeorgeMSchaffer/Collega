/**
 * The administration surfaces: organizations, members, idea types, fields, the profile, the user
 * import, and the two AI settings screens plus their usage meter.
 *
 * Every reader here calls the API.
 *
 * `getUsage` returns the rows and the totals together, both as the API summed them, so the budget
 * card and the table footer — side by side on the same screen — cannot disagree.
 *
 * ## One page, and no pager
 *
 * The list endpoints page, and `MAX_PAGE_SIZE` on the API is 100. None of these screens has a pager
 * — comp P gives them filters instead — so the readers below take one page of 100 and report what
 * came back. A deployment with more than 100 organizations, or more than 100 accounts in one
 * organization, would show the first 100; that is a known ceiling rather than an oversight, and the
 * filters comp P specifies are what it is waiting on.
 */

import { toFieldDefinition, toIdeaType, toMember, toOrganization, toProfile } from '../api/adapt'
import { apiGet, apiPath } from '../api/client'
import type {
  WireAiAssistSettings,
  WireAiPromptSettings,
  WireAiUsageReport,
  WireAiUsageSummary,
  WireCurrentUser,
  WireFieldDefinition,
  WireFieldDefinitionDetail,
  WireIdeaType,
  WireOrganizationDetail,
  WireOrganizationListItem,
  WirePage,
  WireUserDetail,
  WireUserListItem,
} from '../api/wire'
import { API_MAX_PAGE_SIZE } from '../limits'
import { currentUser } from '../session'
import type {
  AiAssistSettings,
  AiPrompt,
  FieldDefinition,
  FieldDefinitionDetail,
  IdeaType,
  Member,
  MemberDetail,
  Organization,
  OrganizationDetail,
  Profile,
  Usage,
  UsageRow,
} from '../types'
import { failIfRequested, resolve } from './latency'
import { everyOrganization, organizationScope } from './scope'

export { AI_REDIRECT_MAX, SCOPE_STATEMENT_MAX, SYSTEM_PROMPT_MAX } from '../limits'
export type {
  AiAssistSettings,
  AiPrompt,
  FieldDefinition,
  IdeaType,
  ImportOutcome,
  ImportRow,
  Member,
  Organization,
  Profile,
  PromptVersion,
  Usage,
  UsageRow,
} from '../types'

/**
 * Every organization on the deployment.
 *
 * **Answers empty for anyone but a Site Admin rather than asking**, because `GET /organizations`
 * refuses every other role with a 403 and this reader is called by four settings screens whose own
 * gates already refuse those roles. Reading first would land that 403 on the error boundary in place
 * of the refusal panel comp P specifies — the reader would be the reason a correctly gated screen
 * showed a crash. It is the same judgement `organizationScope()` makes, and it is a decision about
 * what to *ask for*: the API is still the only thing that authorizes the answer.
 *
 * Archived organizations are excluded, which is the endpoint's default and what comp P's footer
 * promises ("Archived ones are hidden unless filtered in"). `isArchived` still rides on every row,
 * because the filter that would include them is the same table.
 */
export async function getOrganizations(): Promise<Organization[]> {
  failIfRequested('getOrganizations')
  if (currentUser().role !== 'SiteAdmin') return []

  const page = await apiGet<WirePage<WireOrganizationListItem>>(
    'getOrganizations',
    // `pageSize` written into the literal rather than interpolated: `apiPath` escapes what it
    // interpolates, so a value spliced in here would arrive as `pageSize%3D100` and be ignored.
    apiPath`/organizations?pageSize=${String(API_MAX_PAGE_SIZE)}`,
  )

  return page.items.map(toOrganization)
}

/**
 * Every account on the deployment, for the Site Admin's cross-organization list.
 *
 * **There is no cross-organization user endpoint**, so this is the fan-out comp P describes in that
 * screen's own error copy — *"This view queries every organization in turn, so a single organization
 * failing empties the whole list."* One request for the organizations, then one per organization,
 * in parallel. The organization's title comes from the first request, which is the only place it
 * exists: an org-scoped listing does not repeat the name the route already carried.
 *
 * `getOrganizations` answers empty for anyone but a Site Admin, so this does too, and no per-user
 * request is made for a role that may not read them.
 */
export async function getMembers(): Promise<Member[]> {
  failIfRequested('getMembers')

  const organizations = await getOrganizations()
  const pages = await Promise.all(
    organizations.map((organization) =>
      apiGet<WirePage<WireUserListItem>>(
        'getMembers',
        apiPath`/organizations/${organization.id}/users?pageSize=${String(API_MAX_PAGE_SIZE)}`,
      ),
    ),
  )

  return pages.flatMap((page, index) =>
    page.items.map((item) => toMember(item, organizations[index]?.name ?? null)),
  )
}

/**
 * One organization's accounts, with their role and status.
 *
 * `/users` and not `/members`: the latter is the assignee picker's id-name-email view, open to every
 * member of the organization and carrying neither of the two columns this table exists to show.
 *
 * The name of the organization is not filled in — this reader does not fetch it, and the screen that
 * calls it renders its own organization's name from the principal rather than per row.
 *
 * An Org Admin naming another organization is answered 404, not 403, and that is the API declining
 * to confirm it exists. Nothing here catches it: the only call site passes the caller's own
 * organization id, taken from the resolved principal, so there is no id a reader could steer.
 */
export async function getMembersForOrganization(organizationId: string): Promise<Member[]> {
  failIfRequested('getMembersForOrganization')

  const page = await apiGet<WirePage<WireUserListItem>>(
    'getMembersForOrganization',
    apiPath`/organizations/${organizationId}/users?pageSize=${String(API_MAX_PAGE_SIZE)}`,
  )

  return page.items.map((item) => toMember(item, null))
}

/**
 * The caller's own organization's invite code, or null when they have no organization.
 *
 * A standing credential (`Organization` in `lib/types.ts` says what that obliges), read from the
 * organization detail because that is the only route that carries it for a single organization —
 * a Site Admin gets it on the list item instead.
 *
 * Null for a Site Admin, who belongs to no organization and so has no code of their own to share.
 * The endpoint refuses a plain User outright, so the one screen that calls this asks only when the
 * reader is an Org Admin.
 */
export async function getInviteCode(): Promise<string | null> {
  failIfRequested('getInviteCode')

  const scope = organizationScope()
  if (scope === null) return null

  const organization = await apiGet<WireOrganizationDetail>(
    'getInviteCode',
    apiPath`/organizations/${scope}`,
  )

  return organization.inviteCode
}

/**
 * One organization, whole, for the screen that edits it.
 *
 * Reads the same route `getInviteCode` does and keeps everything rather than one field, because
 * `PUT /organizations/{id}` replaces the profile wholesale — see `OrganizationDetail`. Site Admin
 * only in practice: the list it is reached from is theirs, and rule 26's bootstrap exemption is
 * what lets them write it.
 */
export async function getOrganizationDetail(organizationId: string): Promise<OrganizationDetail> {
  failIfRequested('getOrganizationDetail')

  const organization = await apiGet<WireOrganizationDetail>(
    'getOrganizationDetail',
    apiPath`/organizations/${organizationId}`,
  )

  return {
    id: organization.organizationId,
    name: organization.title,
    description: organization.description,
    inviteCode: organization.inviteCode,
    isArchived: organization.isArchived,
    address: organization.address,
    city: organization.city,
    state: organization.state,
    zip: organization.zip,
    phone: organization.phone,
    primaryContactFirstName: organization.primaryContactFirstName,
    primaryContactLastName: organization.primaryContactLastName,
  }
}

/**
 * One custom field, whole, for the screen that edits it.
 *
 * Organization-scoped in the path like every other field-definition route, so this asks the API
 * whose session it is rather than taking an organization from the caller — the same reasoning
 * `catalog-actions.ts` gives for not making that a form field.
 */
export async function getFieldDefinitionDetail(
  fieldDefinitionId: string,
): Promise<FieldDefinitionDetail | null> {
  failIfRequested('getFieldDefinitionDetail')

  const scope = organizationScope()
  if (scope === null) return null

  const field = await apiGet<WireFieldDefinitionDetail>(
    'getFieldDefinitionDetail',
    apiPath`/organizations/${scope}/field-definitions/${fieldDefinitionId}`,
  )

  return {
    id: field.fieldDefinitionId,
    name: field.name,
    description: field.description,
    fieldType: field.fieldType,
    required: field.isRequired,
    displayOrder: field.displayOrder,
    options: field.options.map((option) => ({
      id: option.optionId,
      label: option.label,
      displayOrder: option.displayOrder,
    })),
  }
}

/**
 * One account, for the screen that edits it.
 *
 * `GET /users/{id}` rather than a `find` over the people list, unlike the catalog edit pages: the
 * single-item route exists here, and the list deliberately composes `displayName` from the two name
 * columns — so finding the row would hand back a name that cannot be posted to a form asking for
 * first and last separately.
 *
 * `role` and `status` are narrowed from the wire's plain strings. The API answers with the domain's
 * own spellings and nothing else, so the cast asserts what the contract already guarantees rather
 * than papering over a real uncertainty.
 */
export async function getMemberDetail(userId: string): Promise<MemberDetail> {
  failIfRequested('getMemberDetail')

  const user = await apiGet<WireUserDetail>('getMemberDetail', apiPath`/users/${userId}`)

  return {
    id: user.userId,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    organizationId: user.organizationId,
    role: user.role as MemberDetail['role'],
    status: user.status as MemberDetail['status'],
    mustChangePassword: user.mustChangePassword,
  }
}

export async function getIdeaTypes(): Promise<IdeaType[]> {
  failIfRequested('getIdeaTypes')

  const scope = organizationScope()
  if (scope === null) return []

  return (await listIdeaTypes(scope, 'getIdeaTypes')).map(toIdeaType)
}

/** Every organization's idea types, for the cross-organization list a Site Admin reads. */
export async function getIdeaTypesByOrganization(): Promise<
  { organization: string; ideaTypes: IdeaType[] }[]
> {
  failIfRequested('getIdeaTypesByOrganization')

  const organizations = await everyOrganization('getIdeaTypesByOrganization')

  return Promise.all(
    organizations.map(async (organization) => ({
      organization: organization.name,
      ideaTypes: (await listIdeaTypes(organization.id, 'getIdeaTypesByOrganization')).map(
        toIdeaType,
      ),
    })),
  )
}

function listIdeaTypes(organizationId: string, reader: string): Promise<readonly WireIdeaType[]> {
  return apiGet<readonly WireIdeaType[]>(
    reader,
    apiPath`/organizations/${organizationId}/idea-types`,
  )
}

/**
 * The organization's custom fields, each carrying the idea types that ask for it.
 *
 * Two requests rather than one, because "used by" runs the other way round: an idea type owns an
 * ordered selection of fields, and a field definition has no column pointing back. Joining here
 * rather than in the page keeps the screen a renderer, and keeps the one rule the join encodes —
 * that an `AllActiveFields` type shows *every* active field, not an empty selection — in the same
 * place for both callers.
 */
export async function getFieldDefinitions(): Promise<FieldDefinition[]> {
  failIfRequested('getFieldDefinitions')

  const scope = organizationScope()
  if (scope === null) return []

  return fieldDefinitionsFor(scope, 'getFieldDefinitions')
}

/** Every organization's custom fields, for the cross-organization list a Site Admin reads. */
export async function getFieldDefinitionsByOrganization(): Promise<
  { organization: string; fields: FieldDefinition[] }[]
> {
  failIfRequested('getFieldDefinitionsByOrganization')

  const organizations = await everyOrganization('getFieldDefinitionsByOrganization')

  return Promise.all(
    organizations.map(async (organization) => ({
      organization: organization.name,
      fields: await fieldDefinitionsFor(organization.id, 'getFieldDefinitionsByOrganization'),
    })),
  )
}

async function fieldDefinitionsFor(
  organizationId: string,
  reader: string,
): Promise<FieldDefinition[]> {
  const [fields, ideaTypes] = await Promise.all([
    apiGet<readonly WireFieldDefinition[]>(
      reader,
      apiPath`/organizations/${organizationId}/field-definitions`,
    ),
    listIdeaTypes(organizationId, reader),
  ])

  return fields.map((field) => toFieldDefinition(field, ideaTypes))
}

/**
 * The signed-in account's own record, from `GET /auth/me`.
 *
 * A second request for a payload this render has already fetched — `requireCurrentUser` resolves
 * the principal from the same endpoint — and deliberately so. That resolution is memoized as a
 * `CurrentUser`, which drops `firstName`, `lastName` and `email` on the way through `toCurrentUser`
 * because nothing but this screen needs them. Sharing it would mean widening the principal every
 * gated component reads to carry three fields for one form; one extra call on one settings screen
 * is the cheaper of the two.
 */
export async function getProfile(): Promise<Profile> {
  failIfRequested('getProfile')
  return resolve(toProfile(await apiGet<WireCurrentUser>('getProfile', apiPath`/auth/me`)))
}

/*
 * There is no `getLastImport`, and there cannot be one.
 *
 * The fixture had a "last import" to read back because a fixture can hold anything. The API stores
 * no import history — `POST /organizations/{id}/users/import` answers with what it just did and
 * keeps nothing — and the temporary passwords the screen exists to show are generated once and are
 * never retrievable again, so an endpoint that returned them later would be a worse idea than a
 * missing one. Comp P's "Last import" panel is therefore the response to the write, held in the
 * form's own state: see `lib/server/admin-actions.ts` and `components/settings/user-import.tsx`.
 */

/**
 * The caller's own organization's scope statement, and whether assist is on for the deployment.
 *
 * Only an Org Admin's screen calls this — a Site Admin's `/settings/ai-assist` has no organization to
 * load — so the scope is the principal's organization. An empty statement is the normal case, not a
 * missing one: it means "no narrowing beyond the active idea types".
 */
export async function getAiAssist(): Promise<AiAssistSettings> {
  failIfRequested('getAiAssist')

  const scope = organizationScope()
  if (scope === null) return { scopeStatement: '', available: false }

  const settings = await apiGet<WireAiAssistSettings>(
    'getAiAssist',
    apiPath`/organizations/${scope}/ai-assist/settings`,
  )
  return { scopeStatement: settings.scopeStatement ?? '', available: settings.aiAssistAvailable }
}

const PUBLISHED_AT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
})

/**
 * The deployment's active system prompt and its history. Site Admin only, which the one screen that
 * calls this already gates on.
 *
 * **No probe results.** The probes run against a draft on demand (`POST /ai-assist/prompt/probe`)
 * and nothing stores their outcome, so there is nothing to read back before someone runs them.
 */
export async function getAiPrompt(): Promise<AiPrompt> {
  failIfRequested('getAiPrompt')

  const prompt = await apiGet<WireAiPromptSettings>('getAiPrompt', apiPath`/ai-assist/prompt`)
  return {
    text: prompt.body,
    outOfScopeRedirect: prompt.outOfScopeRedirect,
    conversationClosedRedirect: prompt.conversationClosedRedirect,
    version: prompt.version,
    isBuiltInDefault: prompt.isBuiltInDefault,
    versions: prompt.versions.map((version) => ({
      version: version.version,
      publishedAt: `${PUBLISHED_AT.format(new Date(version.createdAtUtc))} UTC`,
      author: version.createdByDisplayName ?? 'Unknown',
      active: version.isActive,
    })),
  }
}

function toUsageRow(wire: WireAiUsageSummary): UsageRow {
  const cachedTokens = wire.cacheReadInputTokens + wire.cacheCreationInputTokens
  return {
    organizationId: wire.organizationId,
    organizationName: wire.organizationName,
    conversations: wire.calls,
    inputTokens: wire.inputTokens,
    outputTokens: wire.outputTokens,
    cachedTokens,
    totalTokens: wire.inputTokens + wire.outputTokens + cachedTokens,
    estimatedCost: wire.estimatedCost,
  }
}

/**
 * The window the usage screen reports: the current UTC day, which is the day the ceiling is
 * measured on (rule 28a). The API defaults to the month, so the start is sent explicitly.
 */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Every organization's assist usage today, and the deployment's ceiling. Site Admin only. */
export async function getUsage(): Promise<Usage> {
  failIfRequested('getUsage')

  const report = await apiGet<WireAiUsageReport>(
    'getUsage',
    apiPath`/ai-assist/usage?fromUtc=${todayUtc()}`,
  )
  const rows = report.organizations.map(toUsageRow)

  return {
    rows,
    conversations: report.totals.calls,
    tokens: rows.reduce((sum, row) => sum + row.totalTokens, 0),
    estimatedCost: report.totals.estimatedCost,
    dailyTokenLimit: report.dailyTokenLimit ?? 0,
    tokensUsedToday: report.tokensUsedToday ?? 0,
  }
}

/** One organization's assist usage today, or null when it has none. */
export async function getUsageForOrganization(organizationId: string): Promise<UsageRow | null> {
  failIfRequested('getUsageForOrganization')

  const report = await apiGet<WireAiUsageReport>(
    'getUsageForOrganization',
    apiPath`/organizations/${organizationId}/ai-assist/usage?fromUtc=${todayUtc()}`,
  )
  const row = report.organizations[0]
  return row ? toUsageRow(row) : null
}
