/**
 * The administration surfaces: organizations, members, idea types, fields, the profile, the user
 * import, and the two AI settings screens plus their usage meter.
 *
 * Organizations and members are real now; the catalogs and the AI screens are still fixtures.
 *
 * `getUsage` returns the rows and the totals together. The totals are derived from the rows, and
 * deriving them here rather than in each caller is what stops the budget card and the table footer
 * disagreeing — they render side by side on the same screen.
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
  WireCurrentUser,
  WireFieldDefinition,
  WireIdeaType,
  WireOrganizationDetail,
  WireOrganizationListItem,
  WirePage,
  WireUserListItem,
} from '../api/wire'
import * as fixture from '../mock'
import { currentUser } from '../session'
import type { FieldDefinition, IdeaType, Member, Organization, Profile } from '../types'
import { failIfRequested, resolve } from './latency'
import { everyOrganization, organizationScope } from './scope'

export type { Probe, PromptVersion, UsageRow } from '../mock'
export {
  compactTokens,
  DAILY_TOKEN_BUDGET,
  SCOPE_STATEMENT_MAX,
  SYSTEM_PROMPT_MAX,
  totalTokens,
} from '../mock'
export type {
  FieldDefinition,
  IdeaType,
  ImportOutcome,
  ImportRow,
  Member,
  Organization,
  Profile,
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
    apiPath`/organizations?pageSize=100`,
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
        apiPath`/organizations/${organization.id}/users?pageSize=100`,
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
    apiPath`/organizations/${organizationId}/users?pageSize=100`,
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

export async function getAiAssist(): Promise<typeof fixture.aiAssist> {
  failIfRequested('getAiAssist')
  return resolve(fixture.aiAssist)
}

export async function getAiPrompt(): Promise<{
  prompt: typeof fixture.aiPrompt
  probes: fixture.Probe[]
  versions: fixture.PromptVersion[]
}> {
  failIfRequested('getAiPrompt')
  return resolve({
    prompt: fixture.aiPrompt,
    probes: fixture.aiProbes,
    versions: fixture.promptVersions,
  })
}

export async function getUsage(): Promise<{
  rows: fixture.UsageRow[]
  conversations: number
  tokens: number
  estimatedCost: number
  pctOfBudget: number
}> {
  failIfRequested('getUsage')
  return resolve({
    rows: fixture.usageRows,
    conversations: fixture.usageTotals.conversations,
    tokens: fixture.usageTotals.tokens,
    estimatedCost: fixture.usageTotals.estimatedCost,
    pctOfBudget: fixture.usageTotals.pctOfBudget,
  })
}

export async function getUsageForOrganization(
  organizationId: string,
): Promise<fixture.UsageRow | null> {
  failIfRequested('getUsageForOrganization')
  return resolve(fixture.usageForOrganization(organizationId) ?? null)
}
