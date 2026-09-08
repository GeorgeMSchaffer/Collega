/**
 * The seam between `apps/web` and its data.
 *
 * Every reader here is async and every one is backed by `lib/mock.ts` today. When Wave D lands,
 * these bodies become `fetch` calls against the Nest host and `mock.ts` is deleted — the call
 * sites do not change, because they were written against a promise from the start.
 *
 * That is the whole point of the indirection. Before it existed, 37 files imported the fixture
 * module directly, so wiring the API meant editing all 37 across seven parallel Wave D slices,
 * each touching files the others also touched. Now it is one module per feature area.
 *
 * **Identity does not live here** — see `lib/session.ts` for why it stays synchronous.
 */

export * from './admin'
export * from './boards'
export * from './delivery'
export * from './ideas'
