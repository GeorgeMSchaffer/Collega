// The Prisma-backed `UnitOfWork` (see @collega/application/common). THE central design decision
// of this slice - see the slice report for the full reasoning. Summary:
//
// EF Core's `SaveChangesAsync` is a change-tracked unit of work: services mutate tracked entities
// and one `SaveChangesAsync` flushes everything as a transaction. Prisma has no change tracker -
// `prisma.x.update()` executes the instant it is awaited. Wave B ported the EF calling
// convention faithfully (one `saveChanges()` after N repository calls, sometimes after a loop),
// so this adapter has to make that convention true against a client with no equivalent mechanism.
//
// CHOSEN DESIGN: a command buffer, not an interactive transaction.
//
// Repositories build Prisma operations (`prisma.model.create({...})`, `.update({...})`, etc.)
// WITHOUT awaiting them - an un-awaited Prisma call is a `PrismaPromise`, a deferred query that
// has not been sent to the database - and hand them to `enqueue`. Nothing runs until
// `saveChanges()` calls `prisma.$transaction(operations)`, which sends the whole batch to Postgres
// as one transaction in one round trip.
//
// This was chosen over `prisma.$transaction(async (tx) => { ... })` (an "interactive transaction")
// for two reasons the task brief calls out explicitly:
//
// 1. An interactive transaction holds a database connection open for the ENTIRE callback, i.e.
//    for however long the use case's business logic takes to run - HTTP calls, validation,
//    anything between the first repository call and the last. On Vercel's connection-pooled
//    Postgres this is the difference between a transaction that holds a connection for
//    microseconds (just the final flush) and one that holds it for the whole request. The command
//    buffer only ever opens a transaction at the very end, for the batch itself.
// 2. An interactive transaction requires threading one `tx` client through every repository call
//    in a use case (or reaching for `AsyncLocalStorage` to make it ambient). Repositories here are
//    plain classes constructed once with a `PrismaClient` and a `UnitOfWork`; nothing about them
//    needs to change shape depending on whether a transaction is open, which keeps them
//    constructible the same way in Wave D's DI regardless of scope.
//
// This is also why it is Nest-serverless-safe in the way the brief asks about: nothing here is
// long-lived PROCESS state. The buffer lives on one `PrismaUnitOfWork` instance, which is
// request-scoped (one instance per request, holding no data before or after it) - not a
// module-level singleton reused across invocations. A cold or warm serverless invocation each get
// their own empty buffer.
//
// What this buys, mapped onto the three requirements the brief states explicitly:
// - "several staged writes, one commit, is atomic": they are `PrismaPromise`s pushed onto one
//   array, flushed by exactly one `$transaction(array)` call - Postgres executes that array as one
//   transaction.
// - "a loop that stages N writes and commits once after the loop is atomic across all N": the loop
//   just calls `enqueue` N times before the single `saveChanges()` - nothing distinguishes "10
//   enqueues from one call" from "10 enqueues from a loop of 10 calls".
// - "nothing commits without `saveChanges()`": operations sit inert in the array - a `PrismaPromise`
//   that has never been awaited or handed to `$transaction` never reaches the database. There is no
//   autocommit path.
//
// What this design does NOT support: reading back a value staged but not yet committed.
// `$transaction([...])`'s array form (as opposed to the interactive callback form) cannot depend
// on the result of an earlier operation in the same array - Prisma sends the whole batch before
// any of it has run. Every Wave B service that generates its own ids up front (SPEC/decisions.md
// 2026-09-06: ids come from the Application layer, never the database) avoids that dependency
// automatically, since nothing needs a generated key handed back.
//
// THAT CLAIM HAD A COUNTEREXAMPLE, and it was not generated ids - it was identity by VALUE.
// `packages/application/src/ideas/idea.service.ts`'s `importBoardIdeas` calls
// `TagsPort.getOrCreate` once per CSV row, with a single `saveChanges()` after the whole loop.
// When two rows name the same NEW tag ("backlog-2024" across twenty rows, an entirely ordinary
// import), a getOrCreate that only enqueues cannot see its own not-yet-committed create from the
// previous row: both rows would stage a `tags.create` for the same `(organization_id,
// normalized_name)`, and the batch would reject the whole import on
// `ux_tags_organization_id_normalized_name` - a general index, not one of the three this package
// translates to `ConflictError` - as an unhandled error, rolling back every valid row with it.
//
// EXCEPTION: `repositories/tag.repository.ts`'s `getOrCreate` does not use this buffer at all. It
// takes no `PrismaUnitOfWork`, awaits its writes directly, and retries on a lost race by re-reading
// and converging on the winner's row - mirroring the .NET `EfTagRepository`, which for the same
// reason "deliberately owns its own SaveChanges and a retry (rather than deferring to
// IUnitOfWork)" (see that file's header, and SPEC/20-feature-ideas-and-engagement.md "Tags" #7's
// merge requirement). This is safe specifically because a tag is an independent, reusable entity -
// nothing else in the same request depends on the tag NOT existing yet, unlike every other write in
// this package, which the referencing idea/comment/etc. genuinely does. DO NOT generalize this
// exception to another port without re-checking that same independence holds.

import type { UnitOfWork } from '@collega/application/common'
import type { PrismaClient, PrismaPromise } from '../generated/prisma/index.js'
import { translateWriteError } from './constraint-errors.js'

export class PrismaUnitOfWork implements UnitOfWork {
  private operations: PrismaPromise<unknown>[] = []

  constructor(private readonly prisma: PrismaClient) {}

  /** Stages a Prisma operation. MUST be an un-awaited call (`prisma.model.create({...})`, not
   * `await prisma.model.create({...})`) - awaiting it first would run it immediately, outside any
   * transaction and outside this unit of work's control. */
  enqueue(operation: PrismaPromise<unknown>): void {
    this.operations.push(operation)
  }

  /** Flushes every staged operation as one transaction, then clears the buffer. A no-op when
   * nothing is staged - callers do not need to guard every `saveChanges()` call against a
   * no-op use case. */
  async saveChanges(): Promise<void> {
    if (this.operations.length === 0) {
      return
    }

    const staged = this.operations
    this.operations = []

    try {
      await this.prisma.$transaction(staged)
    } catch (error) {
      throw translateWriteError(error)
    }
  }
}
