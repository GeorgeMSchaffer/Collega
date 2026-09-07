import { Inject, Injectable, Module, type OnModuleDestroy } from '@nestjs/common'
import { systemClock } from '@collega/application/common'
import { createPrismaClient, type PrismaClient } from '@collega/infrastructure/persistence'
import { ConfigModule } from '../config/config.module.js'
import { AlsCurrentUserContext } from '../request-context/als-current-user-context.js'
import { PORT_TOKENS } from '../tokens.js'
import { ADAPTER_PROVIDERS } from './adapters.providers.js'
import { AlsUnitOfWork } from './als-unit-of-work.js'

/** Closes the Prisma connection pool on shutdown (`app.enableShutdownHooks()` in main.ts). Not
 * exported - nothing else has a reason to depend on it. */
@Injectable()
class PrismaLifecycle implements OnModuleDestroy {
  constructor(@Inject(PORT_TOKENS.PrismaClient) private readonly prisma: PrismaClient) {}

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect()
  }
}

/**
 * Every port from `packages/application/src/*\/ports.ts` (plus the kernel's), bound to a
 * concrete adapter. D1-D7 import this module and inject a port by its `PORT_TOKENS` string,
 * never by constructing an adapter themselves - see `apps/api/CLAUDE.md`-equivalent guidance in
 * the D0 slice report for the full rationale.
 *
 * `PrismaClient` is built ONCE, at module load, and reused for the process's lifetime - Prisma
 * manages its own connection pool internally, and on Vercel's Fluid Compute a warm container
 * keeps this module scope alive across invocations (mirrors `createPrismaClient`'s own header
 * comment). This is safe specifically because a `PrismaClient` carries no per-user state; the
 * per-request `PrismaUnitOfWork` it is handed to (via `RequestContextMiddleware`) is what must
 * NOT be a similar singleton - see `als-unit-of-work.ts`.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    { provide: PORT_TOKENS.PrismaClient, useFactory: () => createPrismaClient() },
    AlsUnitOfWork,
    AlsCurrentUserContext,
    { provide: PORT_TOKENS.UnitOfWork, useExisting: AlsUnitOfWork },
    { provide: PORT_TOKENS.CurrentUserContext, useExisting: AlsCurrentUserContext },
    { provide: PORT_TOKENS.Clock, useValue: systemClock },
    ...ADAPTER_PROVIDERS,
    PrismaLifecycle,
  ],
  exports: [AlsUnitOfWork, AlsCurrentUserContext, ...Object.values(PORT_TOKENS)],
})
export class PersistenceModule {}
