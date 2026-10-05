import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { e2eDatabaseUrl, loadRepositoryEnv } from './database-url.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// The suite runs against its own Postgres **schema** rather than a second database: everything
// below drops and rebuilds `collega_e2e`, so `public` - where `pnpm dev` keeps the demo data - is
// untouched. The derivation lives in `database-url.ts` because `playwright.config.ts` needs the
// same answer at module-load time; read that file before changing where it points.

const DROP_AND_CREATE = 'DROP SCHEMA IF EXISTS collega_e2e CASCADE; CREATE SCHEMA collega_e2e;'

/**
 * `pnpm` is a `.cmd` shim on Windows, which needs a shell to execute — and a shell concatenates
 * arguments rather than escaping them, which Node warns about.
 *
 * Rather than fight that, **no argument here carries a value worth escaping**: every one is a
 * literal this file wrote. The connection string in particular never appears in `argv` — Prisma
 * reads it from `DATABASE_URL` through the datasource block, which is also how `pnpm dev` and the
 * deploy build reach it, so there is one path rather than two.
 */
const SHELL = process.platform === 'win32'

function run(command: string, args: string[], env: NodeJS.ProcessEnv, stdin?: string): void {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: stdin === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
    input: stdin,
    env: { ...process.env, ...env },
    shell: SHELL,
  })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited ${String(result.status)}`)
  }
}

export default function globalSetup(): void {
  // Idempotent, and here as well as in the config because Playwright may load this module in a
  // process that has not evaluated the config - real environment variables win either way.
  loadRepositoryEnv()

  // Refuses anything but a local `collega_e2e` schema - checked again here, not only when the config
  // loaded, because this is the step that drops it.
  const databaseUrl = e2eDatabaseUrl()

  // Nothing is built here. This runs after both servers are up (see the order in
  // `playwright.config.ts`), and the API's own `webServer` command has already built it and the
  // packages beneath it, which are also what the seed imports. Rebuilding while the API runs is not
  // just redundant: on Windows a rebuild that rewrites `packages/infrastructure/dist/generated`
  // under the running API failed with the Prisma client "used by another process" (2026-09-29).

  // Dropped and rebuilt rather than migrated forward: the point is a known state, not an
  // incremental one. A spec that moves a card leaves the board changed, and the next run must not
  // inherit it.
  //
  // `DROP SCHEMA` rather than `prisma migrate reset`, and the difference is the blast radius.
  // `reset` drops everything the connection can see and is the wrong shape for a suite sharing a
  // database with a developer; this names `collega_e2e` in the SQL, so what is destroyed is visible
  // at the call site and is the schema `e2eDatabaseUrl` has already insisted on.
  run(
    'pnpm',
    [
      '--filter',
      '@collega/infrastructure',
      'exec',
      'prisma',
      'db',
      'execute',
      '--schema',
      'prisma/schema.prisma',
      '--stdin',
    ],
    { DATABASE_URL: databaseUrl },
    DROP_AND_CREATE,
  )

  run('pnpm', ['--filter', '@collega/infrastructure', 'db:migrate'], { DATABASE_URL: databaseUrl })

  // **SITE_ADMIN_* is deliberately not passed here.** The seed reads them to create a tenth,
  // separately-configured Site Admin on top of its nine demo users - and the demo roster already
  // contains one, `siteadmin@demo.collega.test`. Passing that address makes the seed collide with
  // itself on `users.normalized_email`; passing any other adds an account with
  // `mustChangePassword` set, which every spec would then have to step around. Nine is what the
  // specs want. The "seeding 9 users, not 10" line the seed prints is information, not a warning.
  //
  // NODE_ENV is not 'production' because the demo seed refuses to run when it is, and the demo data
  // is exactly what these specs assert against.
  run('pnpm', ['--filter', '@collega/infrastructure', 'db:seed'], {
    DATABASE_URL: databaseUrl,
    NODE_ENV: 'test',
  })
}
