/**
 * The value coercions every controller needs on the way in from a body or a query string, in one
 * place so three copies cannot drift apart and a fourth cannot be written slightly differently.
 *
 * `validateFields` (`errors/request-validation.error.ts`) is the other half of this boundary: it
 * decides whether a request is REFUSED; these mostly decide what an accepted value MEANS.
 *
 * `stringList` is the exception and refuses outright, because for that one shape there is no
 * meaning to assign that is not a lie - see its own comment.
 */
import { displayName, RequestValidationError } from './errors/request-validation.error.js'

/**
 * A blank or absent optional value is `null`, never `''` - the domain distinguishes them, and so
 * does every Application list filter.
 *
 * Anything that is not a string counts as absent. Body types are compile-time only and a repeated
 * query key arrives as an array, so `{"city": 12}` and `?search=a&search=b` would otherwise reach
 * `.trim()` and answer 500.
 */
export function optional(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

/**
 * A `bool` (not `bool?`) query parameter - `?includeDeleted`, `?isArchived`. Absent binds to
 * `false`, and only the literal `true`, in any casing, flips it.
 *
 * **A KNOWN DIVERGENCE, deliberate**, and wider than "only `true` flips it" suggests. ASP.NET's
 * `SimpleTypeModelBinder` ran `bool.Parse`, so anything that was neither `true` nor `false` -
 * `?includeDeleted=1`, `=yes`, or the bare `?includeDeleted=` - was a model-binding **400** there,
 * not a `false`. A REPEATED key is the same story from the other end: Express hands the value over
 * as an array, `String(['true','true'])` is `'true,true'`, and this reads `false` where .NET bound
 * the first value and answered `true`.
 *
 * Not corrected for the reason `optionalInt` below records at length:
 * the 400's message is ASP.NET's own binding resource string, not one of the templates in
 * `SPEC/30-Contracts.md`, and no fixture in the corpus records one - so implementing it means
 * guessing the wording. Record a fixture against the frozen .NET app first.
 */
export function queryBool(value: unknown): boolean {
  return String(value).toLowerCase() === 'true'
}

/**
 * An `int?` QUERY parameter - `?page`, `?pageSize`, `?limit`. A query value arrives as text (or,
 * for a repeated key, as an array), so this parses rather than type-checks; anything unparseable
 * is `null` and the Application layer applies its own default.
 *
 * **A KNOWN DIVERGENCE, deliberate.** ASP.NET did NOT bind an unparseable `int?` to null: the
 * value-conversion failure landed in ModelState and `[ApiController]` answered 400 through the
 * `InvalidModelStateResponseFactory` that `ProblemDetailsServiceCollectionExtensions` installs
 * (it replaces the factory, it does not suppress the filter). So `?page=abc` was a 400 there and
 * is a defaulted 200 here.
 *
 * Not corrected because the message text cannot be reproduced faithfully: it is ASP.NET's own
 * binding resource string, not one of the templates in `SPEC/30-Contracts.md`, and no fixture in
 * the corpus records one - so implementing the 400 means guessing the wording of the `errors`
 * entry, which is exactly the trap this comment used to be. Record a fixture against the frozen
 * .NET app first, then this becomes a two-line change.
 */
export function optionalInt(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** `int` is 32-bit and signed on the .NET side; `Int` is the same column here. */
const INT32_MIN = -2147483648
const INT32_MAX = 2147483647

/**
 * An `int?` BODY property with no attributes - `sortOrder`, `displayOrder`. Only a JSON number
 * **that an `int` could hold** is a value; anything else is read as omitted so the Application
 * layer applies its own default.
 *
 * (The query-string counterpart is `optionalInt` above: a query value arrives as text, so it
 * parses rather than type-checks. Same divergence, different input shape.)
 *
 * The range and integer checks are not pedantry - both cases were live faults on the status
 * routes, which carry the identical property:
 * - `{"sortOrder": 99999999999}` overflowed Prisma's `Int` and answered **500**. .NET bound
 *   `int?`, failed the conversion, and answered 400.
 * - `{"sortOrder": 1.5}` was accepted, the response ECHOED `1.5`, and the row stored `1` - so the
 *   create response contradicted the very next read. That is a state inconsistency, not only an
 *   infidelity.
 *
 * **A KNOWN DIVERGENCE, deliberate**, and the same one D1 recorded for `?page=abc`: every value
 * this reads as omitted - `"abc"`, `1.5`, `99999999999` alike - was a System.Text.Json or
 * value-conversion binding failure on the .NET side, which is a different envelope again, not the
 * model-binding one and not the Application one. No fixture in the corpus records it, so
 * reproducing the 400 means guessing the wording. Record one against the frozen .NET app first.
 */
export function optionalInt32(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= INT32_MIN &&
    value <= INT32_MAX
    ? value
    : null
}

/**
 * A `List<string>?` BODY property - `tagNames`, `mentionEmails`. Absent and null stay absent so the
 * Application layer can tell "not provided" from "provided empty"; a non-string ELEMENT becomes
 * `''`, which every consumer discards as blank.
 *
 * A present value that is NOT an array is REFUSED, which is the one place this file rejects rather
 * than defaults. The query coercions above only change the STATUS of a request that was going to be
 * rejected anyway; reading `{"title":"x","mentionEmails":"someone@example.test"}` as absent would
 * ACCEPT the request and silently discard content the caller asked for - a **201 with the @-mention
 * gone**, nobody notified and nothing recorded, and no way for the caller to tell. That is data
 * loss, not an infidelity. System.Text.Json could not bind a bare string to `List<string>` either,
 * so the model-binding envelope is the right one.
 *
 * **The exact .NET message text is unverified** - no fixture in the corpus sends a mistyped
 * `tagNames` or `mentionEmails`, so the wording is this API's own, following the same house
 * convention as the templates in `SPEC/30-Contracts.md` "Validation Message Conventions". Record
 * one against the frozen .NET app and replace it, exactly as `absent-body.pipe.ts` says for the
 * body-less request.
 *
 * `field` keys the `errors` entry AND names the message, so `mentionEmails` reads
 * `"Mention Emails is invalid."` - the camelCase key, spaced Title Case text split the conventions
 * pin.
 */
export function stringList(field: string, value: unknown): readonly string[] | null {
  if (value === undefined || value === null) {
    return null
  }
  if (!Array.isArray(value)) {
    throw new RequestValidationError({ [field]: [`${displayName(field)} is invalid.`] })
  }
  return value.map((item) => (typeof item === 'string' ? item : ''))
}

/** Canonical 8-4-4-4-12 hex form - the only shape a `uuid` column accepts. */
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/**
 * `default(Guid)`, which is what a non-nullable `Guid` property bound to when the JSON omitted it.
 * See `guidOrEmpty` for why a value that is not a GUID lands here too.
 */
export const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'

/**
 * A non-nullable `Guid` body property. Absent, null, or anything that is not a canonical GUID
 * binds to `default(Guid)` - which is what .NET did for an omitted key.
 *
 * `[RequiredField]` on such a property is a NO-OP and never turns any of those into a 400:
 * `RequiredAttribute` rejects null alone, and a boxed `Guid.Empty` is not null. A present-but-
 * malformed value was a System.Text.Json binding failure there (a different envelope again);
 * passing the raw text on instead is not an option, because it reaches a `uuid` column, Prisma
 * raises `P2023`, and the caller gets a **500**. Every consumer treats the empty GUID as "no such
 * row" and answers 400, which is the closer answer.
 */
export function guidOrEmpty(value: unknown): string {
  return isGuid(value) ? value.trim() : EMPTY_GUID
}

/**
 * A `Guid?` body property or query parameter (`statusId`, `user`, `sprintId`): the value when it is
 * a canonical GUID, `null` when absent or blank, and `EMPTY_GUID` when it is present but not a GUID.
 *
 * That last case is the interesting one. ASP.NET answered 400 - the same unreproducible
 * model-binding message `optionalInt` describes - and passing the raw text on instead is NOT an
 * option here: it reaches a `uuid` column, Prisma raises `P2023`, and the caller gets a **500**.
 * That is precisely the fault D1 shipped and had to fix. `EMPTY_GUID` is the honest middle: the
 * filter is applied and matches nothing, so a nonsense id narrows the list to empty rather than
 * being silently ignored (which would answer 200 with everything) or crashing. On a BODY property
 * it reaches a lookup that resolves against no row, which is the field-keyed 400 the route wants.
 */
export function optionalGuid(value: unknown): string | null {
  const text = optional(value)
  return text === null ? null : guidOrEmpty(text)
}

/** Whether a value is a canonical GUID - for the callers that must SKIP one rather than blank it. */
export function isGuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value.trim())
}
