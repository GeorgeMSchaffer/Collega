import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { type AiConfig, aiFragment } from './fragments/ai.js'
import { type DatabaseConfig, databaseFragment } from './fragments/database.js'
import { type SiteAdminConfig, siteAdminFragment } from './fragments/site-admin.js'

export type { EnvFragment } from './fragment.js'
export type { AiConfig, DatabaseConfig, SiteAdminConfig }

export type Config = {
  readonly ai: AiConfig
  readonly database: DatabaseConfig
  readonly siteAdmin: SiteAdminConfig
}

/** Every fragment. A feature slice adds its own here and writes nothing else in this file. */
const FRAGMENTS = {
  ai: aiFragment,
  database: databaseFragment,
  siteAdmin: siteAdminFragment,
} as const

export class ConfigError extends Error {
  constructor(problems: readonly string[]) {
    super(
      `The environment is not usable:\n${problems.map((p) => `  - ${p}`).join('\n')}\n` +
        'Local development reads these from .env at the repository root; .env.example lists ' +
        'every name. On Vercel they are project environment variables.',
    )
    this.name = 'ConfigError'
  }
}

/**
 * Loads `.env` into `process.env`, if it is there.
 *
 * `.env` is the single source for these values in local development - there is deliberately
 * no second home for a credential, because the .NET stack kept the Anthropic key under three
 * names at once and two of them were read by nothing.
 *
 * Existing environment variables WIN over the file: that is what lets CI and Vercel, which
 * inject real variables and ship no .env, work without a special case.
 */
function loadEnvFile(): void {
  // Node 24 reads .env natively, so this needs no dependency.
  const path = resolve(process.cwd(), '.env')
  if (existsSync(path)) process.loadEnvFile(path)
}

/**
 * Reads and validates the whole environment once.
 *
 * Every fragment runs even after one reports a problem, so a deployment missing four
 * variables is told all four at once rather than discovering them one redeploy at a time.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  loadEnvFile()

  const problems: string[] = []
  const config = {
    ai: FRAGMENTS.ai.read(env, problems),
    database: FRAGMENTS.database.read(env, problems),
    siteAdmin: FRAGMENTS.siteAdmin.read(env, problems),
  }

  if (problems.length > 0) throw new ConfigError(problems)
  return config
}
