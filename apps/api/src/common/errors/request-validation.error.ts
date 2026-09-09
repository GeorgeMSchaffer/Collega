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
 * Throws for any absent or blank field, collecting every failure rather than stopping at the
 * first - a caller fixing one field per round trip is a caller making three round trips.
 *
 * The message is `"<Field> is required."` with the field name capitalised, which is what ASP.NET's
 * `[Required]` produced and what the fixtures record.
 */
export function requirePresent(fields: Readonly<Record<string, string | undefined>>): void {
  const failures: Record<string, readonly string[]> = {}
  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value.trim() === '') {
      failures[name] = [`${name.charAt(0).toUpperCase()}${name.slice(1)} is required.`]
    }
  }
  if (Object.keys(failures).length > 0) {
    throw new RequestValidationError(failures)
  }
}
