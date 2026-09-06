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

export function createPrismaClient(): PrismaClient {
  return new PrismaClient()
}
