import { randomUUID } from 'node:crypto'
import { Inject, Injectable, type NestMiddleware } from '@nestjs/common'
import { PrismaUnitOfWork } from '@collega/infrastructure/persistence'
import type { PrismaClient } from '@collega/infrastructure/persistence'
import { unitOfWorkStorage } from '../persistence/unit-of-work-context.js'
import { PORT_TOKENS } from '../tokens.js'
import { requestContextStorage } from './request-context.js'

/**
 * Opens an EMPTY identity store and a FRESH `PrismaUnitOfWork` for every request. The auth
 * guard fills in identity; every repository, constructed once at bootstrap against the
 * singleton `AlsUnitOfWork`, fills in the unit of work merely by being called.
 *
 * This must be middleware, not a guard: a guard's `canActivate` returns before the route
 * handler runs, so a store opened there is already closed by the time the handler needs it.
 * That is the single wiring detail most likely to be got wrong, and it fails as an absent
 * store rather than as a wrong identity.
 *
 * The two `.run()` calls nest rather than merge into one store: `requestContextStorage` is the
 * one `tools/arch/identity-chokepoint.test.ts` polices, and adding a second, unrelated field to
 * it would put persistence state under an assertion about identity reads. See
 * `unit-of-work-context.ts`'s header for the rest of that reasoning.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(@Inject(PORT_TOKENS.PrismaClient) private readonly prisma: PrismaClient) {}

  use(_req: unknown, _res: unknown, next: () => void): void {
    requestContextStorage.run({ identity: null, requestId: randomUUID() }, () => {
      unitOfWorkStorage.run(new PrismaUnitOfWork(this.prisma), next)
    })
  }
}
