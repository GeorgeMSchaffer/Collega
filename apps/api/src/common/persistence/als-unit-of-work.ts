import { Injectable } from '@nestjs/common'
import { PrismaUnitOfWork } from '@collega/infrastructure/persistence'
import { NoAmbientUnitOfWorkError, unitOfWorkStorage } from './unit-of-work-context.js'

/**
 * The `UnitOfWork`/`PrismaUnitOfWork` every repository is constructed with, exactly once, at
 * bootstrap. Singleton with a lazy delegate, the same shape as `AlsCurrentUserContext` next
 * door and for the identical reason: a repository built once and reused across a warm
 * serverless container must never hold a field that was correct for one request and stale for
 * the next. Every call here dereferences the live per-request buffer instead.
 *
 * WHY NOT `Scope.REQUEST`. Nest's request scope was rejected for `CurrentUserContext` in
 * findings 07 section 3.1, and every reason given there applies here at least as strongly:
 *
 * - Scope contagion: 07 measured `CurrentUserContext` as reachable from 14 of 16 Application
 *   services. The unit of work is reachable from EVERY ONE OF THEM - all sixteen concrete
 *   repository adapters take a `PrismaUnitOfWork` constructor argument (the two carve-outs,
 *   `tag.repository.ts`'s `getOrCreate` and the audit writer, commit outside the buffer but are
 *   still constructed alongside it), and every service that writes anything depends on a
 *   repository that does. Request-scoping this provider would request-scope essentially the
 *   entire persistence graph, not 14 of 16 services - worse than the case 07 already rejected.
 * - It cannot cross the layer boundary: `Scope.REQUEST` is `@nestjs/common`, and
 *   `packages/application`/`packages/infrastructure` may not import Nest. The scope decision
 *   would have to live in a `useFactory` in `apps/api`, invisible from the repository classes
 *   whose lifetime it is actually protecting - the same objection 07 raised.
 * - Testability: every repository test constructs its class directly with a plain
 *   `PrismaUnitOfWork` (or a fake). Request-scoped DI would mean a repository test needs a Nest
 *   testing module purely to get an instance, which 07 already ruled out for the same reason.
 *
 * Serverless-safe for the same reason `AlsCurrentUserContext` is: nothing here is long-lived
 * process state. `unitOfWorkStorage` holds a fresh `PrismaUnitOfWork` per request (opened in
 * `RequestContextMiddleware`), and this class is a stateless pass-through others reuse forever.
 */
@Injectable()
export class AlsUnitOfWork extends PrismaUnitOfWork {
  constructor() {
    // Never read: every inherited method is overridden below, so the inherited `prisma` field
    // this passes to `super` is dead weight, not a live client.
    super(undefined as never)
  }

  override enqueue(...args: Parameters<PrismaUnitOfWork['enqueue']>): void {
    this.current.enqueue(...args)
  }

  override saveChanges(): Promise<void> {
    return this.current.saveChanges()
  }

  private get current(): PrismaUnitOfWork {
    const uow = unitOfWorkStorage.getStore()
    if (!uow) throw new NoAmbientUnitOfWorkError()
    return uow
  }
}
