/**
 * Stands in for the `server-only` marker, which is not an installed package — Next resolves it
 * itself, so outside a Next build nothing can. `vitest.config.ts` aliases the specifier here.
 *
 * Empty on purpose: the marker's whole job is to fail a *build* that pulls a server module into a
 * client bundle, and `pnpm check` runs `next build` for exactly that. A unit test is neither, so
 * there is nothing here to assert and nothing to weaken.
 */
export {}
