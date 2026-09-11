/**
 * Reading the API's RFC 7807 problem envelope.
 *
 * Its own module rather than part of `client.ts`, for one mechanical reason: `client.ts` carries
 * `import 'server-only'`, which is a runtime marker, and anything importing it inherits that. These
 * are pure functions over a parsed JSON body with no session, no `fetch` and no environment, and
 * both `client.ts` and the anonymous auth Server Functions — which do not go through `apiGet` or
 * `apiPost`, because they have no session to send — need them.
 */

/**
 * The envelope, as much of it as a message needs.
 *
 * `type` is here because on the auth surface it is the only thing separating two refusals that
 * share a status — see `KERNEL_UNAUTHORIZED` in `lib/server/auth-actions.ts`.
 */
export type ProblemDetails = {
  type?: unknown
  title?: unknown
  detail?: unknown
  errors?: unknown
}

/**
 * The field-level messages a validation 400 carries, still keyed by field.
 *
 * Worth reaching for because that envelope's `detail` is "The request failed validation. See the
 * errors property for field-level details." — true, and useless to the person who left the title
 * empty. The API keys each message by the field that earned it, and a form that has that field on
 * screen can put the message beside it rather than in a banner listing every fault at once.
 *
 * Only the first message per field survives. The bag is an array because one value can break
 * several rules at once — a blank password fails five of `validatePassword`'s checks — and reading
 * all five back is a wall of text where the first is the one to act on.
 */
export function fieldErrors(errors: unknown): Readonly<Record<string, string>> {
  if (typeof errors !== 'object' || errors === null) return {}

  return Object.fromEntries(
    Object.entries(errors)
      .map(([field, list]) => [
        field,
        Array.isArray(list) ? list.find((entry) => typeof entry === 'string') : undefined,
      ])
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
}

/** The same messages as one sentence, for a caller with nowhere to put them field by field. */
export function fieldMessages(errors: unknown): string | null {
  const messages = Object.values(fieldErrors(errors))
  return messages.length > 0 ? messages.join(' ') : null
}
