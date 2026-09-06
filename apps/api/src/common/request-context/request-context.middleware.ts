import { randomUUID } from 'node:crypto'
import { Injectable, type NestMiddleware } from '@nestjs/common'
import { requestContextStorage } from './request-context.js'

/**
 * Opens an EMPTY store for every request. The auth guard fills it in.
 *
 * This must be middleware, not a guard: a guard's `canActivate` returns before the route
 * handler runs, so a store opened there is already closed by the time the handler needs it.
 * That is the single wiring detail most likely to be got wrong, and it fails as an absent
 * store rather than as a wrong identity.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(_req: unknown, _res: unknown, next: () => void): void {
    requestContextStorage.run({ identity: null, requestId: randomUUID() }, next)
  }
}
