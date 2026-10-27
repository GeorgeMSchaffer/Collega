// Satisfies `LoginMessageRepository` (login-messages/ports.ts). The audience of a message is the
// Active users in its scope at the time of the read: every user for a system message.

import type { PageRequest } from '@collega/application/common'
import type {
  LoginMessageAcknowledgement,
  LoginMessageRepository,
} from '@collega/application/login-messages'
import type { LoginMessageDismissal, LoginMessageDisplay } from '@collega/domain/enums'
import type { LoginMessage, LoginMessageReceipt } from '@collega/domain/login-messages'
import type {
  login_messages as LoginMessageRow,
  Prisma,
  login_message_receipts as ReceiptRow,
} from '../generated/prisma/index.js'
import type { PrismaClient } from '../persistence/prisma-client.js'
import type { PrismaUnitOfWork } from '../persistence/unit-of-work.js'

type Scoped = Pick<LoginMessage, 'id' | 'organizationId' | 'revision'>

function fromRow(row: LoginMessageRow): LoginMessage {
  return {
    id: row.id,
    organizationId: row.organization_id,
    title: row.title,
    body: row.body,
    display: row.display as LoginMessageDisplay,
    dismissalMode: row.dismissal_mode as LoginMessageDismissal,
    startsAtUtc: row.starts_at_utc,
    endsAtUtc: row.ends_at_utc,
    revision: row.revision,
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
  }
}

function writeData(message: LoginMessage) {
  return {
    id: message.id,
    organization_id: message.organizationId,
    title: message.title,
    body: message.body,
    display: message.display,
    dismissal_mode: message.dismissalMode,
    starts_at_utc: message.startsAtUtc,
    ends_at_utc: message.endsAtUtc,
    revision: message.revision,
    created_at_utc: message.createdAtUtc,
    updated_at_utc: message.updatedAtUtc,
    created_by_user_id: message.createdByUserId,
    updated_by_user_id: message.updatedByUserId,
  }
}

function receiptFromRow(row: ReceiptRow): LoginMessageReceipt {
  return {
    messageId: row.message_id,
    userId: row.user_id,
    revision: row.revision,
    closedAtUtc: row.closed_at_utc,
    dismissedAtUtc: row.dismissed_at_utc,
    acknowledgedAtUtc: row.acknowledged_at_utc,
  }
}

function audienceWhere(organizationId: string | null): Prisma.usersWhereInput {
  return organizationId === null
    ? { status: 'Active' }
    : { status: 'Active', organization_id: organizationId }
}

function acknowledgedWhere(message: Scoped): Prisma.login_message_receiptsWhereInput {
  return {
    message_id: message.id,
    revision: message.revision,
    acknowledged_at_utc: { not: null },
    users: audienceWhere(message.organizationId),
  }
}

const userSelect = {
  id: true,
  first_name: true,
  last_name: true,
  email: true,
  organizations: { select: { title: true } },
} as const

export class PrismaLoginMessageRepository implements LoginMessageRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork,
  ) {}

  async getById(messageId: string): Promise<LoginMessage | null> {
    const row = await this.prisma.login_messages.findUnique({ where: { id: messageId } })
    return row ? fromRow(row) : null
  }

  async list(
    organizationId: string | null,
    { page, pageSize }: PageRequest,
  ): Promise<{ readonly items: readonly LoginMessage[]; readonly totalCount: number }> {
    const where = { organization_id: organizationId }
    const [rows, totalCount] = await Promise.all([
      this.prisma.login_messages.findMany({
        where,
        orderBy: [{ starts_at_utc: 'desc' }, { created_at_utc: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.login_messages.count({ where }),
    ])
    return { items: rows.map(fromRow), totalCount }
  }

  async listLive(organizationId: string | null, nowUtc: Date): Promise<readonly LoginMessage[]> {
    const rows = await this.prisma.login_messages.findMany({
      where: {
        AND: [
          {
            OR: [
              { organization_id: null },
              ...(organizationId === null ? [] : [{ organization_id: organizationId }]),
            ],
          },
          { starts_at_utc: { lte: nowUtc } },
          { OR: [{ ends_at_utc: null }, { ends_at_utc: { gt: nowUtc } }] },
        ],
      },
      orderBy: [{ starts_at_utc: 'asc' }, { created_at_utc: 'asc' }, { id: 'asc' }],
    })
    // System first; the sort is stable, so each run keeps the query's order.
    return rows
      .map(fromRow)
      .sort((a, b) => Number(a.organizationId !== null) - Number(b.organizationId !== null))
  }

  async add(message: LoginMessage): Promise<void> {
    this.unitOfWork.enqueue(this.prisma.login_messages.create({ data: writeData(message) }))
  }

  async save(message: LoginMessage): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.login_messages.update({ where: { id: message.id }, data: writeData(message) }),
    )
  }

  async remove(messageId: string): Promise<void> {
    // Receipts go with the message (ON DELETE CASCADE).
    this.unitOfWork.enqueue(this.prisma.login_messages.delete({ where: { id: messageId } }))
  }

  async listReceipts(
    userId: string,
    messageIds: readonly string[],
  ): Promise<readonly LoginMessageReceipt[]> {
    const rows = await this.prisma.login_message_receipts.findMany({
      where: { user_id: userId, message_id: { in: [...messageIds] } },
    })
    return rows.map(receiptFromRow)
  }

  async saveReceipt(receipt: LoginMessageReceipt): Promise<void> {
    const data = {
      revision: receipt.revision,
      closed_at_utc: receipt.closedAtUtc,
      dismissed_at_utc: receipt.dismissedAtUtc,
      acknowledged_at_utc: receipt.acknowledgedAtUtc,
    }
    this.unitOfWork.enqueue(
      this.prisma.login_message_receipts.upsert({
        where: { message_id_user_id: { message_id: receipt.messageId, user_id: receipt.userId } },
        create: { message_id: receipt.messageId, user_id: receipt.userId, ...data },
        update: data,
      }),
    )
  }

  async countAudience(organizationId: string | null): Promise<number> {
    return this.prisma.users.count({ where: audienceWhere(organizationId) })
  }

  async countAcknowledged(messages: readonly Scoped[]): Promise<ReadonlyMap<string, number>> {
    const counts = await Promise.all(
      messages.map(
        async (message) =>
          [
            message.id,
            await this.prisma.login_message_receipts.count({ where: acknowledgedWhere(message) }),
          ] as const,
      ),
    )
    return new Map(counts)
  }

  async listAcknowledgements(
    message: Scoped,
    { page, pageSize }: PageRequest,
  ): Promise<{
    readonly items: readonly LoginMessageAcknowledgement[]
    readonly totalCount: number
  }> {
    // Two ordered runs, acknowledged first (by time), then everyone else (by name), paged as one.
    const audience = audienceWhere(message.organizationId)
    const notAcknowledged: Prisma.usersWhereInput = {
      ...audience,
      login_message_receipts: {
        none: {
          message_id: message.id,
          revision: message.revision,
          acknowledged_at_utc: { not: null },
        },
      },
    }
    const [acknowledgedCount, totalCount] = await Promise.all([
      this.prisma.login_message_receipts.count({ where: acknowledgedWhere(message) }),
      this.prisma.users.count({ where: audience }),
    ])

    const skip = (page - 1) * pageSize
    const items: LoginMessageAcknowledgement[] = []
    if (skip < acknowledgedCount) {
      const rows = await this.prisma.login_message_receipts.findMany({
        where: acknowledgedWhere(message),
        orderBy: [{ acknowledged_at_utc: 'asc' }, { user_id: 'asc' }],
        skip,
        take: pageSize,
        select: { acknowledged_at_utc: true, users: { select: userSelect } },
      })
      for (const row of rows) {
        items.push(toAcknowledgement(row.users, row.acknowledged_at_utc))
      }
    }
    const remaining = pageSize - items.length
    if (remaining > 0) {
      const rows = await this.prisma.users.findMany({
        where: notAcknowledged,
        orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }, { email: 'asc' }],
        skip: Math.max(0, skip - acknowledgedCount),
        take: remaining,
        select: userSelect,
      })
      for (const row of rows) {
        items.push(toAcknowledgement(row, null))
      }
    }
    return { items, totalCount }
  }
}

function toAcknowledgement(
  user: {
    id: string
    first_name: string
    last_name: string
    email: string
    organizations: { title: string } | null
  },
  acknowledgedAtUtc: Date | null,
): LoginMessageAcknowledgement {
  return {
    userId: user.id,
    name: `${user.first_name} ${user.last_name}`,
    email: user.email,
    organizationName: user.organizations?.title ?? null,
    acknowledgedAtUtc,
  }
}
