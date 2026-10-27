// Commands and results for sign-in messages (SPEC/contracts/login-messages.md).

import type { LoginMessageDismissal, LoginMessageDisplay } from '@collega/domain/enums'
import type { LoginMessageState } from '@collega/domain/login-messages'

export type LoginMessageInput = {
  readonly title: string
  readonly body: string
  /** Checked by the domain; anything but a member is a 400. */
  readonly display: string
  readonly dismissalMode: string
  /** An unparseable value arrives as an invalid Date and is a 400. */
  readonly startsAtUtc: Date
  readonly endsAtUtc: Date | null
}

export type UpdateLoginMessageCommand = LoginMessageInput & { readonly showAgain: boolean }

export type LoginMessageItem = {
  readonly id: string
  readonly organizationId: string | null
  readonly title: string
  readonly body: string
  readonly display: LoginMessageDisplay
  readonly dismissalMode: LoginMessageDismissal
  readonly startsAtUtc: Date
  readonly endsAtUtc: Date | null
  readonly revision: number
  readonly state: LoginMessageState
  /** Present only for `AcknowledgeRequired`, for the current revision. */
  readonly acknowledgedCount?: number
  readonly audienceCount?: number
  readonly createdAtUtc: Date
  readonly updatedAtUtc: Date
}

export type VisibleLoginMessage = {
  readonly id: string
  readonly scope: 'System' | 'Organization'
  readonly title: string
  readonly body: string
  readonly display: LoginMessageDisplay
  readonly dismissalMode: LoginMessageDismissal
  readonly revision: number
}

export type LoginMessageAcknowledgement = {
  readonly userId: string
  readonly name: string
  readonly email: string
  readonly organizationName: string | null
  readonly acknowledgedAtUtc: Date | null
}

export type LoginMessageAcknowledgementReport = {
  readonly acknowledgedCount: number
  readonly audienceCount: number
  readonly items: readonly LoginMessageAcknowledgement[]
  readonly page: number
  readonly pageSize: number
  readonly totalCount: number
}
