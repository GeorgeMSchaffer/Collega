/**
 * `pnpm start` — the whole application, from a fresh clone, in one command.
 *
 * Before this existed, running Collega locally meant knowing seven things in the right order: copy
 * an env file, start a database container, deploy the migrations, build three packages so the seed
 * can import them, seed, build and run the API on one port, run the web dev server on another. Every
 * one of them is written down somewhere, which is not the same as being runnable, and the cost was
 * paid by whoever was newest.
 *
 * `.claude/hooks/session-start.sh` already did most of this for the cloud containers and is where
 * the steps below come from. The two are deliberately NOT merged: the hook installs a Node version
 * and a PostgreSQL server into a disposable container that has neither, which is exactly what a
 * developer's machine must not have done to it. This script assumes those and arranges the rest.
 *
 * It is idempotent — run it as often as you like. Migrations deploy only what is missing, the seed
 * upserts, and the builds are Turbo-cached.
 */

import { spawn, spawnSync } from 'node:child_process'
import { appendFileSync, copyFileSync, existsSync, readFileSync } from 'node:fs'
import { createConnection } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const ENV_FILE = join(ROOT, '.env')
const API_PORT = '3001'
const WEB_PORT = '3000'

function say(message: string): void {
  console.log(`\n\x1b[36m▸ ${message}\x1b[0m`)
}

function fail(message: string): never {
  console.error(`\n\x1b[31m${message}\x1b[0m\n`)
  process.exit(1)
}

/**
 * `KEY=VALUE` lines, which is all `.env` holds and all the Prisma CLI reads out of it.
 *
 * Hand-parsed rather than through `--env-file`, because this script has to *derive* one variable
 * from the others before anything runs, and because Node's env-file precedence rules are one more
 * thing to be wrong about when a value is already exported in the shell.
 */
function readEnvFile(): Map<string, string> {
  const values = new Map<string, string>()
  if (!existsSync(ENV_FILE)) return values

  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const text = line.trim()
    if (text === '' || text.startsWith('#')) continue
    const separator = text.indexOf('=')
    if (separator > 0) values.set(text.slice(0, separator).trim(), text.slice(separator + 1).trim())
  }
  return values
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv = {}): void {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  })
  if (result.status !== 0) {
    fail(`\`${command} ${args.join(' ')}\` failed. Nothing after it has run.`)
  }
}

/** Whether something is listening, which is the only question this script has about a database. */
function listening(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((done) => {
    const socket = createConnection({ port, host })
    const settle = (answer: boolean) => {
      socket.destroy()
      done(answer)
    }
    socket.setTimeout(1000)
    socket.once('connect', () => settle(true))
    socket.once('timeout', () => settle(false))
    socket.once('error', () => settle(false))
  })
}

async function waitForPort(port: number, seconds: number): Promise<boolean> {
  for (let attempt = 0; attempt < seconds; attempt++) {
    if (await listening(port)) return true
    await new Promise((tick) => setTimeout(tick, 1000))
  }
  return false
}

// --- 1. .env ----------------------------------------------------------------------------------
// The committed example carries placeholder passwords for a throwaway local container and nothing
// real, so copying it is safe. A `.env` that already exists is never edited except to add the one
// line the Prisma CLI cannot do without.
if (!existsSync(ENV_FILE)) {
  say('.env — copying .env.example')
  copyFileSync(join(ROOT, '.env.example'), ENV_FILE)
}

let env = readEnvFile()

/**
 * The connection string, in the one spelling Prisma wants.
 *
 * An exported `DATABASE_URL` wins, so pointing this at a cluster you already run takes no edit at
 * all. Otherwise it is composed from the `POSTGRES_*` parts `.env.example` documents and written
 * back, because `prisma migrate` and `prisma studio` read `env("DATABASE_URL")` from the schema and
 * cannot see those parts — a fact that has cost more than one person an afternoon.
 */
const databaseUrl =
  process.env.DATABASE_URL ??
  env.get('DATABASE_URL') ??
  (() => {
    const user = env.get('POSTGRES_USER') ?? 'collega'
    const password = env.get('POSTGRES_PASSWORD') ?? ''
    const port = env.get('POSTGRES_HOST_PORT') ?? '5432'
    const url = `postgresql://${user}:${encodeURIComponent(password)}@127.0.0.1:${port}/Collega?schema=public`
    appendFileSync(
      ENV_FILE,
      `\n# Written by tools/local/start.ts, from the POSTGRES_* values above.\nDATABASE_URL=${url}\n`,
    )
    say('.env — added DATABASE_URL, composed from the POSTGRES_* values already in it')
    return url
  })()

env = readEnvFile()
const postgresPort = Number(new URL(databaseUrl).port || '5432')

// --- 2. PostgreSQL ------------------------------------------------------------------------------
// Docker only when nothing is listening. Somebody running their own PostgreSQL, or one of the
// cloud containers where `.claude/hooks/session-start.sh` installed a native cluster, must not have
// a second one started underneath them.
if (await listening(postgresPort)) {
  say(`PostgreSQL — already listening on ${postgresPort}`)
} else {
  say(`PostgreSQL — nothing on ${postgresPort}, starting the docker compose service`)
  const docker = spawnSync('docker', ['compose', 'up', '-d', 'postgres'], {
    cwd: ROOT,
    stdio: 'inherit',
  })
  if (docker.error || docker.status !== 0) {
    fail(
      `No PostgreSQL on port ${postgresPort}, and \`docker compose up -d postgres\` could not start one.\n` +
        'Either start Docker Desktop and run this again, or point DATABASE_URL at a PostgreSQL 16\n' +
        'you already run and set it in .env.',
    )
  }
  if (!(await waitForPort(postgresPort, 60))) {
    fail(`The postgres container started but nothing is listening on ${postgresPort}.`)
  }
}

// --- 3. Dependencies and the packages the seed imports -------------------------------------------
if (!existsSync(join(ROOT, 'node_modules'))) {
  say('pnpm install')
  run('pnpm', ['install'])
}

// Building the API builds everything under it — domain, application, infrastructure — which is what
// the seed needs to import, and what `node apps/api/dist/main.js` needs to exist. Turbo caches it,
// so every run after the first costs a couple of seconds.
say('build — apps/api and the packages beneath it')
run('pnpm', ['exec', 'turbo', 'run', 'build', '--filter=@collega/api'], {
  DATABASE_URL: databaseUrl,
})

// --- 4. Schema and demo data ---------------------------------------------------------------------
say('database — migrate, then seed')
run('pnpm', ['--filter', '@collega/infrastructure', 'db:migrate'], { DATABASE_URL: databaseUrl })
run('pnpm', ['--filter', '@collega/infrastructure', 'db:seed'], {
  DATABASE_URL: databaseUrl,
  SITE_ADMIN_EMAIL: env.get('SITE_ADMIN_EMAIL') ?? 'admin@collega.local',
  SITE_ADMIN_PASSWORD: env.get('SITE_ADMIN_PASSWORD') ?? 'Ch4ngeMe!Now',
})

// --- 5. Both halves, until Ctrl+C -----------------------------------------------------------------
// The API is the built output rather than a watcher: it is the half nobody editing a screen touches,
// and `next dev` is the half that has to reload. Re-run this script after changing the API.
const serverEnv: NodeJS.ProcessEnv = {
  ...process.env,
  ...Object.fromEntries(env),
  DATABASE_URL: databaseUrl,
  PORT: API_PORT,
}

/**
 * Each server in its own process group, so stopping it stops what it started.
 *
 * `pnpm --filter @collega/web dev` is a wrapper around a wrapper: killing the pnpm process leaves
 * `next dev` holding port 3000, and the next run of this script fails on a port that nothing
 * visible owns. Signalling the whole group (`-pid`) is what actually ends it. Windows has no
 * process groups, so there the pid is signalled directly and pnpm passes it down itself.
 */
const GROUPED = process.platform !== 'win32'

function server(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return spawn(command, args, { cwd: ROOT, stdio: 'inherit', env, detached: GROUPED })
}

function stop(child: ReturnType<typeof server>, signal: NodeJS.Signals = 'SIGTERM'): void {
  if (child.pid === undefined || child.exitCode !== null) return
  try {
    process.kill(GROUPED ? -child.pid : child.pid, signal)
  } catch {
    // Already gone — which is the case whenever this runs because the other half died first.
  }
}

const api = server('node', [join('apps', 'api', 'dist', 'main.js')], serverEnv)

say(`API — starting on ${API_PORT}`)
if (!(await waitForPort(Number(API_PORT), 30))) {
  stop(api)
  fail('The API did not start. Its output is above.')
}

// No COLLEGA_API_URL: `apps/web/lib/api/config.ts` defaults to this exact address, and setting it
// here would hide the day that default stops being right.
const web = server('pnpm', ['--filter', '@collega/web', 'dev'], { ...serverEnv, PORT: WEB_PORT })

console.log(`
\x1b[32m▸ Collega is running.\x1b[0m

  Web   http://localhost:${WEB_PORT}
  API   http://localhost:${API_PORT}/api/v1

  Sign in with any demo account — the seed gives all of them the same
  development-only password, which is DEMO_PASSWORD in
  packages/infrastructure/prisma/seed/modules/scenario.ts:

    orgadmin@acme-robotics.demo.collega.test    creates, moves and administers
    user@acme-robotics.demo.collega.test        creates and moves
    readonly@acme-robotics.demo.collega.test    reads and upvotes

  Ctrl+C stops both.
`)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    stop(api, signal)
    stop(web, signal)
    process.exit(0)
  })
}

// If either half dies on its own, the other is no longer useful — a web server with no API behind
// it serves an error boundary on every authenticated page.
for (const child of [api, web]) {
  child.on('exit', (code) => {
    stop(api)
    stop(web)
    process.exit(code ?? 1)
  })
}
