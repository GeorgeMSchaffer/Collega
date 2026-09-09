// `decodeBase64Image` reproduces `Convert.FromBase64String`'s semantics, which are subtle enough
// that they were got wrong once already: whitespace anywhere is ignored, but the whitespace-free
// length must be a multiple of four, so padding is mandatory and over-padding is fatal. The golden
// corpus records exactly one portrait upload - a well-formed one - so every rejection branch here
// is reachable only from a unit test.
//
// The function is not exported, and is not made so for testing: it is driven through
// `PUT /auth/me/portrait`, which is its only caller and the surface whose behaviour the contract
// actually describes. An accepted payload reaches `AuthService.updatePortrait` as bytes; a
// rejected one is a RequestValidationError keyed on `imageBase64` and the service is never called.
//
// A rejection is one of two faults, and which one matters: `[RequiredField]` on
// `UpdatePortraitRequest.ImageBase64` ran during model binding, so a blank or absent upload was
// "is required." and only a present-but-corrupt one was "could not be read." They are pinned in
// separate tables below, plus one test whose only job is that the two never converge.

import { readFileSync } from 'node:fs'
import type { AuthService, CurrentUserSummary } from '@collega/application/auth'
import type { CurrentUserContext } from '@collega/application/common'
import { Role, UserStatus } from '@collega/domain/enums'
import { describe, expect, it } from 'vitest'
import { AuthenticationController } from '../src/authentication/authentication.controller.js'
import { RequestValidationError } from '../src/common/errors/request-validation.error.js'

/** The one recorded portrait payload - a 1x1 PNG. Read from the corpus, never retyped. */
const FIXTURE_PAYLOAD: string = (
  JSON.parse(
    readFileSync(
      new URL('../../../tools/golden/fixtures/profile.portrait.set.user.json', import.meta.url),
      'utf8',
    ),
  ) as { request: { body: { imageBase64: string } } }
).request.body.imageBase64

const SUMMARY: CurrentUserSummary = {
  userId: 'u1',
  organizationId: 'org-1',
  role: Role.User,
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.test',
  status: UserStatus.Active,
  portraitDataUrl: null,
  viewingAs: null,
}

/**
 * A controller wired to an AuthService that records the bytes it was handed. Nothing else on the
 * service is reachable from `updatePortrait`, so a stub of one method is the whole dependency.
 */
function controllerRecordingBytes() {
  const received: Uint8Array[] = []
  const auth = {
    updatePortrait: async (imageBytes: Uint8Array) => {
      received.push(imageBytes)
      return SUMMARY
    },
  } as unknown as AuthService
  const controller = new AuthenticationController(auth, {} as CurrentUserContext)
  return { controller, received }
}

/**
 * The two distinct faults, which the endpoint must keep apart. `UpdatePortraitRequest` carries
 * `[RequiredField]` on `ImageBase64` and ASP.NET ran model validation before the action, so
 * `TryDecodeBase64` never saw a blank value and could only ever produce the second of these.
 */
const REQUIRED = 'Image Base64 is required.'
const UNREADABLE = 'The uploaded image could not be read.'

/** What the endpoint did with a payload: the bytes it forwarded, or the messages it rejected with. */
type Outcome =
  | { readonly accepted: true; readonly bytes: Uint8Array }
  | { readonly accepted: false; readonly messages: readonly string[] }

/**
 * Puts `imageBase64` through the endpoint. Deliberately returns the rejection messages rather than
 * asserting them: which message comes back is the thing under test in half these cases, so a
 * shared expectation here would hide exactly the distinction the tests exist to pin.
 */
async function throughEndpoint(imageBase64: unknown): Promise<Outcome> {
  const { controller, received } = controllerRecordingBytes()
  try {
    await controller.updatePortrait({ imageBase64 } as { imageBase64?: string })
  } catch (error) {
    // The envelope is the same for both faults - same error type, same key, and in neither case
    // does the upload reach the service. Only the message differs.
    expect(error).toBeInstanceOf(RequestValidationError)
    const { failures } = error as RequestValidationError
    expect(Object.keys(failures)).toEqual(['imageBase64'])
    expect(received).toHaveLength(0)
    return { accepted: false, messages: failures.imageBase64 as readonly string[] }
  }
  expect(received).toHaveLength(1)
  return { accepted: true, bytes: received[0] as Uint8Array }
}

/** The bytes the endpoint forwarded, failing the test if it rejected the payload instead. */
async function acceptedBytes(imageBase64: unknown): Promise<Uint8Array> {
  const outcome = await throughEndpoint(imageBase64)
  if (!outcome.accepted) {
    throw new Error(`expected acceptance, but it was rejected with: ${outcome.messages.join(' ')}`)
  }
  return outcome.bytes
}

/** The messages the endpoint rejected with, failing the test if it accepted the payload instead. */
async function rejectionMessages(imageBase64: unknown): Promise<readonly string[]> {
  const outcome = await throughEndpoint(imageBase64)
  if (outcome.accepted) {
    throw new Error('expected rejection, but the payload was accepted')
  }
  return outcome.messages
}

/** Breaks a payload into `width`-character lines, as a Base64 encoder with wrapping would. */
function wrap(payload: string, width: number): string {
  return (payload.match(new RegExp(`.{1,${width}}`, 'g')) ?? []).join('\n')
}

describe('PUT /auth/me/portrait - accepted payloads', () => {
  it('accepts the recorded fixture payload bare, and decodes it to the PNG magic number', async () => {
    const bytes = await acceptedBytes(FIXTURE_PAYLOAD)
    expect(Array.from(bytes.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('accepts the same payload as a full data URL, decoding to identical bytes', async () => {
    // Any client built on FileReader.readAsDataURL sends this form without thinking about it.
    const bare = await acceptedBytes(FIXTURE_PAYLOAD)
    const asUrl = await acceptedBytes(`data:image/png;base64,${FIXTURE_PAYLOAD}`)
    expect(Buffer.from(asUrl).equals(Buffer.from(bare))).toBe(true)
  })

  it('ignores line wrapping - a payload broken at 40 characters decodes to the same bytes', async () => {
    const bare = await acceptedBytes(FIXTURE_PAYLOAD)
    const wrapped = await acceptedBytes(wrap(FIXTURE_PAYLOAD, 40))
    expect(Buffer.from(wrapped).equals(Buffer.from(bare))).toBe(true)
  })

  it('ignores a single trailing newline', async () => {
    await acceptedBytes(`${FIXTURE_PAYLOAD}\n`)
  })

  it('ignores every character Convert.FromBase64String skipped, and nothing else', async () => {
    // Its decoder skips characters <= ' ', which is space, tab, CR, LF, FF and VT - not the wider
    // set JS \s covers. The rejection half of this rule is in the rejected-payload table below.
    const bare = await acceptedBytes(FIXTURE_PAYLOAD)
    const padded = await acceptedBytes(` ${FIXTURE_PAYLOAD}\t\r\n\f\v `)
    expect(Buffer.from(padded).equals(Buffer.from(bare))).toBe(true)
    await acceptedBytes(`data:image/png;base64,${wrap(FIXTURE_PAYLOAD, 24)}\n`)
  })

  it('accepts a payload whose final unused bits are non-zero, as Convert.FromBase64String did', async () => {
    // "aGVsbG9=" and "aGVsbG8=" differ only in bits the decoder shifts out, and .NET validated
    // neither - it returned the same five bytes for both. A re-encode-and-compare check on top of
    // the length and alphabet rules would reject the first, which is stricter than the API being
    // ported; this fails if one is ever reintroduced.
    const canonical = await acceptedBytes('aGVsbG8=')
    const nonCanonical = await acceptedBytes('aGVsbG9=')
    expect(Buffer.from(nonCanonical).equals(Buffer.from(canonical))).toBe(true)
    expect(Buffer.from(canonical).toString('utf8')).toBe('hello')

    // The same thing at the two-padding-character boundary, where the leftover is four bits.
    expect(Array.from(await acceptedBytes('AB=='))).toEqual([0x00])
  })
})

describe('PUT /auth/me/portrait - present but unreadable', () => {
  // Convert.FromBase64String throws on every one of these, and the .NET handler let it through as
  // a 400 keyed on imageBase64. Buffer.from(s, 'base64') would silently succeed on most of them,
  // discarding what it cannot read - which is why the length and alphabet checks exist at all.
  const unreadable: ReadonlyArray<readonly [string, string]> = [
    ['unpadded, length % 4 === 3', 'aGVsbG8'],
    ['length % 4 === 2', 'iVBORw'],
    ['length % 4 === 1', 'aGVsb'],
    ['excess padding', 'aGVsbG8====='],
    ['interior padding', 'aGVs=bG8='],
    ['interior padding that is still a multiple of four', 'aGV=bG8='],
    ['base64url alphabet', 'a-VsbG8='],
    // Written as escapes: these are exactly the characters that look like whitespace to JS \s
    // and are not whitespace to .NET, so a literal here would be invisible in review.
    ['a non-breaking space, which Convert.FromBase64String did not skip', 'aGVs\u00a0bG8='],
    ['a line separator, likewise', 'aGVs\u2028bG8='],
    ['a byte order mark, likewise', 'aGVsbG8=\ufeff'],
    ['a data URL with no payload after the comma', 'data:image/png;base64,'],
  ]

  for (const [label, payload] of unreadable) {
    it(`rejects ${label} as unreadable`, async () => {
      expect(await rejectionMessages(payload)).toEqual([UNREADABLE])
    })
  }
})

describe('PUT /auth/me/portrait - blank or absent', () => {
  // [RequiredField] on UpdatePortraitRequest.ImageBase64 ran during model binding, ahead of the
  // action, so .NET answered "is required." here and never reached the decoder at all.
  const blank: ReadonlyArray<readonly [string, unknown]> = [
    ['an omitted field', undefined],
    ['an empty string', ''],
    ['a JSON null', null],
    ['a number', 123],
    ['an object', {}],
    ['an array', []],
    ['a boolean', true],
  ]

  for (const [label, value] of blank) {
    it(`answers "is required." for ${label}`, async () => {
      // The last four have no ValidationPipe to stop them: {"imageBase64": 123} reaches the
      // handler as a number, and a TypeError here would be a 500 on an authenticated endpoint
      // rather than the 400 the contract records.
      expect(await rejectionMessages(value)).toEqual([REQUIRED])
    })
  }

  it('keeps the two faults distinct - an absent upload is not a corrupt one', async () => {
    // The fault a caller sees has to say which mistake they made. Reordering the presence check
    // after the decode, or collapsing the two messages into one, makes this fail rather than
    // silently telling someone who sent nothing that their image could not be read.
    const absent = await rejectionMessages(undefined)
    const corrupt = await rejectionMessages('aGVsbG8')
    expect(absent).toEqual([REQUIRED])
    expect(corrupt).toEqual([UNREADABLE])
    expect(absent).not.toEqual(corrupt)
  })

  it('answers "is required." for whitespace that would also fail the decode', async () => {
    // A whitespace-only string fails BOTH rules, so it is the case that pins the ORDER: the
    // presence check has to run first, exactly as model binding did.
    expect(await rejectionMessages(' \t\r\n ')).toEqual([REQUIRED])
  })
})
