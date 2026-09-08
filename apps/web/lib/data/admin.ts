/**
 * The administration surfaces: organizations, members, idea types, fields, the profile, the user
 * import, and the two AI settings screens plus their usage meter.
 *
 * `getUsage` returns the rows and the totals together. The totals are derived from the rows, and
 * deriving them here rather than in each caller is what stops the budget card and the table footer
 * disagreeing — they render side by side on the same screen.
 */

import * as fixture from '../mock.js'
import { failIfRequested, resolve } from './latency.js'

export type {
  FieldDefinition,
  IdeaType,
  ImportRow,
  Member,
  Organization,
  Probe,
  Profile,
  PromptVersion,
  UsageRow,
} from '../mock.js'
export {
  compactTokens,
  DAILY_TOKEN_BUDGET,
  SCOPE_STATEMENT_MAX,
  SYSTEM_PROMPT_MAX,
  totalTokens,
} from '../mock.js'

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

export async function getIdeaTypes(): Promise<fixture.IdeaType[]> {
  failIfRequested('getIdeaTypes')
  return resolve(fixture.ideaTypes)
}

export async function getFieldDefinitions(): Promise<fixture.FieldDefinition[]> {
  failIfRequested('getFieldDefinitions')
  return resolve(fixture.fieldDefinitions)
}

export async function getProfile(): Promise<fixture.Profile> {
  failIfRequested('getProfile')
  return resolve(fixture.profile)
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
