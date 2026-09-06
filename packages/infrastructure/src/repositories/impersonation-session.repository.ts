// Satisfies `ImpersonationSessionRepository` (impersonation/ports.ts). `add` is the write path
// that can race against `ux_impersonation_sessions_real_user_id_open` - two concurrent starts can
// both pass `getOpenForRealUser`'s read-then-write check, and the loser's `saveChanges()` (via
// `PrismaUnitOfWork`, which centrally translates the three known partial-index violations) turns
// into the kernel's `ConflictError` rather than a raw constraint error.

import type { ImpersonationSessionRepository } from '@collega/application/impersonation'
import type { ImpersonationEndReason } from '@collega/domain/enums'
import type { ImpersonationSession } from '@collega/domain/impersonation'
import type { impersonation_sessions as SessionRow } from '../generated/prisma/index.js'
import type { PrismaClient } from '../persistence/prisma-client.js'
import type { PrismaUnitOfWork } from '../persistence/unit-of-work.js'

function fromRow(row: SessionRow): ImpersonationSession {
  return {
    id: row.id,
    realUserId: row.real_user_id,
    targetUserId: row.target_user_id,
    startedAtUtc: row.started_at_utc,
    lastSeenAtUtc: row.last_seen_at_utc,
    absoluteExpiresAtUtc: row.absolute_expires_at_utc,
    endedAtUtc: row.ended_at_utc,
    endReason: row.end_reason as ImpersonationEndReason | null,
  }
}

export class PrismaImpersonationSessionRepository implements ImpersonationSessionRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork,
  ) {}

  async getOpenForRealUser(realUserId: string): Promise<ImpersonationSession | null> {
    const row = await this.prisma.impersonation_sessions.findFirst({
      where: { real_user_id: realUserId, ended_at_utc: null },
    })
    return row ? fromRow(row) : null
  }

  async add(session: ImpersonationSession): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.impersonation_sessions.create({
        data: {
          id: session.id,
          real_user_id: session.realUserId,
          target_user_id: session.targetUserId,
          started_at_utc: session.startedAtUtc,
          last_seen_at_utc: session.lastSeenAtUtc,
          absolute_expires_at_utc: session.absoluteExpiresAtUtc,
          ended_at_utc: session.endedAtUtc,
          end_reason: session.endReason,
        },
      }),
    )
  }

  async update(session: ImpersonationSession): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.impersonation_sessions.update({
        where: { id: session.id },
        data: {
          last_seen_at_utc: session.lastSeenAtUtc,
          ended_at_utc: session.endedAtUtc,
          end_reason: session.endReason,
        },
      }),
    )
  }
}
