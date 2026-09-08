import type { PrismaClient } from '../../src/generated/prisma/client.js'

/**
 * One feature's contribution to the demo seed.
 *
 * The seed is split this way because every feature wants to seed demo data and there is
 * only one database - so without composition, every Wave B-E slice would be editing one
 * seed file. A slice adds a module under ./modules and touches nothing else.
 * SPEC/50-typescript-migration.md section 4.2.
 */
export type SeedModule = {
  /** Unique, and the name other modules use in `dependsOn`. */
  readonly name: string

  /** Modules that must run first. Cycles are an error, not a warning. */
  readonly dependsOn?: readonly string[]

  /**
   * Must be idempotent. The seeder runs on every boot in development, so a module that
   * blindly inserts produces duplicates on the second run - use upserts keyed on
   * something stable, not `create`.
   */
  seed(prisma: PrismaClient): Promise<void>
}
