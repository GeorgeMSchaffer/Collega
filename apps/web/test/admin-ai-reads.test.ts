import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiGet } from '@/lib/api/client'
import { getAiAssist, getAiPrompt, getUsage, getUsageForOrganization } from '@/lib/data/admin'
import { currentUser } from '@/lib/session'
import { actAs } from './support/acting-role'

/**
 * The AI settings, prompt and usage screens' readers (slice 132, `lib/data/admin.ts`): which route
 * each asks, and how the API's answer becomes what the screen draws. The API client is the
 * boundary; the clock is fixed so "today" is a fact, not a wish.
 */
vi.mock('@/lib/api/client', async (original) => ({
  ...(await original<typeof import('@/lib/api/client')>()),
  apiGet: vi.fn(),
}))

const get = vi.mocked(apiGet)

beforeEach(() => {
  get.mockReset()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-01T23:59:30Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('getAiAssist', () => {
  it('reads the acting organization settings route', async () => {
    actAs('OrgAdmin')
    get.mockResolvedValue({ scopeStatement: 'Plant floor only', aiAssistAvailable: true })
    expect(await getAiAssist()).toEqual({ scopeStatement: 'Plant floor only', available: true })
    expect(get.mock.calls[0]?.[1]).toBe(
      `/organizations/${currentUser().organizationId}/ai-assist/settings`,
    )
  })

  it('reads a null scope statement as empty, and keeps assist unavailable when the API says so', async () => {
    actAs('OrgAdmin')
    get.mockResolvedValue({ scopeStatement: null, aiAssistAvailable: false })
    expect(await getAiAssist()).toEqual({ scopeStatement: '', available: false })
  })

  it('asks nothing for an App Admin, who has no organization', async () => {
    actAs('SiteAdmin')
    expect(await getAiAssist()).toEqual({ scopeStatement: '', available: false })
    expect(get).not.toHaveBeenCalled()
  })
})

describe('getAiPrompt', () => {
  const wire = {
    body: 'You help people draft ideas.',
    outOfScopeRedirect: 'Stay on ideas.',
    conversationClosedRedirect: 'This conversation is closed.',
    version: 3,
    isBuiltInDefault: false,
    versions: [
      {
        version: 3,
        createdAtUtc: '2026-09-30T08:05:00Z',
        createdByDisplayName: 'Sam Deployment',
        isActive: true,
      },
      {
        version: 2,
        createdAtUtc: '2026-09-01T17:45:00Z',
        createdByDisplayName: null,
        isActive: false,
      },
    ],
  }

  it('reads the deployment prompt route and maps its fields', async () => {
    actAs('SiteAdmin')
    get.mockResolvedValue(wire)
    const prompt = await getAiPrompt()
    expect(get.mock.calls[0]?.[1]).toBe('/ai-assist/prompt')
    expect(prompt.text).toBe('You help people draft ideas.')
    expect(prompt.outOfScopeRedirect).toBe('Stay on ideas.')
    expect(prompt.conversationClosedRedirect).toBe('This conversation is closed.')
    expect(prompt.version).toBe(3)
    expect(prompt.isBuiltInDefault).toBe(false)
  })

  it('shows each version published time in UTC with its author, or Unknown when there is none', async () => {
    actAs('SiteAdmin')
    get.mockResolvedValue(wire)
    const { versions } = await getAiPrompt()
    // ICU joins date and time with a comma or "at" depending on its version; the rest is fixed.
    expect(versions.map((v) => v.publishedAt.replace(/,| at/, ''))).toEqual([
      '30 September 2026 08:05 UTC',
      '1 September 2026 17:45 UTC',
    ])
    expect(versions.map(({ version, author, active }) => ({ version, author, active }))).toEqual([
      { version: 3, author: 'Sam Deployment', active: true },
      { version: 2, author: 'Unknown', active: false },
    ])
  })
})

describe('getUsage', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    organizationId: 'o-1',
    organizationName: 'Acme',
    calls: 4,
    inputTokens: 1000,
    outputTokens: 500,
    cacheReadInputTokens: 200,
    cacheCreationInputTokens: 50,
    estimatedCost: 0.12,
    ...over,
  })
  const bolt = row({
    organizationId: 'o-2',
    organizationName: 'Bolt',
    calls: 1,
    inputTokens: 10,
    outputTokens: 5,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    estimatedCost: 0.01,
  })
  const report = (over: Record<string, unknown> = {}) => ({
    fromUtc: '2026-10-01',
    toUtc: '2026-10-02',
    organizations: [row(), bolt],
    dailyTokenLimit: 100_000,
    tokensUsedToday: 1_765,
    totals: { calls: 6, estimatedCost: 0.14 },
    ...over,
  })

  it('asks for today in UTC explicitly, because the API defaults to the month', async () => {
    actAs('SiteAdmin')
    get.mockResolvedValue(report())
    await getUsage()
    expect(get.mock.calls[0]?.[1]).toBe('/ai-assist/usage?fromUtc=2026-10-01')
  })

  it('rolls over to the next day at midnight UTC', async () => {
    actAs('SiteAdmin')
    get.mockResolvedValue(report())
    vi.setSystemTime(new Date('2026-10-02T00:00:00Z'))
    await getUsage()
    expect(get.mock.calls[0]?.[1]).toBe('/ai-assist/usage?fromUtc=2026-10-02')
  })

  it('counts cache reads and writes into each row cached and total tokens', async () => {
    actAs('SiteAdmin')
    get.mockResolvedValue(report())
    const { rows } = await getUsage()
    expect(rows[0]).toEqual({
      organizationId: 'o-1',
      organizationName: 'Acme',
      conversations: 4,
      inputTokens: 1000,
      outputTokens: 500,
      cachedTokens: 250,
      totalTokens: 1750,
      estimatedCost: 0.12,
    })
  })

  it('takes conversations and cost from the API totals and the token sum from the rows', async () => {
    actAs('SiteAdmin')
    get.mockResolvedValue(report())
    const usage = await getUsage()
    expect(usage.conversations).toBe(6)
    expect(usage.estimatedCost).toBe(0.14)
    expect(usage.tokens).toBe(1750 + 15)
  })

  it('carries the ceiling and the day usage against it', async () => {
    actAs('SiteAdmin')
    get.mockResolvedValue(report())
    const usage = await getUsage()
    expect(usage.dailyTokenLimit).toBe(100_000)
    expect(usage.tokensUsedToday).toBe(1765)
  })

  it('reads an absent ceiling and absent usage as zero', async () => {
    actAs('SiteAdmin')
    get.mockResolvedValue(report({ dailyTokenLimit: null, tokensUsedToday: null }))
    const usage = await getUsage()
    expect(usage.dailyTokenLimit).toBe(0)
    expect(usage.tokensUsedToday).toBe(0)
  })

  it('is empty, with zero totals, on a day nobody used assist', async () => {
    actAs('SiteAdmin')
    get.mockResolvedValue(report({ organizations: [], totals: { calls: 0, estimatedCost: 0 } }))
    expect(await getUsage()).toMatchObject({
      rows: [],
      conversations: 0,
      tokens: 0,
      estimatedCost: 0,
    })
  })
})

describe('getUsageForOrganization', () => {
  it('reads the organization own route for today', async () => {
    actAs('OrgAdmin')
    get.mockResolvedValue({ organizations: [] })
    await getUsageForOrganization('o-9')
    expect(get.mock.calls[0]?.[1]).toBe('/organizations/o-9/ai-assist/usage?fromUtc=2026-10-01')
  })

  it('is that organization single row when it has usage', async () => {
    actAs('OrgAdmin')
    get.mockResolvedValue({
      organizations: [
        {
          organizationId: 'o-9',
          organizationName: 'Zed',
          calls: 2,
          inputTokens: 3,
          outputTokens: 4,
          cacheReadInputTokens: 5,
          cacheCreationInputTokens: 6,
          estimatedCost: 1.5,
        },
      ],
    })
    expect(await getUsageForOrganization('o-9')).toMatchObject({
      organizationName: 'Zed',
      conversations: 2,
      cachedTokens: 11,
      totalTokens: 18,
      estimatedCost: 1.5,
    })
  })

  it('is null when the organization has none', async () => {
    actAs('OrgAdmin')
    get.mockResolvedValue({ organizations: [] })
    expect(await getUsageForOrganization('o-9')).toBeNull()
  })
})
