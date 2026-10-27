import type { LoginMessage, LoginMessageReceipt } from '@collega/domain/login-messages'
import type { PageRequest } from '../common/index.js'
import type { LoginMessageAcknowledgement } from './models.js'

export interface LoginMessageRepository {
  getById(messageId: string): Promise<LoginMessage | null>

  /** One scope's messages (`null` = system), newest `startsAtUtc` first, then newest created, then id. */
  list(
    organizationId: string | null,
    page: PageRequest,
  ): Promise<{ readonly items: readonly LoginMessage[]; readonly totalCount: number }>

  /**
   * Live system messages plus, when `organizationId` is set, that organization's, in display order
   * (LMS-3b): system first, then `startsAtUtc`, then `createdAtUtc`, then id.
   */
  listLive(organizationId: string | null, nowUtc: Date): Promise<readonly LoginMessage[]>

  add(message: LoginMessage): Promise<void>

  save(message: LoginMessage): Promise<void>

  /** Removes the message and its receipts. */
  remove(messageId: string): Promise<void>

  /** The user's receipts for the given messages, whatever their revision. */
  listReceipts(
    userId: string,
    messageIds: readonly string[],
  ): Promise<readonly LoginMessageReceipt[]>

  /** Inserts or replaces the user's one receipt for the message. */
  saveReceipt(receipt: LoginMessageReceipt): Promise<void>

  /** Active users in scope now: every user for a system message, else the organization's. */
  countAudience(organizationId: string | null): Promise<number>

  /** Active users in scope with an acknowledgement for each message's current revision. */
  countAcknowledged(
    messages: readonly Pick<LoginMessage, 'id' | 'organizationId' | 'revision'>[],
  ): Promise<ReadonlyMap<string, number>>

  /** The audience with each one's acknowledgement for the current revision: acknowledged first. */
  listAcknowledgements(
    message: Pick<LoginMessage, 'id' | 'organizationId' | 'revision'>,
    page: PageRequest,
  ): Promise<{
    readonly items: readonly LoginMessageAcknowledgement[]
    readonly totalCount: number
  }>
}
