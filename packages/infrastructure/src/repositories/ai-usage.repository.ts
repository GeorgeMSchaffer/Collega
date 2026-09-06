// Satisfies `AiUsageRepository` (ai/ports.ts). `ai_usage_records` declares no Prisma relation to
// `organizations` in the frozen schema (a plain `organization_id` column, no `@relation`), so
// `getUsageByOrganization` cannot join for the organization name through Prisma's typed API - it
// fetches matching usage rows, aggregates them in application code using the domain's own
// `totalTokensOf`/`estimatedCostOf` (so the cost math is not duplicated here), then looks up the
// involved organizations' titles by id.

import { randomUUID } from 'node:crypto'
import type { AiCallCounts, AiUsageRepository, AiUsageSummary } from '@collega/application/ai'
import type { AiUsageRecord } from '@collega/domain/ai'
import { estimatedCostOf } from '@collega/domain/ai'
import type { AiCallOutcome, AiKeySource } from '@collega/domain/enums'
import type { ai_usage_records as UsageRow } from '../generated/prisma/index.js'
import type { PrismaClient } from '../persistence/prisma-client.js'
import type { PrismaUnitOfWork } from '../persistence/unit-of-work.js'

function fromRow(row: UsageRow): AiUsageRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    actorUserId: row.actor_user_id,
    onBehalfOfUserId: row.on_behalf_of_user_id,
    boardId: row.board_id,
    occurredAtUtc: row.occurred_at_utc,
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheReadInputTokens: row.cache_read_input_tokens,
    cacheCreationInputTokens: row.cache_creation_input_tokens,
    inputRatePerMillion: Number(row.input_rate_per_million),
    outputRatePerMillion: Number(row.output_rate_per_million),
    keySource: row.key_source as AiKeySource,
    outcome: row.outcome as AiCallOutcome,
  }
}

export class PrismaAiUsageRepository implements AiUsageRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork,
  ) {}

  async add(record: AiUsageRecord): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.ai_usage_records.create({
        data: {
          id: record.id || randomUUID(),
          organization_id: record.organizationId,
          actor_user_id: record.actorUserId,
          on_behalf_of_user_id: record.onBehalfOfUserId,
          board_id: record.boardId,
          occurred_at_utc: record.occurredAtUtc,
          model: record.model,
          input_tokens: record.inputTokens,
          output_tokens: record.outputTokens,
          cache_read_input_tokens: record.cacheReadInputTokens,
          cache_creation_input_tokens: record.cacheCreationInputTokens,
          input_rate_per_million: record.inputRatePerMillion,
          output_rate_per_million: record.outputRatePerMillion,
          key_source: record.keySource,
          outcome: record.outcome,
        },
      }),
    )
  }

  async getTotalTokensSince(fromUtc: Date): Promise<number> {
    const result = await this.prisma.ai_usage_records.aggregate({
      where: { occurred_at_utc: { gte: fromUtc } },
      _sum: {
        input_tokens: true,
        output_tokens: true,
        cache_read_input_tokens: true,
        cache_creation_input_tokens: true,
      },
    })
    return (
      (result._sum.input_tokens ?? 0) +
      (result._sum.output_tokens ?? 0) +
      (result._sum.cache_read_input_tokens ?? 0) +
      (result._sum.cache_creation_input_tokens ?? 0)
    )
  }

  async getUsageByOrganization(
    fromUtc: Date,
    toUtc: Date,
    organizationId?: string | null,
  ): Promise<readonly AiUsageSummary[]> {
    const rows = await this.prisma.ai_usage_records.findMany({
      where: {
        occurred_at_utc: { gte: fromUtc, lt: toUtc },
        ...(organizationId ? { organization_id: organizationId } : {}),
      },
    })
    if (rows.length === 0) {
      return []
    }

    const byOrganization = new Map<string, AiUsageRecord[]>()
    for (const row of rows) {
      const record = fromRow(row)
      const bucket = byOrganization.get(record.organizationId)
      if (bucket) {
        bucket.push(record)
      } else {
        byOrganization.set(record.organizationId, [record])
      }
    }

    const organizations = await this.prisma.organizations.findMany({
      where: { id: { in: [...byOrganization.keys()] } },
      select: { id: true, title: true },
    })
    const titleById = new Map(organizations.map((o) => [o.id, o.title]))

    const summaries: AiUsageSummary[] = []
    for (const [orgId, records] of byOrganization) {
      let inputTokens = 0
      let outputTokens = 0
      let cacheReadInputTokens = 0
      let cacheCreationInputTokens = 0
      let estimatedCost = 0
      for (const record of records) {
        inputTokens += record.inputTokens
        outputTokens += record.outputTokens
        cacheReadInputTokens += record.cacheReadInputTokens
        cacheCreationInputTokens += record.cacheCreationInputTokens
        estimatedCost += estimatedCostOf(record)
      }
      summaries.push({
        organizationId: orgId,
        organizationName: titleById.get(orgId) ?? orgId,
        calls: records.length,
        inputTokens,
        outputTokens,
        cacheReadInputTokens,
        cacheCreationInputTokens,
        estimatedCost,
      })
    }

    return summaries.sort(
      (a, b) =>
        b.inputTokens +
        b.outputTokens +
        b.cacheReadInputTokens +
        b.cacheCreationInputTokens -
        (a.inputTokens + a.outputTokens + a.cacheReadInputTokens + a.cacheCreationInputTokens),
    )
  }

  async countCallsSince(
    organizationId: string,
    actorUserId: string | null,
    fromUtc: Date,
  ): Promise<AiCallCounts> {
    const [organizationCalls, actorCalls] = await Promise.all([
      this.prisma.ai_usage_records.count({
        where: { organization_id: organizationId, occurred_at_utc: { gte: fromUtc } },
      }),
      this.prisma.ai_usage_records.count({
        where: {
          organization_id: organizationId,
          actor_user_id: actorUserId,
          occurred_at_utc: { gte: fromUtc },
        },
      }),
    ])
    return { organizationCalls, actorCalls }
  }

  async getRecentOutcomes(
    organizationId: string,
    actorUserId: string | null,
    boardId: string,
    limit: number,
    fromUtc: Date,
  ): Promise<readonly AiCallOutcome[]> {
    const rows = await this.prisma.ai_usage_records.findMany({
      where: {
        organization_id: organizationId,
        actor_user_id: actorUserId,
        board_id: boardId,
        occurred_at_utc: { gte: fromUtc },
      },
      orderBy: { occurred_at_utc: 'desc' },
      take: limit,
      select: { outcome: true },
    })
    return rows.map((r) => r.outcome as AiCallOutcome)
  }
}
