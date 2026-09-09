/**
 * The value coercions every controller needs on the way in from a body or a query string, in one
 * place so three copies cannot drift apart and a fourth cannot be written slightly differently.
 *
 * `validateFields` (`errors/request-validation.error.ts`) is the other half of this boundary: it
 * decides whether a request is REFUSED; these decide what an accepted value MEANS.
 */

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
 * Not corrected for the reason `optionalInt` records at length in `organizations.controller.ts`:
 * the 400's message is ASP.NET's own binding resource string, not one of the templates in
 * `SPEC/30-Contracts.md`, and no fixture in the corpus records one - so implementing it means
 * guessing the wording. Record a fixture against the frozen .NET app first.
 */
export function queryBool(value: unknown): boolean {
  return String(value).toLowerCase() === 'true'
}
