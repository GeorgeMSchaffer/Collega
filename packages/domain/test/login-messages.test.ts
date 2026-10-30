// Sign-in message rules (SPEC/20-feature-login-messages.md LMS-1c, LMS-3, LMS-4, LMS-5): field
// validation, the Scheduled/Live/Ended window with an inclusive start and an exclusive end, which
// receipts hide a message for which dismissal mode, and the idempotent close and acknowledge.

import { describe, expect, it } from 'vitest'
import { LoginMessageDismissal, LoginMessageDisplay } from '../src/enums/index.js'
import {
  createLoginMessage,
  isHiddenFor,
  isLive,
  LOGIN_MESSAGE_BODY_MAX_LENGTH,
  LOGIN_MESSAGE_TITLE_MAX_LENGTH,
  type LoginMessageFields,
  LoginMessageInvariantError,
  type LoginMessageReceipt,
  loginMessageState,
  recordAcknowledgement,
  recordClose,
  updateLoginMessage,
} from '../src/login-messages/index.js'

const NOW = new Date('2026-10-27T12:00:00.000Z')
const LATER = new Date('2026-10-28T12:00:00.000Z')
const START = new Date('2026-11-01T00:00:00.000Z')
const END = new Date('2026-11-08T00:00:00.000Z')
const SIGN_IN = new Date('2026-11-02T09:00:00.000Z')
const BEFORE_SIGN_IN = new Date('2026-11-02T08:00:00.000Z')
const AFTER_SIGN_IN = new Date('2026-11-02T10:00:00.000Z')
const OLD_ACK = new Date('2026-11-01T01:00:00.000Z')

function fields(overrides: Partial<LoginMessageFields> = {}): LoginMessageFields {
  return {
    title: 'Planned maintenance',
    body: 'Read-only on Saturday.',
    display: LoginMessageDisplay.Modal,
    dismissalMode: LoginMessageDismissal.EveryLogin,
    startsAtUtc: START,
    endsAtUtc: END,
    ...overrides,
  }
}

function make(overrides: Partial<LoginMessageFields> = {}, organizationId: string | null = null) {
  return createLoginMessage({
    ...fields(overrides),
    id: 'msg-1',
    organizationId,
    nowUtc: NOW,
    actorUserId: 'actor-1',
  })
}

function fieldOf(action: () => unknown): string {
  try {
    action()
  } catch (error) {
    expect(error).toBeInstanceOf(LoginMessageInvariantError)
    return (error as LoginMessageInvariantError).field
  }
  throw new Error('expected a LoginMessageInvariantError')
}

function receipt(overrides: Partial<LoginMessageReceipt> = {}): LoginMessageReceipt {
  return {
    messageId: 'msg-1',
    userId: 'user-1',
    revision: 1,
    closedAtUtc: null,
    dismissedAtUtc: null,
    acknowledgedAtUtc: null,
    ...overrides,
  }
}

describe('createLoginMessage', () => {
  it('builds revision 1 with audit stamps, keeping the scope given', () => {
    const message = make({}, 'org-a')
    expect(message).toMatchObject({
      id: 'msg-1',
      organizationId: 'org-a',
      revision: 1,
      title: 'Planned maintenance',
      createdAtUtc: NOW,
      updatedAtUtc: NOW,
      createdByUserId: 'actor-1',
    })
  })

  it('trims title and body but keeps line breaks inside the body', () => {
    const message = make({ title: '  Hello  ', body: '  line one\nline two \n' })
    expect(message.title).toBe('Hello')
    expect(message.body).toBe('line one\nline two')
  })

  it('accepts an open-ended window and a start in the past', () => {
    const message = make({ startsAtUtc: new Date('2020-01-01T00:00:00Z'), endsAtUtc: null })
    expect(message.endsAtUtc).toBeNull()
  })

  it.each([
    ['an empty title', { title: '' }, 'title'],
    ['a blank title', { title: '   ' }, 'title'],
    ['an empty body', { body: '' }, 'body'],
    ['a blank body', { body: '\n \t' }, 'body'],
  ])('refuses %s, keyed by field', (_label, overrides, field) => {
    expect(fieldOf(() => make(overrides))).toBe(field)
  })

  it('accepts a title and body exactly at their limits and refuses one over', () => {
    expect(() => make({ title: 'x'.repeat(LOGIN_MESSAGE_TITLE_MAX_LENGTH) })).not.toThrow()
    expect(fieldOf(() => make({ title: 'x'.repeat(LOGIN_MESSAGE_TITLE_MAX_LENGTH + 1) }))).toBe(
      'title',
    )
    expect(() => make({ body: 'x'.repeat(LOGIN_MESSAGE_BODY_MAX_LENGTH) })).not.toThrow()
    expect(fieldOf(() => make({ body: 'x'.repeat(LOGIN_MESSAGE_BODY_MAX_LENGTH + 1) }))).toBe(
      'body',
    )
  })

  it('measures the limits after trimming', () => {
    expect(() => make({ title: `  ${'x'.repeat(LOGIN_MESSAGE_TITLE_MAX_LENGTH)}  ` })).not.toThrow()
  })

  it('pins the contract limits at 120 and 4000', () => {
    expect([LOGIN_MESSAGE_TITLE_MAX_LENGTH, LOGIN_MESSAGE_BODY_MAX_LENGTH]).toEqual([120, 4000])
  })

  it.each([
    ['an unknown display', { display: 'Popup' }, 'display'],
    ['an empty display', { display: '' }, 'display'],
    ['a lower-case display', { display: 'modal' }, 'display'],
    ['an unknown mode', { dismissalMode: 'Never' }, 'dismissalMode'],
    ['an empty mode', { dismissalMode: '' }, 'dismissalMode'],
  ])('refuses %s', (_label, overrides, field) => {
    expect(fieldOf(() => make(overrides))).toBe(field)
  })

  it('refuses an invalid start date', () => {
    expect(fieldOf(() => make({ startsAtUtc: new Date(Number.NaN) }))).toBe('startsAtUtc')
  })

  it('refuses an invalid end date', () => {
    expect(fieldOf(() => make({ endsAtUtc: new Date(Number.NaN) }))).toBe('endsAtUtc')
  })

  it('refuses an end equal to the start and an end before it', () => {
    expect(fieldOf(() => make({ endsAtUtc: START }))).toBe('endsAtUtc')
    expect(fieldOf(() => make({ endsAtUtc: new Date(START.getTime() - 1) }))).toBe('endsAtUtc')
  })

  it('accepts an end one millisecond after the start', () => {
    expect(() => make({ endsAtUtc: new Date(START.getTime() + 1) })).not.toThrow()
  })
})

describe('updateLoginMessage', () => {
  it('replaces the editable fields, stamps the update and keeps scope and creation', () => {
    const original = make({}, 'org-a')
    const updated = updateLoginMessage(
      original,
      fields({ title: 'New title', dismissalMode: LoginMessageDismissal.DismissOnce }),
      false,
      LATER,
      'actor-2',
    )
    expect(updated).toMatchObject({
      id: 'msg-1',
      organizationId: 'org-a',
      title: 'New title',
      dismissalMode: LoginMessageDismissal.DismissOnce,
      createdAtUtc: NOW,
      createdByUserId: 'actor-1',
      updatedAtUtc: LATER,
      updatedByUserId: 'actor-2',
    })
  })

  it('keeps the revision without showAgain and raises it by one with showAgain', () => {
    const original = make()
    expect(updateLoginMessage(original, fields(), false, LATER, 'a').revision).toBe(1)
    const raised = updateLoginMessage(original, fields(), true, LATER, 'a')
    expect(raised.revision).toBe(2)
    expect(updateLoginMessage(raised, fields(), true, LATER, 'a').revision).toBe(3)
  })

  it('applies the same field rules as create', () => {
    expect(
      fieldOf(() => updateLoginMessage(make(), fields({ title: ' ' }), true, LATER, 'a')),
    ).toBe('title')
  })
})

describe('loginMessageState', () => {
  it('is Scheduled just before the start, Live exactly at it', () => {
    const message = make()
    expect(loginMessageState(message, new Date(START.getTime() - 1))).toBe('Scheduled')
    expect(loginMessageState(message, START)).toBe('Live')
  })

  it('is Live just before the end, Ended exactly at it', () => {
    const message = make()
    expect(loginMessageState(message, new Date(END.getTime() - 1))).toBe('Live')
    expect(loginMessageState(message, END)).toBe('Ended')
  })

  it('stays Live forever without an end', () => {
    expect(loginMessageState(make({ endsAtUtc: null }), new Date('2100-01-01T00:00:00Z'))).toBe(
      'Live',
    )
  })

  it('reports isLive only for the Live state', () => {
    const message = make()
    expect(isLive(message, new Date(START.getTime() - 1))).toBe(false)
    expect(isLive(message, START)).toBe(true)
    expect(isLive(message, END)).toBe(false)
  })
})

describe('isHiddenFor', () => {
  const modes = Object.values(LoginMessageDismissal)

  it.each(modes)('shows a %s message with no receipt', (mode) => {
    expect(isHiddenFor(make({ dismissalMode: mode }), null, SIGN_IN)).toBe(false)
  })

  it.each(modes)('hides a %s message closed at or after this sign-in', (mode) => {
    const message = make({ dismissalMode: mode })
    expect(isHiddenFor(message, receipt({ closedAtUtc: SIGN_IN }), SIGN_IN)).toBe(true)
    expect(isHiddenFor(message, receipt({ closedAtUtc: AFTER_SIGN_IN }), SIGN_IN)).toBe(true)
  })

  it.each(modes)('shows a %s message closed before this sign-in', (mode) => {
    const message = make({ dismissalMode: mode })
    expect(isHiddenFor(message, receipt({ closedAtUtc: BEFORE_SIGN_IN }), SIGN_IN)).toBe(false)
  })

  it.each(modes)('hides a %s message once acknowledged, whatever the sign-in', (mode) => {
    const message = make({ dismissalMode: mode })
    expect(isHiddenFor(message, receipt({ acknowledgedAtUtc: OLD_ACK }), SIGN_IN)).toBe(true)
  })

  it('hides a DismissOnce message for good once dismissed', () => {
    const message = make({ dismissalMode: LoginMessageDismissal.DismissOnce })
    expect(isHiddenFor(message, receipt({ dismissedAtUtc: OLD_ACK }), SIGN_IN)).toBe(true)
  })

  it.each([LoginMessageDismissal.EveryLogin, LoginMessageDismissal.AcknowledgeRequired])(
    'ignores a dismissal timestamp on a %s message',
    (mode) => {
      const message = make({ dismissalMode: mode })
      expect(isHiddenFor(message, receipt({ dismissedAtUtc: OLD_ACK }), SIGN_IN)).toBe(false)
    },
  )

  it('shows an AcknowledgeRequired message closed in an earlier sign-in until acknowledged', () => {
    const message = make({ dismissalMode: LoginMessageDismissal.AcknowledgeRequired })
    expect(isHiddenFor(message, receipt({ closedAtUtc: BEFORE_SIGN_IN }), SIGN_IN)).toBe(false)
  })

  it.each([
    ['acknowledged', { acknowledgedAtUtc: OLD_ACK }],
    ['dismissed', { dismissedAtUtc: OLD_ACK }],
    ['closed this sign-in', { closedAtUtc: AFTER_SIGN_IN }],
  ])('counts a receipt for a stale revision as none when %s', (_label, overrides) => {
    const message = updateLoginMessage(
      make({ dismissalMode: LoginMessageDismissal.DismissOnce }),
      fields({ dismissalMode: LoginMessageDismissal.DismissOnce }),
      true,
      LATER,
      'a',
    )
    expect(isHiddenFor(message, receipt({ revision: 1, ...overrides }), SIGN_IN)).toBe(false)
  })

  it('does not hide on a receipt for a newer revision than the message', () => {
    expect(isHiddenFor(make(), receipt({ revision: 2, closedAtUtc: AFTER_SIGN_IN }), SIGN_IN)).toBe(
      false,
    )
  })

  it('shows a message with an empty current-revision receipt', () => {
    expect(isHiddenFor(make(), receipt(), SIGN_IN)).toBe(false)
  })
})

describe('recordClose', () => {
  it('starts a receipt at the message revision with only closedAtUtc set', () => {
    const result = recordClose(make(), 'user-1', null, AFTER_SIGN_IN)
    expect(result).toEqual(receipt({ closedAtUtc: AFTER_SIGN_IN }))
  })

  it('takes the latest close time on a repeat', () => {
    const message = make()
    const first = recordClose(message, 'user-1', null, BEFORE_SIGN_IN)
    expect(recordClose(message, 'user-1', first, AFTER_SIGN_IN).closedAtUtc).toEqual(AFTER_SIGN_IN)
  })

  it('records the dismissal for good on DismissOnce and leaves closedAtUtc empty', () => {
    const message = make({ dismissalMode: LoginMessageDismissal.DismissOnce })
    const result = recordClose(message, 'user-1', null, AFTER_SIGN_IN)
    expect(result.dismissedAtUtc).toEqual(AFTER_SIGN_IN)
    expect(result.closedAtUtc).toBeNull()
  })

  it('keeps the first dismissal on a repeated DismissOnce close', () => {
    const message = make({ dismissalMode: LoginMessageDismissal.DismissOnce })
    const first = recordClose(message, 'user-1', null, BEFORE_SIGN_IN)
    const second = recordClose(message, 'user-1', first, AFTER_SIGN_IN)
    expect(second.dismissedAtUtc).toEqual(BEFORE_SIGN_IN)
  })

  it('does not drop an earlier acknowledgement when closing', () => {
    const message = make({ dismissalMode: LoginMessageDismissal.AcknowledgeRequired })
    const acked = recordAcknowledgement(message, 'user-1', null, BEFORE_SIGN_IN)
    const closed = recordClose(message, 'user-1', acked, AFTER_SIGN_IN)
    expect(closed.acknowledgedAtUtc).toEqual(BEFORE_SIGN_IN)
    expect(closed.closedAtUtc).toEqual(AFTER_SIGN_IN)
  })

  it('starts afresh at the new revision when the old receipt is stale', () => {
    const message = updateLoginMessage(make(), fields(), true, LATER, 'a')
    const stale = receipt({ revision: 1, acknowledgedAtUtc: OLD_ACK, closedAtUtc: OLD_ACK })
    expect(recordClose(message, 'user-1', stale, AFTER_SIGN_IN)).toEqual(
      receipt({ revision: 2, closedAtUtc: AFTER_SIGN_IN }),
    )
  })

  it('does not mutate the receipt it was given', () => {
    const message = make()
    const original = receipt({ closedAtUtc: BEFORE_SIGN_IN })
    recordClose(message, 'user-1', original, AFTER_SIGN_IN)
    expect(original.closedAtUtc).toEqual(BEFORE_SIGN_IN)
  })
})

describe('recordAcknowledgement', () => {
  const message = make({ dismissalMode: LoginMessageDismissal.AcknowledgeRequired })

  it('records acknowledgedAtUtc on a new receipt', () => {
    expect(recordAcknowledgement(message, 'user-1', null, AFTER_SIGN_IN)).toEqual(
      receipt({ acknowledgedAtUtc: AFTER_SIGN_IN }),
    )
  })

  it('keeps the first acknowledgement on a repeat', () => {
    const first = recordAcknowledgement(message, 'user-1', null, BEFORE_SIGN_IN)
    const second = recordAcknowledgement(message, 'user-1', first, AFTER_SIGN_IN)
    expect(second.acknowledgedAtUtc).toEqual(BEFORE_SIGN_IN)
  })

  it('starts afresh at the new revision when the old receipt is stale', () => {
    const next = updateLoginMessage(
      message,
      fields({ dismissalMode: message.dismissalMode }),
      true,
      LATER,
      'a',
    )
    const stale = receipt({ revision: 1, acknowledgedAtUtc: OLD_ACK })
    expect(recordAcknowledgement(next, 'user-1', stale, AFTER_SIGN_IN)).toEqual(
      receipt({ revision: 2, acknowledgedAtUtc: AFTER_SIGN_IN }),
    )
  })
})
