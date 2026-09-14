import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Loads the repository's own `.env`, so the seed scripts can be run on their own.
 *
 * `pnpm dev` passes `DATABASE_URL` to these scripts explicitly (`tools/local/start.ts`), and until
 * 2026-09-14 that was the only way they ever ran. Invoked directly — `pnpm --filter
 * @collega/infrastructure db:seed`, which is exactly what `README.md` and this folder's own doc
 * comments tell you to type — they died on
 * `Environment variable not found: DATABASE_URL`, from inside a Prisma call, several frames deep.
 * Nothing about that message says "run a different command".
 *
 * **Real environment variables win.** `process.loadEnvFile` does not overwrite what is already set,
 * which is what keeps this from quietly redirecting a deployment: Vercel's build runs
 * `db:migrate` and `db:bootstrap-admin` with `DATABASE_URL` already in the environment and no
 * `.env` on disk, so this is a no-op there.
 */
export function loadRepositoryEnv(): void {
  const envFile = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '.env')
  if (existsSync(envFile)) process.loadEnvFile(envFile)
}
