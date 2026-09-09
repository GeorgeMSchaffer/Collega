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

/** Decodes `imageBase64` through the endpoint, returning the bytes, or null if it was rejected. */
async function decodeThroughEndpoint(imageBase64: unknown): Promise<Uint8Array | null> {
  const { controller, received } = controllerRecordingBytes()
  try {
    await controller.updatePortrait({ imageBase64 } as { imageBase64?: string })
  } catch (error) {
    expect(error).toBeInstanceOf(RequestValidationError)
    expect((error as RequestValidationError).failures).toEqual({
      imageBase64: ['The uploaded image could not be read.'],
    })
    expect(received).toHaveLength(0)
    return null
  }
  expect(received).toHaveLength(1)
  return received[0] as Uint8Array
}

/** Breaks a payload into `width`-character lines, as a Base64 encoder with wrapping would. */
function wrap(payload: string, width: number): string {
  return (payload.match(new RegExp(`.{1,${width}}`, 'g')) ?? []).join('\n')
}

describe('PUT /auth/me/portrait - accepted payloads', () => {
  it('accepts the recorded fixture payload bare, and decodes it to the PNG magic number', async () => {
    const bytes = await decodeThroughEndpoint(FIXTURE_PAYLOAD)
    expect(bytes).not.toBeNull()
    expect(Array.from((bytes as Uint8Array).subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('accepts the same payload as a full data URL, decoding to identical bytes', async () => {
    // Any client built on FileReader.readAsDataURL sends this form without thinking about it.
    const bare = await decodeThroughEndpoint(FIXTURE_PAYLOAD)
    const asUrl = await decodeThroughEndpoint(`data:image/png;base64,${FIXTURE_PAYLOAD}`)
    expect(asUrl).not.toBeNull()
    expect(Buffer.from(asUrl as Uint8Array).equals(Buffer.from(bare as Uint8Array))).toBe(true)
  })

  it('ignores line wrapping - a payload broken at 40 characters decodes to the same bytes', async () => {
    const bare = await decodeThroughEndpoint(FIXTURE_PAYLOAD)
    const wrapped = await decodeThroughEndpoint(wrap(FIXTURE_PAYLOAD, 40))
    expect(wrapped).not.toBeNull()
    expect(Buffer.from(wrapped as Uint8Array).equals(Buffer.from(bare as Uint8Array))).toBe(true)
  })

  it('ignores a single trailing newline', async () => {
    expect(await decodeThroughEndpoint(`${FIXTURE_PAYLOAD}\n`)).not.toBeNull()
  })

  it('ignores whitespace of every kind, including inside the data URL form', async () => {
    expect(await decodeThroughEndpoint(` ${FIXTURE_PAYLOAD}\t\r\n `)).not.toBeNull()
    expect(
      await decodeThroughEndpoint(`data:image/png;base64,${wrap(FIXTURE_PAYLOAD, 24)}\n`),
    ).not.toBeNull()
  })
})

describe('PUT /auth/me/portrait - rejected payloads', () => {
  // Convert.FromBase64String throws on any of these; the .NET handler let it, and answered 400
  // keyed on imageBase64. Buffer.from(s, 'base64') would silently succeed on all but the last two,
  // which is why the length and alphabet checks exist at all.
  const rejected: ReadonlyArray<readonly [string, string]> = [
    ['unpadded, length % 4 === 3', 'aGVsbG8'],
    ['length % 4 === 2', 'iVBORw'],
    ['excess padding', 'aGVsbG8====='],
    ['length % 4 === 1', 'aGVsb'],
    ['base64url alphabet', 'a-VsbG8='],
    ['interior padding', 'aGVs=bG8='],
    ['empty string', ''],
    ['whitespace only', '   '],
    ['a data URL with no payload after the comma', 'data:image/png;base64,'],
  ]

  for (const [label, payload] of rejected) {
    it(`rejects ${label} (${JSON.stringify(payload)})`, async () => {
      expect(await decodeThroughEndpoint(payload)).toBeNull()
    })
  }

  it('rejects an absent field', async () => {
    expect(await decodeThroughEndpoint(undefined)).toBeNull()
  })

  it('rejects a non-string body value without throwing anything but the validation error', async () => {
    // No ValidationPipe runs, so {"imageBase64": 123} arrives as a number. A TypeError here would
    // be a 500 on an authenticated endpoint rather than the 400 the contract records.
    for (const value of [123, null, {}, [], true]) {
      expect(await decodeThroughEndpoint(value)).toBeNull()
    }
  })
})
