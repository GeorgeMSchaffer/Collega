/**
 * A request that failed validation on its own shape - a missing or blank required field - before
 * any Application code ran.
 *
 * **Why this is not the kernel's `ValidationError`.** It renders differently, and the golden
 * corpus is unambiguous about it. Of the eight recorded `400`s, six carry **no `traceId`** and a
 * `content-type` **with** `; charset=utf-8`; the other two carry a `traceId` and no charset. The
 * split is not arbitrary - it is exactly whether ASP.NET rejected the request during model binding
 * (`[Required]`, before the action) or an Application service threw after being entered:
 *
 * | Recorded fixture | Rejected by | `traceId` | charset |
 * |---|---|---|---|
 * | `auth.login.missing-email`, `auth.me.update.invalid`, `auth.viewas.start.missing-target`, `comments.create.empty.user`, `ideas.create.invalid.user`, `statuses.create.invalid.orgadmin` | model binding | absent | present |
 * | `boards.create.one-swimlane.orgadmin`, `profile.register.bad-code.anonymous` | Application code | present | absent |
 *
 * Both produce the same `type` and `title` (`https://collega.dev/problems/validation-error`), which
 * is why the difference is easy to miss and worth a type of its own rather than a boolean flag.
 *
 * `problem-details.filter.ts` previously advised D1-D7 to throw the kernel `ValidationError` for
 * this case. That advice predates anyone replaying the corpus against a live host; it produces the
 * second row's shape for a first-row rejection. Throw this instead.
 */
export class RequestValidationError extends Error {
  /** Field name -> the messages for it, exactly as the response's `errors` property renders. */
  readonly failures: Readonly<Record<string, readonly string[]>>

  constructor(failures: Readonly<Record<string, readonly string[]>>) {
    super('One or more fields are invalid.')
    this.name = 'RequestValidationError'
    this.failures = failures
  }
}

/**
 * The human-readable name a validation message uses for a field.
 *
 * `SPEC/30-Contracts.md` "Validation Message Conventions" (resolved 2026-08-07) splits the two
 * spellings deliberately: the `errors` object's **keys** stay camelCase to match the wire JSON,
 * while the name substituted into the message **text** is spaced Title Case. So `firstName` keys
 * an entry reading `"First Name is required."`, and the corpus records exactly that - along with
 * `"Target User Id is required."`, which is why the split happens on a lowercase-or-digit followed
 * by an uppercase and not on every capital: `userId` must become `User Id`, never `User I d`.
 *
 * This mirrors `SpacedDisplayNameMetadataProvider` on the .NET side, which fed ASP.NET's
 * `DisplayName` and therefore every message any request DTO produced.
 */
function displayName(field: string): string {
  const spaced = field.replace(/(?<=[a-z0-9])(?=[A-Z])/g, ' ')
  return `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`
}

/**
 * Throws for any absent or blank field, collecting every failure rather than stopping at the
 * first - a caller fixing one field per round trip is a caller making three round trips.
 *
 * Required is the only template implemented here because it is the only one the corpus records:
 * across all 447 fixtures the recorded messages are six "is required." variants and nothing else.
 * The remaining templates in that spec section (max length, format, enum, range) have no recorded
 * response to match, so writing them now would be guessing at wording nothing can check.
 */
export function requirePresent(fields: Readonly<Record<string, string | undefined>>): void {
  const failures: Record<string, readonly string[]> = {}
  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value.trim() === '') {
      failures[name] = [`${displayName(name)} is required.`]
    }
  }
  if (Object.keys(failures).length > 0) {
    throw new RequestValidationError(failures)
  }
}
