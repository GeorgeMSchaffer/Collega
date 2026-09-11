import { RateLimitedError } from '@collega/application/common'
import { type ExecutionContext, Injectable } from '@nestjs/common'
import { ThrottlerGuard, type ThrottlerLimitDetail, type ThrottlerOptions } from '@nestjs/throttler'

/** Per-minute bucket. Shapes bursts. */
export const AUTH_BURST_THROTTLER = 'authBurst'

/** Per-hour bucket. The real ceiling; the minute limit only stops a burst getting there fast. */
export const AUTH_HOURLY_THROTTLER = 'authHourly'

/**
 * The limits for the anonymous auth surface, per IP and (because `ThrottlerGuard.generateKey`
 * hashes the controller and handler names into the key) per route, so login, register and
 * change-password each get their own bucket rather than sharing one.
 *
 * **Ten a minute and a hundred an hour**, with login raised to twenty a minute at its handler.
 * The numbers are about volume, not about a single request:
 *
 * - The hourly figure is the one that bites. A hundred sign-ins an hour from one address covers
 *   an office behind a single NAT egress starting its day; a credential-stuffing run needs
 *   thousands, and gets a hundred.
 * - The minute figure only stops that hundred being spent in half a second, which is what the
 *   security audit confirmed was possible (40 anonymous registers in 485ms).
 * - Login is raised to twenty because it is the one endpoint a shared egress hits repeatedly with
 *   DIFFERENT people behind it, and because the golden replay signs in eight times per run from
 *   one address (`tools/golden`, four role sessions plus three recorded login steps plus one
 *   credential override) - ten would leave the F1 gate two requests of headroom and `pnpm check`
 *   does not run the replay, so it would fail later and somewhere else.
 *
 * **This does NOT stop the account-lockout denial of service.** Five failed attempts lock an
 * account for fifteen minutes (`packages/domain/src/users/user.ts`), and five is below any limit
 * that lets real people sign in. Bounding volume is all this does; pairing the lockout with a
 * per-IP failure counter is what would fix that, and it needs failure state shared across
 * instances - see the storage note on `ThrottlerModule.forRoot` in `app.module.ts`.
 */
export const AUTH_THROTTLERS: readonly ThrottlerOptions[] = [
  { name: AUTH_BURST_THROTTLER, ttl: 60_000, limit: 10 },
  { name: AUTH_HOURLY_THROTTLER, ttl: 60 * 60_000, limit: 100 },
]

/**
 * `ThrottlerGuard` answering the kernel's `RateLimitedError` instead of its own
 * `ThrottlerException`, which is the entire reason this subclass exists.
 *
 * `ThrottlerException` is a plain `HttpException`, so `ProblemDetailsFilter` would render it
 * through `sendFramework` - a generic `type`, a `TooManyRequests` title and no cache-clearing
 * headers - and an exhausted limit here would not look like the 429 `AiUsageService` already
 * raises for the same kind of reason. One 429 envelope, which the filter already maps
 * (`problem-details.filter.ts`, `KERNEL_TYPE.rateLimited`).
 *
 * The caller IP comes from the inherited `getTracker`, which reads `req.ip`. That is only the
 * real client once Express has been told how many proxies to trust - `main.ts` does it, and
 * without it every request behind Vercel's proxy shares one bucket.
 */
@Injectable()
export class AuthRateLimitGuard extends ThrottlerGuard {
  protected override async throwThrottlingException(
    _context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new RateLimitedError(
      'Too many attempts from this address. Give it a moment and try again.',
      detail.timeToBlockExpire,
    )
  }
}
