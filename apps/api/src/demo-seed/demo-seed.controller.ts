import { ForbiddenError } from '@collega/application/common'
import { Role } from '@collega/domain/enums'
import { resetDemoSeed, runDemoSeed } from '@collega/infrastructure/demo-seed'
import type { PrismaClient } from '@collega/infrastructure/persistence'
import { Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard.js'
import { Roles } from '../auth/roles.decorator.js'
import { RolesGuard } from '../auth/roles.guard.js'
import { PORT_TOKENS } from '../common/tokens.js'

/** What a run answers with, so the screen can say what happened rather than just "done". */
export type DemoSeedResult = {
  readonly deletedRows: number
  readonly modules: readonly { readonly module: string; readonly milliseconds: number }[]
}

/**
 * Seeding and resetting the demo data, from the settings screen.
 *
 * ## Why this exists at all
 *
 * A fresh deployment holds a bootstrap Site Admin and nothing else, and a Site Admin belongs to no
 * organization. So there is no organization to open, **nobody to view as**, and nothing to
 * demonstrate until somebody creates a world by hand. This is the one button that makes a deployed
 * environment demonstrable, and it runs exactly the code `pnpm db:seed` runs - the CLI is a wrapper
 * over the same two functions.
 *
 * ## The guard, and why it is an environment variable rather than a role check
 *
 * `SPEC/40-test-strategy.md` says the demo seed must never run in production, and
 * `prisma/seed/index.ts` enforces that with a hard refusal on `NODE_ENV`. Exposing a button that
 * seeds a deployed environment contradicts that flatly, so it is not done quietly:
 *
 * - The route is **absent unless `COLLEGA_ALLOW_DEMO_SEED` is set**, and it is unset by default.
 *   Turning it on is a deliberate act in the Vercel dashboard, reversible by deleting the variable,
 *   and it leaves a record of the decision where the decision was made.
 * - `@Roles(Role.SiteAdmin)` narrows it to the one account that belongs to no organization, which
 *   is also the only role whose own data this cannot destroy.
 *
 * **The role check is the coarse gate and the variable is the real one.** A Site Admin acting
 * through View As carries the target's role, so the guard alone would already refuse them - but the
 * variable is what decides whether the capability exists in this environment.
 *
 * It is read per request rather than captured at boot, so a warm container picks up a change
 * without waiting to be recycled. **That is not the same as taking effect without a redeploy, and
 * saying so once was wrong.** Vercel bakes environment variables into a deployment at build time,
 * so a function built before the variable existed never sees it however often it is read -
 * `apps/web/AGENTS.md` records the morning this cost, when a corrected `COLLEGA_API_URL` sat unused
 * because the build that should have carried it cancelled itself. Setting this variable requires a
 * new build of `collega-api` before the buttons work.
 *
 * ## What reset can and cannot reach
 *
 * Reset deletes only rows the seed owns, identified by the deterministic ids `seedId` derives from
 * the organization's slug - not by title, and not by "everything in the database". An organization
 * created by hand beside the demo data survives a reset of the demo data. That property is what
 * makes this safe enough to put behind a button at all, and it is asserted in
 * `resetDemoSeed`'s own header.
 */
@Controller('demo-seed')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.SiteAdmin)
export class DemoSeedController {
  constructor(@Inject(PORT_TOKENS.PrismaClient) private readonly prisma: PrismaClient) {}

  /**
   * Adds the demo world, leaving anything already there alone.
   *
   * Idempotent: every module upserts on a deterministic id, so running it twice is safe and is the
   * ordinary way to repair a catalog somebody renamed while exploring.
   */
  @Post()
  @HttpCode(200)
  async seed(): Promise<DemoSeedResult> {
    ensureEnabled()
    return { deletedRows: 0, modules: await runDemoSeed(this.prisma) }
  }

  /** Removes the demo world and builds it again, for a walkthrough that starts from the top. */
  @Post('reset')
  @HttpCode(200)
  async reset(): Promise<DemoSeedResult> {
    ensureEnabled()
    const deletedRows = await resetDemoSeed(this.prisma)
    return { deletedRows, modules: await runDemoSeed(this.prisma) }
  }
}

/**
 * Refuses unless the deployment has opted in.
 *
 * A 403 rather than a 404: the caller is a Site Admin who may legitimately ask, and telling them
 * the capability is switched off for this environment is more useful than pretending the route does
 * not exist. Nothing is leaked by saying so - the variable's presence is not a secret, and the
 * screen only offers the buttons when the answer is yes.
 *
 * **The kernel's `ForbiddenError`, not Nest's `ForbiddenException`**, and the difference is the
 * whole point of the sentence. `ProblemDetailsFilter` renders a framework exception through
 * `sendFramework`, which discards the message and answers "No further details are available for
 * this 403 response" - so the screen, which prints `detail` verbatim, would tell a Site Admin
 * nothing about why the button did not work. The kernel error carries its detail to the client.
 */
function ensureEnabled(): void {
  if ((process.env.COLLEGA_ALLOW_DEMO_SEED ?? '').trim() === '') {
    throw new ForbiddenError(
      'Demo seeding is switched off for this deployment. Set COLLEGA_ALLOW_DEMO_SEED on the ' +
        'project to enable it.',
    )
  }
}
