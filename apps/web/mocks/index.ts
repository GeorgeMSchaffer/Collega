/**
 * The mock API, and the client that will outlive it.
 *
 * A screen imports from `@/mocks`. What it gets is the API client, the identity switcher's
 * mechanism, and the base URL — the three things that stay when the recordings go. The
 * server-side pieces (`corpus`, `router`, `serve`, `coverage`) are deliberately not
 * re-exported here: they read the filesystem, and a client component that imported one by
 * accident would fail at build time with a message about `node:fs` rather than about the
 * boundary it crossed.
 *
 * Start at `config.ts` — it is the swap point, and it explains the cutover in full.
 */

export { API_BASE_URL, USE_MOCK_API } from "./config";
export { ApiError, apiFetch, apiJson } from "./api-client";
export type { ApiRequestInit, MockDiagnostics, ProblemDetails } from "./api-client";
export {
  DEFAULT_MOCK_IDENTITY,
  MOCK_IDENTITIES,
  MOCK_ROLES,
  isMockIdentity,
} from "./identity";
export type { MockIdentity, MockRole } from "./identity";
export { MockIdentityProvider, useMockIdentity } from "./use-mock-identity";
export type { MockIdentityValue } from "./use-mock-identity";
