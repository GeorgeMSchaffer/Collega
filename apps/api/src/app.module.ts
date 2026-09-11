import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common'
import { APP_FILTER, APP_PIPE } from '@nestjs/core'
import { ThrottlerModule } from '@nestjs/throttler'
import { FEATURE_MODULES } from './app.modules.generated.js'
import { AuthModule } from './auth/auth.module.js'
import { AUTH_THROTTLERS } from './auth/rate-limit.guard.js'
import { AbsentBodyPipe } from './common/absent-body.pipe.js'
import { ConfigModule } from './common/config/config.module.js'
import { ProblemDetailsFilter } from './common/errors/problem-details.filter.js'
import { HealthModule } from './common/health/health.module.js'
import { PersistenceModule } from './common/persistence/persistence.module.js'
import { RequestContextMiddleware } from './common/request-context/request-context.middleware.js'

/**
 * The composition root. D1-D7 never edit this file: `FEATURE_MODULES` is generated
 * (`app.modules.generated.ts`, `pnpm generate:modules`) from whatever `apps/api/src/<feature>/
 * <feature>.module.ts` files exist, so seven agents adding a module never touch the same line.
 */
@Module({
  imports: [
    ConfigModule,
    PersistenceModule,
    // Registered globally (the module is `@Global()`) but APPLIED nowhere by default - there is
    // no `APP_GUARD` here on purpose. Only the three handlers that carry `AuthRateLimitGuard`
    // are limited, so nothing else in the corpus changes behaviour under replay.
    //
    // BEST EFFORT, NOT A GUARANTEE, AND THE DEPLOYMENT IS WHY. The default store is an in-process
    // Map with a `setTimeout` per key. On Vercel the API is serverless: every cold start is a new
    // process with an empty Map, concurrent instances each keep their own, and neither survives
    // the invocation going idle. So the ceiling a caller actually meets is "10 a minute PER WARM
    // INSTANCE", which under load is some multiple of what this file says. It still ends the
    // unbounded case the security audit confirmed - 40 registrations in 485ms all landed on one
    // instance - but do not read these numbers as a bound anyone can rely on. A shared store
    // (Redis / Vercel KV) behind `ThrottlerModule`'s `storage` option is what would make them one;
    // that is a dependency and an operational cost, so it is a recommendation, not this change.
    //
    // `setHeaders: false` because the library's own headers are named after this file's internals.
    // Left on it sends `X-RateLimit-Limit-authBurst`, `-Remaining-authBurst`, `-Reset-authBurst`
    // and the `authHourly` trio on every auth response, plus `Retry-After-authBurst` beside the
    // real `Retry-After` on a 429 - so `AUTH_BURST_THROTTLER`'s value, an implementation detail,
    // becomes something callers can read and depend on, and renaming a bucket becomes a breaking
    // change. `ProblemDetailsFilter` already sends the one header `SPEC/30-Contracts.md` promises,
    // from `RateLimitedError.retryAfterSeconds`, so this leaves exactly one writer for it rather
    // than two. Reversible, and worth reversing as a deliberate choice: unsuffixed `X-RateLimit-*`
    // are genuinely useful to a client, but they belong in the contract first.
    ThrottlerModule.forRoot({ throttlers: [...AUTH_THROTTLERS], setHeaders: false }),
    AuthModule,
    HealthModule,
    ...FEATURE_MODULES,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    // Global, not per controller, so a route added later cannot 500 on a body-less request by
    // forgetting to guard - and so the testing module gets it too, which `main.ts` would not give.
    { provide: APP_PIPE, useClass: AbsentBodyPipe },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Every route, unconditionally - identity/persistence context must exist before ANY guard
    // or handler runs. `'*path'`, not `'*'`: Nest 11's Express 5 + path-to-regexp v8 throws at
    // boot on a bare wildcard (findings 07 section 3.3).
    consumer.apply(RequestContextMiddleware).forRoutes('*path')
  }
}
