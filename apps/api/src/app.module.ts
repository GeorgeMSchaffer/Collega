import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common'
import { APP_FILTER, APP_PIPE } from '@nestjs/core'
import { FEATURE_MODULES } from './app.modules.generated.js'
import { AuthModule } from './auth/auth.module.js'
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
  imports: [ConfigModule, PersistenceModule, AuthModule, HealthModule, ...FEATURE_MODULES],
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
