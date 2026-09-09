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
export function displayName(field: string): string {
  const spaced = field.replace(/(?<=[a-z0-9])(?=[A-Z])/g, ' ')
  return `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`
}

/**
 * `EmailAddressAttribute.IsValid` in full: exactly one `@`, neither first nor last character.
 * Deliberately not a stricter pattern - a rule the .NET API accepted and this one rejects is as
 * much a divergence as the other way round.
 */
function isEmailAddress(value: string): boolean {
  const at = value.indexOf('@')
  return at > 0 && at !== value.length - 1 && at === value.lastIndexOf('@')
}

/**
 * One field's constraints - the transcription of the `[RequiredField]` / `[MaxLengthField]` /
 * `[EmailFormat]` attributes the matching request DTO under `src/Collega.API/Contracts/` carries.
 */
export type FieldRules = {
  readonly value: unknown
  readonly required?: boolean
  readonly maxLength?: number
  readonly email?: boolean
  /**
   * The name the MESSAGE uses, when it is not derivable from the key. Needed only for a NESTED
   * property, where the two genuinely part company: ASP.NET keyed the failure by the whole path
   * (`Options[0].Label`, camelCased to `options[0].label` by `ToCamelCasePath` in
   * `src/Collega.API/ErrorHandling/ProblemDetailsServiceCollectionExtensions.cs:66-90`) but built
   * the message from `ModelMetadata.DisplayName`, which `SpacedDisplayNameMetadataProvider` filled
   * from the property's own name alone - so the entry reads `"Label is required."`, not
   * `"Options[0].label is required."`.
   */
  readonly displayName?: string
}

/**
 * Validates a request body against the attribute set its .NET contract declared, collecting every
 * failure rather than stopping at the first - which is what ASP.NET's ModelState did, and it
 * matters within a field as well as across them: a `RegisterRequest` with no `email` at all failed
 * `[RequiredField]` and `[EmailFormat]` both, and reported two messages under the one key.
 *
 * Only the required/max-length/email templates are implemented, because those are the only
 * attributes the D1 contracts use. Wording comes from `src/Collega.API/Validation/
 * ValidationMessages.cs`, which is the canonical source for all six templates in
 * `SPEC/30-Contracts.md` "Validation Message Conventions"; the corpus records the required variant
 * only, so the other two are matched against the .NET source rather than a fixture.
 *
 * An OMITTED field is judged as `''`, not skipped, because that is what it was on the .NET side:
 * every string property on those DTOs is initialised to `string.Empty`, and System.Text.Json
 * leaves the initialiser alone for a key that is not in the JSON. So `{}` reached validation as an
 * empty string and failed `[EmailFormat]` as well as `[RequiredField]`.
 *
 * An EXPLICIT `null` is not the same thing and is the one case that has to branch. System.Text.Json
 * writes the `null` over the initialiser, and `EmailAddressAttribute.IsValid(null)` returns TRUE -
 * so `{"email": null}` failed `[RequiredField]` only, one message where `{}` gave two.
 *
 * A JSON value that is neither (`{"email": 123}`) had no faithful answer to reproduce: System.Text
 * .Json threw a `JsonException` during binding, which is a different envelope entirely. It is read
 * as omitted, since body types are compile-time only and there is no `ValidationPipe` - without
 * that the first `.trim()` would be a `TypeError` and a 500 on an anonymous endpoint.
 */
export function validateFields(fields: Readonly<Record<string, FieldRules>>): void {
  const failures: Record<string, readonly string[]> = {}
  for (const [name, rules] of Object.entries(fields)) {
    const value = typeof rules.value === 'string' ? rules.value : ''
    const shown = rules.displayName ?? displayName(name)
    const messages: string[] = []

    if (rules.required === true && value.trim() === '') {
      messages.push(`${shown} is required.`)
    }
    // Untrimmed, as `MaxLengthAttribute` measured it - the domain trims first, which is a
    // different (and looser) rule, so the two checks are not interchangeable.
    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
      messages.push(`${shown} must be ${rules.maxLength} characters or fewer.`)
    }
    // `!== null` and not `typeof === 'string'`: `EmailAddressAttribute.IsValid` short-circuits on
    // null alone, so an omitted field still has to fail this rule (see above).
    if (rules.email === true && rules.value !== null && !isEmailAddress(value)) {
      messages.push(`${shown} must be a valid email address.`)
    }

    if (messages.length > 0) {
      failures[name] = messages
    }
  }
  if (Object.keys(failures).length > 0) {
    throw new RequestValidationError(failures)
  }
}

/** `validateFields` for the common case of a body whose fields carry `[RequiredField]` and nothing else. */
export function requirePresent(fields: Readonly<Record<string, unknown>>): void {
  validateFields(
    Object.fromEntries(
      Object.entries(fields).map(([name, value]) => [name, { value, required: true }]),
    ),
  )
}
