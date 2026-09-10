import { Badge, Card, CardContent, Meter } from '@collega/design-system'
import { AdminTable, SettingsPage, Th } from '@/components/settings/settings-page'
import {
  compactTokens,
  DAILY_TOKEN_BUDGET,
  getUsage,
  getUsageForOrganization,
  totalTokens,
} from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { currentUser } from '@/lib/session'

export const metadata = { title: 'API usage · Collega' }

/**
 * The usage meter of rule 28d: a Site Admin reads every organization's consumption, an Org Admin
 * their own and no other. Counts only, never prompt or transcript content (28e).
 */
export default async function ApiUsagePage() {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const siteAdmin = currentUser().role === 'SiteAdmin'

  return (
    <SettingsPage
      title="API usage"
      gate="API usage"
      lead="AI assist token consumption and estimated cost for today."
      actions={<Badge variant="outline">Read-only</Badge>}
    >
      {siteAdmin ? <DeploymentUsage /> : <OrganizationUsage />}
    </SettingsPage>
  )
}

/** A display threshold for the bar's colour only — the server's cap is rule 28a's ceiling. */
function budgetVariant(pct: number): 'ok' | 'warn' | 'over' {
  if (pct >= 100) return 'over'
  if (pct >= 80) return 'warn'
  return 'ok'
}

async function DeploymentUsage() {
  const usage = await getUsage()
  const pct = usage.pctOfBudget

  return (
    <>
      <Card className="max-w-[560px]">
        <CardContent className="flex flex-col gap-3">
          <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Today &middot; all organizations
          </div>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums">
              {compactTokens(usage.tokens)}
            </span>
            <span className="text-sm text-muted-foreground">
              of {compactTokens(DAILY_TOKEN_BUDGET)} tokens
            </span>
            <span className="ml-auto text-sm font-semibold tabular-nums">{Math.round(pct)}%</span>
          </div>
          <Meter pct={pct} variant={budgetVariant(pct)} />
          <p className="m-0 text-xs text-muted-foreground">
            The daily cap is a deployment setting, not a per-organization one. Crossing it stops
            assist for everyone until the window rolls over at midnight UTC.
          </p>
        </CardContent>
      </Card>

      <AdminTable summary="Estimated cost is computed from published token prices and is not a bill.">
        <thead>
          <tr className="border-b bg-muted/40">
            <Th>Organization</Th>
            <Th className="w-32 text-right">Conversations</Th>
            <Th className="w-24 text-right">Input</Th>
            <Th className="w-24 text-right">Output</Th>
            <Th className="w-24 text-right">Cached</Th>
            <Th className="w-32 text-right">Total tokens</Th>
            <Th className="w-32 text-right">Estimated cost</Th>
          </tr>
        </thead>
        <tbody>
          {usage.rows.map((row) => (
            <tr key={row.organizationId} className="border-b last:border-0">
              <td className="px-4 py-2.5 font-medium">{row.organizationName}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{row.conversations}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {compactTokens(row.inputTokens)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {compactTokens(row.outputTokens)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {compactTokens(row.cachedTokens)}
              </td>
              <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                {compactTokens(totalTokens(row))}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                ${row.estimatedCost.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/40">
            <td className="px-4 py-2.5 font-medium">All organizations</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{usage.conversations}</td>
            <td colSpan={3} className="px-4 py-2.5 text-right text-xs text-muted-foreground">
              summed into Total tokens
            </td>
            <td className="px-4 py-2.5 text-right font-medium tabular-nums">
              {compactTokens(usage.tokens)}
            </td>
            <td className="px-4 py-2.5 text-right font-medium tabular-nums">
              ${usage.estimatedCost.toFixed(2)}
            </td>
          </tr>
        </tfoot>
      </AdminTable>
    </>
  )
}

async function OrganizationUsage() {
  const row = await getUsageForOrganization('acme-robotics')

  // No budget card: the cap is deployment-wide (28a), so showing an Org Admin a bar they share with
  // organizations they cannot see would read as their own allowance.
  if (!row) {
    return (
      <p className="m-0 max-w-prose text-sm text-muted-foreground">
        No assist usage recorded for {currentUser().organizationName} today.
      </p>
    )
  }

  return (
    <AdminTable
      summary={`${currentUser().organizationName}, today. Estimated cost is computed from published token prices and is not a bill.`}
    >
      <thead>
        <tr className="border-b bg-muted/40">
          <Th className="w-40 text-right">Conversations</Th>
          <Th className="w-28 text-right">Input</Th>
          <Th className="w-28 text-right">Output</Th>
          <Th className="w-28 text-right">Cached</Th>
          <Th className="w-36 text-right">Total tokens</Th>
          <Th className="w-36 text-right">Estimated cost</Th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="px-4 py-2.5 text-right tabular-nums">{row.conversations}</td>
          <td className="px-4 py-2.5 text-right tabular-nums">{compactTokens(row.inputTokens)}</td>
          <td className="px-4 py-2.5 text-right tabular-nums">{compactTokens(row.outputTokens)}</td>
          <td className="px-4 py-2.5 text-right tabular-nums">{compactTokens(row.cachedTokens)}</td>
          <td className="px-4 py-2.5 text-right font-medium tabular-nums">
            {compactTokens(totalTokens(row))}
          </td>
          <td className="px-4 py-2.5 text-right tabular-nums">${row.estimatedCost.toFixed(2)}</td>
        </tr>
      </tbody>
    </AdminTable>
  )
}
