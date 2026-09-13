/**
 * Server limits, restated for the client.
 *
 * **Every value here is a copy, and every copy must match its source exactly.** These are not
 * choices this layer gets to make — unlike `display.ts`, whose constants exist because comp Q says
 * so. A form that lets someone type past one of these accepts input the API will refuse, and the
 * person finds out after pressing the button.
 *
 * The restatement is forced: `apps/web` is HTTP-only and may not import `@collega/domain`
 * (`biome.json` `noRestrictedImports`, and `SPEC/50-typescript-migration.md` §4.3). So they are
 * collected here rather than scattered through the components that render them, which is how the
 * title cap came to be wrong: `new-idea-form.tsx` carried `maxLength={200}` — the *organization*
 * title cap — against an idea title limit of 150, so a 175-character title was accepted by the
 * browser and rejected by the API. Fixed 2026-09-13.
 *
 * **Nothing enforces this file.** `packages/domain/test/enums.test.ts` is the pattern that should
 * cover it — it reads `schema.prisma` as text and asserts the enums match member for member — and
 * the equivalent for this file belongs in `tools/arch`, which can read across the boundary that
 * `apps/web`'s own tests cannot. Until that exists, changing a limit means changing it twice.
 */

/** `packages/domain/src/ideas/idea.ts` — `TITLE_MAX_LENGTH`. */
export const TITLE_MAX_LENGTH = 150

/** `packages/domain/src/ideas/idea.ts` — `DESCRIPTION_MAX_LENGTH`. */
export const DESCRIPTION_MAX_LENGTH = 4000

/**
 * `packages/application/src/common/pagination.ts` — `MAX_PAGE_SIZE`.
 *
 * `normalizePageRequest` clamps to this rather than refusing, so asking for more returns this many
 * and reports nothing. A reader that wants "all of them" in one request is asking for at most this.
 */
export const API_MAX_PAGE_SIZE = 100

/**
 * `packages/application/src/common/pagination.ts` — `DEFAULT_PAGE_SIZE`.
 *
 * What a list endpoint returns when the request names no size.
 */
export const API_DEFAULT_PAGE_SIZE = 20
