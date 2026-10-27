// Sign-in message use cases (SPEC/20-feature-login-messages.md, SPEC/contracts/login-messages.md).
// System messages are a Site Admin's acting directly; organization messages an in-scope Org
// Admin's. Every signed-in user reads, closes and acknowledges their own visible messages, except
// through View As (LMS-3f).

import { randomUUID } from 'node:crypto'
import { LoginMessageDismissal, Role } from '@collega/domain/enums'
import {
  createLoginMessage,
  isHiddenFor,
  isLive,
  type LoginMessage,
  LoginMessageInvariantError,
  type LoginMessageReceipt,
  loginMessageState,
  recordAcknowledgement,
  recordClose,
  updateLoginMessage,
} from '@collega/domain/login-messages'
import {
  type AuditEventWriter,
  attributeAudit,
  type Clock,
  type CurrentUserContext,
  ForbiddenError,
  NotFoundError,
  normalizePageRequest,
  type Page,
  type PageRequest,
  toPage,
  UnauthorizedError,
  type UnitOfWork,
  UnprocessableError,
  ValidationError,
} from '../common/index.js'
import type {
  LoginMessageAcknowledgementReport,
  LoginMessageInput,
  LoginMessageItem,
  UpdateLoginMessageCommand,
  VisibleLoginMessage,
} from './models.js'
import type { LoginMessageRepository } from './ports.js'

const ACKNOWLEDGE_NOT_REQUIRED = 'acknowledgeNotRequired'

export class LoginMessageService {
  constructor(
    private readonly messages: LoginMessageRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditEvents: AuditEventWriter,
    private readonly currentUser: CurrentUserContext,
    private readonly clock: Clock,
  ) {}

  async listSystem(page?: Partial<PageRequest>): Promise<Page<LoginMessageItem>> {
    this.ensureManagesScope(null)
    return this.listScope(null, page)
  }

  async listForOrganization(
    organizationId: string,
    page?: Partial<PageRequest>,
  ): Promise<Page<LoginMessageItem>> {
    this.ensureManagesScope(organizationId)
    return this.listScope(organizationId, page)
  }

  async createSystem(input: LoginMessageInput): Promise<LoginMessageItem> {
    this.ensureManagesScope(null)
    return this.create(null, input)
  }

  async createForOrganization(
    organizationId: string,
    input: LoginMessageInput,
  ): Promise<LoginMessageItem> {
    this.ensureManagesScope(organizationId)
    return this.create(organizationId, input)
  }

  async get(messageId: string): Promise<LoginMessageItem> {
    const message = await this.loadManaged(messageId)
    return (await this.toItems([message]))[0] as LoginMessageItem
  }

  async update(messageId: string, command: UpdateLoginMessageCommand): Promise<LoginMessageItem> {
    const existing = await this.loadManaged(messageId)
    const now = this.clock.now()
    const updated = runDomain(() =>
      updateLoginMessage(existing, command, command.showAgain, now, this.currentUser.userId),
    )

    await this.messages.save(updated)
    await this.unitOfWork.saveChanges()
    await this.audit(
      'LoginMessageUpdated',
      updated,
      `Sign-in message '${updated.title}' updated.`,
      now,
      {
        showAgain: command.showAgain,
        revision: updated.revision,
      },
    )
    return (await this.toItems([updated]))[0] as LoginMessageItem
  }

  async delete(messageId: string): Promise<void> {
    const existing = await this.loadManaged(messageId)
    const now = this.clock.now()
    await this.messages.remove(existing.id)
    await this.unitOfWork.saveChanges()
    await this.audit(
      'LoginMessageDeleted',
      existing,
      `Sign-in message '${existing.title}' deleted.`,
      now,
      { title: existing.title },
    )
  }

  async acknowledgements(
    messageId: string,
    page?: Partial<PageRequest>,
  ): Promise<LoginMessageAcknowledgementReport> {
    const message = await this.loadManaged(messageId)
    if (message.dismissalMode !== LoginMessageDismissal.AcknowledgeRequired) {
      throw new UnprocessableError(ACKNOWLEDGE_NOT_REQUIRED)
    }
    const request = normalizePageRequest(page)
    const [audienceCount, acknowledged, listed] = await Promise.all([
      this.messages.countAudience(message.organizationId),
      this.messages.countAcknowledged([message]),
      this.messages.listAcknowledgements(message, request),
    ])
    return {
      acknowledgedCount: acknowledged.get(message.id) ?? 0,
      audienceCount,
      ...toPage(listed.items, listed.totalCount, request),
    }
  }

  /** LMS-3: the caller's live, unhidden messages in display order. Empty during View As. */
  async listVisible(): Promise<readonly VisibleLoginMessage[]> {
    this.ensureAuthenticated()
    if (this.currentUser.isImpersonating) return []

    const userId = this.currentUser.userId as string
    const now = this.clock.now()
    const signedInAt = this.currentUser.signedInAtUtc ?? new Date(0)
    const live = await this.messages.listLive(this.currentUser.organizationId, now)
    if (live.length === 0) return []

    const receipts = await this.messages.listReceipts(
      userId,
      live.map((message) => message.id),
    )
    const byMessage = new Map(receipts.map((receipt) => [receipt.messageId, receipt]))
    return live
      .filter((message) => !isHiddenFor(message, byMessage.get(message.id) ?? null, signedInAt))
      .map((message) => ({
        id: message.id,
        scope: message.organizationId === null ? ('System' as const) : ('Organization' as const),
        title: message.title,
        body: message.body,
        display: message.display,
        dismissalMode: message.dismissalMode,
        revision: message.revision,
      }))
  }

  async close(messageId: string): Promise<void> {
    await this.recordReceipt(messageId, (message, userId, receipt, now) =>
      recordClose(message, userId, receipt, now),
    )
  }

  async acknowledge(messageId: string): Promise<void> {
    await this.recordReceipt(messageId, (message, userId, receipt, now) => {
      if (message.dismissalMode !== LoginMessageDismissal.AcknowledgeRequired) {
        throw new UnprocessableError(ACKNOWLEDGE_NOT_REQUIRED)
      }
      return recordAcknowledgement(message, userId, receipt, now)
    })
  }

  private async recordReceipt(
    messageId: string,
    apply: (
      message: LoginMessage,
      userId: string,
      receipt: LoginMessageReceipt | null,
      now: Date,
    ) => LoginMessageReceipt,
  ): Promise<void> {
    this.ensureAuthenticated()
    if (this.currentUser.isImpersonating) {
      throw new ForbiddenError('Sign-in messages cannot be closed or acknowledged through View As.')
    }
    const userId = this.currentUser.userId as string
    const now = this.clock.now()
    const message = await this.messages.getById(messageId)
    if (!message || !this.reaches(message) || !isLive(message, now)) {
      throw new NotFoundError('Sign-in message not found.')
    }
    const [receipt] = await this.messages.listReceipts(userId, [message.id])
    await this.messages.saveReceipt(apply(message, userId, receipt ?? null, now))
    await this.unitOfWork.saveChanges()
  }

  private async create(
    organizationId: string | null,
    input: LoginMessageInput,
  ): Promise<LoginMessageItem> {
    const now = this.clock.now()
    const message = runDomain(() =>
      createLoginMessage({
        ...input,
        id: randomUUID(),
        organizationId,
        nowUtc: now,
        actorUserId: this.currentUser.userId,
      }),
    )
    await this.messages.add(message)
    await this.unitOfWork.saveChanges()
    await this.audit(
      'LoginMessageCreated',
      message,
      `Sign-in message '${message.title}' created.`,
      now,
      {
        scope: organizationId === null ? 'System' : 'Organization',
        display: message.display,
        dismissalMode: message.dismissalMode,
      },
    )
    return (await this.toItems([message]))[0] as LoginMessageItem
  }

  private async listScope(
    organizationId: string | null,
    page: Partial<PageRequest> | undefined,
  ): Promise<Page<LoginMessageItem>> {
    const request = normalizePageRequest(page)
    const { items, totalCount } = await this.messages.list(organizationId, request)
    return toPage(await this.toItems(items), totalCount, request)
  }

  /** Loads a message the caller manages; one outside their scope is `404`, as the contract says. */
  private async loadManaged(messageId: string): Promise<LoginMessage> {
    this.ensureAuthenticated()
    const message = await this.messages.getById(messageId)
    if (!message) throw new NotFoundError('Sign-in message not found.')
    if (
      message.organizationId !== null &&
      this.currentUser.organizationId !== message.organizationId
    ) {
      // A Site Admin acting directly has no organization: refused rather than told it is missing.
      if (this.currentUser.role === Role.SiteAdmin) this.ensureManagesScope(message.organizationId)
      throw new NotFoundError('Sign-in message not found.')
    }
    this.ensureManagesScope(message.organizationId)
    return message
  }

  /** LMS-1b, LMS-2b/c: a system message is a direct Site Admin's; an organization's, its Org Admin's. */
  private ensureManagesScope(organizationId: string | null): void {
    this.ensureAuthenticated()
    if (organizationId === null) {
      if (this.currentUser.role !== Role.SiteAdmin) {
        throw new ForbiddenError('Only a Site Admin can manage system sign-in messages.')
      }
      return
    }
    if (this.currentUser.role === Role.SiteAdmin) {
      throw new ForbiddenError(
        'Site Admins cannot change organization content directly. ' +
          'Use View As to act as a user in that organization.',
      )
    }
    if (this.currentUser.organizationId !== organizationId) {
      throw new NotFoundError('Organization not found.')
    }
    if (this.currentUser.role !== Role.OrgAdmin) {
      throw new ForbiddenError(
        'You are not allowed to manage sign-in messages in this organization.',
      )
    }
  }

  private ensureAuthenticated(): void {
    if (!this.currentUser.isAuthenticated || this.currentUser.userId === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }
  }

  private reaches(message: LoginMessage): boolean {
    return (
      message.organizationId === null || message.organizationId === this.currentUser.organizationId
    )
  }

  private async toItems(messages: readonly LoginMessage[]): Promise<readonly LoginMessageItem[]> {
    const now = this.clock.now()
    const needingCounts = messages.filter(
      (m) => m.dismissalMode === LoginMessageDismissal.AcknowledgeRequired,
    )
    const acknowledged =
      needingCounts.length > 0 ? await this.messages.countAcknowledged(needingCounts) : new Map()
    const audiences = new Map<string | null, number>()
    for (const message of needingCounts) {
      if (!audiences.has(message.organizationId)) {
        audiences.set(
          message.organizationId,
          await this.messages.countAudience(message.organizationId),
        )
      }
    }
    return messages.map((message) => ({
      id: message.id,
      organizationId: message.organizationId,
      title: message.title,
      body: message.body,
      display: message.display,
      dismissalMode: message.dismissalMode,
      startsAtUtc: message.startsAtUtc,
      endsAtUtc: message.endsAtUtc,
      revision: message.revision,
      state: loginMessageState(message, now),
      ...(message.dismissalMode === LoginMessageDismissal.AcknowledgeRequired
        ? {
            acknowledgedCount: acknowledged.get(message.id) ?? 0,
            audienceCount: audiences.get(message.organizationId) ?? 0,
          }
        : {}),
      createdAtUtc: message.createdAtUtc,
      updatedAtUtc: message.updatedAtUtc,
    }))
  }

  private async audit(
    eventType: string,
    message: LoginMessage,
    text: string,
    occurredAtUtc: Date,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditEvents.write({
      eventType,
      entityType: 'LoginMessage',
      message: text,
      occurredAtUtc,
      organizationId: message.organizationId,
      attribution: attributeAudit(this.currentUser, this.currentUser.userId),
      entityId: message.id,
      metadataJson: JSON.stringify(metadata),
    })
  }
}

function runDomain<T>(fn: () => T): T {
  try {
    return fn()
  } catch (error) {
    if (error instanceof LoginMessageInvariantError) {
      throw new ValidationError('One or more fields are invalid.', {
        [error.field]: [error.message],
      })
    }
    throw error
  }
}
