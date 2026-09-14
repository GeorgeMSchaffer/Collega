import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * The suite's own database, and the guard that keeps it its own.
 *
 * Every spec below runs against a schema this file drops and rebuilds, because a suite that shares
 * a database with the developer running it is a suite that either fails on their data or destroys
 * it. The isolation is a Postgres **schema** rather than a second database: `prisma migrate reset`
 * drops and re-applies into whatever `?schema=` names, so this needs no CREATE DATABASE privilege
 * and no second container, and `public` — where `pnpm dev` keeps the demo data — is untouched.
 *
 * `COLLEGA_E2E_DATABASE_URL` overrides it outright, for CI with a database of its own.
 */
function e2eDatabaseUrl(): string {
  const explicit = process.env.COLLEGA_E2E_DATABASE_URL?.trim()
  if (explicit) return explicit

  const base = process.env.DATABASE_URL?.trim()
  if (!base) {
    throw new Error(
      'Neither COLLEGA_E2E_DATABASE_URL nor DATABASE_URL is set.\n\n' +
        'The E2E suite needs a database it may drop. Run `pnpm dev` once to write DATABASE_URL into\n' +
        '.env, or set COLLEGA_E2E_DATABASE_URL to a throwaway of your own.',
    )
  }

  const url = new URL(base)
  url.searchParams.set('schema', 'collega_e2e')
  return url.toString()
}

/**
 * Refuses to reset anything a developer is using.
 *
 * `migrate reset` drops every table it can see, so pointing it at the wrong string is not a failed
 * test run, it is a lost afternoon. Two things are checked: the schema must be the suite's own, and
 * the host must be this machine. The second is the same rule `tools/local/start.ts` applies for the
 * same reason, and there is deliberately no opt-out here — a remote database is never the right
 * target for a suite whose first act is to drop the schema.
 */
function refuseIfNotDisposable(url: string): void {
  const parsed = new URL(url)
  const schema = parsed.searchParams.get('schema')
  if (schema !== 'collega_e2e') {
    throw new Error(
      `The E2E database URL names schema "${schema ?? 'public'}", not "collega_e2e".\n\n` +
        'This setup drops the schema it is given. Point COLLEGA_E2E_DATABASE_URL at a URL carrying\n' +
        '?schema=collega_e2e, or unset it and let DATABASE_URL be adapted.',
    )
  }

  const host = parsed.hostname
  const local = host === 'localhost' || host === '::1' || host.startsWith('127.')
  if (!local) {
    throw new Error(
      `The E2E database is at ${host}, which is not this machine.\n\n` +
        'The suite drops and rebuilds its schema on every run. It will not do that to a host it\n' +
        'cannot see is yours.',
    )
  }
}

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
  const databaseUrl = e2eDatabaseUrl()
  refuseIfNotDisposable(databaseUrl)

  // The API runs as built output, not under a watcher — the same shape `tools/local/start.ts` uses,
  // and for the same reason: nothing in a test run edits it. Building it builds the packages
  // beneath it, which is also what the seed imports. Turbo caches, so this is seconds after the
  // first run.
  run('pnpm', ['exec', 'turbo', 'run', 'build', '--filter=@collega/api'], {
    DATABASE_URL: databaseUrl,
  })

  // Dropped and rebuilt rather than migrated forward: the point is a known state, not an
  // incremental one. A spec that moves a card leaves the board changed, and the next run must not
  // inherit it.
  //
  // `DROP SCHEMA` rather than `prisma migrate reset`, and the difference is the blast radius.
  // `reset` drops everything the connection can see and is the wrong shape for a suite sharing a
  // database with a developer; this names `collega_e2e` in the SQL, so what is destroyed is visible
  // at the call site and is the schema `refuseIfNotDisposable` has already insisted on.
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

  // Read back by playwright.config.ts, so the API server starts against the same schema this just
  // rebuilt rather than re-deriving it and risking a different answer.
  process.env.COLLEGA_E2E_DATABASE_URL = databaseUrl
}
