/**
 * The administration surfaces: organizations, members, idea types, fields, the profile, the user
 * import, and the two AI settings screens plus their usage meter.
 *
 * `getUsage` returns the rows and the totals together. The totals are derived from the rows, and
 * deriving them here rather than in each caller is what stops the budget card and the table footer
 * disagreeing — they render side by side on the same screen.
 */

import { toFieldDefinition, toIdeaType, toProfile } from '../api/adapt'
import { apiGet, apiPath } from '../api/client'
import type { WireCurrentUser, WireFieldDefinition, WireIdeaType } from '../api/wire'
import * as fixture from '../mock'
import type { FieldDefinition, IdeaType, Profile } from '../types'
import { failIfRequested, resolve } from './latency'
import { everyOrganization, organizationScope } from './scope'

export type {
  ImportRow,
  Member,
  Organization,
  Probe,
  PromptVersion,
  UsageRow,
} from '../mock'
export {
  compactTokens,
  DAILY_TOKEN_BUDGET,
  SCOPE_STATEMENT_MAX,
  SYSTEM_PROMPT_MAX,
  totalTokens,
} from '../mock'
export type { FieldDefinition, IdeaType, Profile } from '../types'

export async function getOrganizations(): Promise<fixture.Organization[]> {
  failIfRequested('getOrganizations')
  return resolve(fixture.organizations)
}

export async function getMembers(): Promise<fixture.Member[]> {
  failIfRequested('getMembers')
  return resolve(fixture.members)
}

export async function getMembersForOrganization(organizationId: string): Promise<fixture.Member[]> {
  failIfRequested('getMembersForOrganization')
  return resolve(fixture.membersForOrganization(organizationId))
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

export async function getLastImport(): Promise<{
  completedAt: string
  rows: fixture.ImportRow[]
  created: number
  rejected: number
}> {
  failIfRequested('getLastImport')
  return resolve({
    completedAt: fixture.lastImport.completedAt,
    rows: fixture.lastImport.rows,
    created: fixture.importCounts.created,
    rejected: fixture.importCounts.rejected,
  })
}

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
