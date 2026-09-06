// Satisfies `AiPromptVersionRepository` (ai/ports.ts). `add`'s possible violation of the partial
// unique index `ux_ai_prompt_versions_active` (`WHERE is_active`) is translated to the kernel's
// `ConflictError` centrally, in `PrismaUnitOfWork.saveChanges` - not caught here, since `add` only
// enqueues; the write (and any error it produces) happens when the caller's unit of work commits.

import type { AiPromptVersionRepository } from '@collega/application/ai'
import type { AiPromptVersion } from '@collega/domain/ai'
import type { ai_prompt_versions as PromptVersionRow } from '../generated/prisma/index.js'
import type { PrismaClient } from '../persistence/prisma-client.js'
import type { PrismaUnitOfWork } from '../persistence/unit-of-work.js'

function fromRow(row: PromptVersionRow): AiPromptVersion {
  return {
    id: row.id,
    version: row.version,
    body: row.body,
    outOfScopeRedirect: row.out_of_scope_redirect,
    conversationClosedRedirect: row.conversation_closed_redirect,
    isActive: row.is_active,
    createdAtUtc: row.created_at_utc,
    createdByUserId: row.created_by_user_id,
  }
}

export class PrismaAiPromptVersionRepository implements AiPromptVersionRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork,
  ) {}

  async getActive(): Promise<AiPromptVersion | null> {
    const row = await this.prisma.ai_prompt_versions.findFirst({ where: { is_active: true } })
    return row ? fromRow(row) : null
  }

  async list(): Promise<readonly AiPromptVersion[]> {
    const rows = await this.prisma.ai_prompt_versions.findMany({ orderBy: { version: 'desc' } })
    return rows.map(fromRow)
  }

  async getByVersion(version: number): Promise<AiPromptVersion | null> {
    const row = await this.prisma.ai_prompt_versions.findUnique({ where: { version } })
    return row ? fromRow(row) : null
  }

  async getMaxVersion(): Promise<number> {
    const result = await this.prisma.ai_prompt_versions.aggregate({ _max: { version: true } })
    return result._max.version ?? 0
  }

  async add(version: AiPromptVersion): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.ai_prompt_versions.create({
        data: {
          id: version.id,
          version: version.version,
          body: version.body,
          out_of_scope_redirect: version.outOfScopeRedirect,
          conversation_closed_redirect: version.conversationClosedRedirect,
          is_active: version.isActive,
          created_at_utc: version.createdAtUtc,
          created_by_user_id: version.createdByUserId,
        },
      }),
    )
  }

  async deactivateAll(): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.ai_prompt_versions.updateMany({
        where: { is_active: true },
        data: { is_active: false },
      }),
    )
  }
}
