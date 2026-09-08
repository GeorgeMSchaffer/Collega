// The Prisma-backed connection. Repositories take a `PrismaClient` in their constructor rather
// than importing a shared instance directly, so Wave D controls lifecycle (one client per
// serverless invocation, or one long-lived client in a traditional Node process) and tests can
// inject a fake.
//
// `createPrismaClient` is a convenience factory for the common case. On Vercel, Fluid Compute
// keeps a warm instance's module scope alive across invocations, so a client built once at module
// load and reused is the right default - re-connecting per request would pay a TLS handshake on
// every cold path. In an ordinary long-lived Node process (a local dev server, or `docker compose`)
// the same instance is reused for the life of the process. Nothing here holds a client across
// requests via a global mutable singleton - that choice belongs to whichever caller wires DI in
// Wave D, since only it knows whether it runs one process or one-per-request.

import { PrismaClient } from '../generated/prisma/index.js'

export type { PrismaClient } from '../generated/prisma/index.js'
export { Prisma } from '../generated/prisma/index.js'

/**
 * `url` is passed explicitly rather than left to Prisma's own `env("DATABASE_URL")` lookup.
 *
 * The host composes its connection string from either DATABASE_URL or the POSTGRES_* parts that
 * configure the local container, and validates the result. Letting Prisma read the environment
 * itself quietly discards that: a developer with only the parts set gets a config the host calls
 * valid and a client that cannot connect, because the composed URL was never handed to anything.
 * Omit it only where Prisma's own resolution is what you want - the CLI, which reads the schema.
 */
export function createPrismaClient(url?: string): PrismaClient {
  return url ? new PrismaClient({ datasources: { db: { url } } }) : new PrismaClient()
}
