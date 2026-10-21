import { type EnvFragment, required } from '../fragment.js'

export type DatabaseConfig = {
  /** What Prisma connects with. */
  readonly url: string
}

/**
 * One connection per function instance on Vercel. Each warm instance opens its own pool, and a
 * page render fans out into parallel API calls that start several instances at once; with
 * Prisma's default pool size that exhausted the database's connection cap in production
 * (2026-10-21, "too many connections for role"). A URL that already sets `connection_limit`, or
 * isn't a direct `postgres(ql)://` string, is left alone.
 */
function limitConnections(url: string): string {
  if (!/^postgres(ql)?:\/\//.test(url) || /[?&]connection_limit=/.test(url)) return url
  return `${url}${url.includes('?') ? '&' : '?'}connection_limit=1`
}

/**
 * DATABASE_URL, or the POSTGRES_* parts the local docker-compose stack already sets.
 *
 * Both are accepted because they serve different places: Prisma Postgres on Vercel hands
 * over one URL, while the local container is configured by parts in `.env`. Composing the
 * URL here rather than asking a developer to keep a duplicate of it in sync is what stops
 * the two drifting.
 */
export const databaseFragment: EnvFragment<DatabaseConfig> = {
  name: 'database',
  read(env, problems) {
    const direct = env.DATABASE_URL?.trim()
    if (direct) return { url: env.VERCEL ? limitConnections(direct) : direct }

    const user = required(env, 'POSTGRES_USER', problems, 'Or set DATABASE_URL directly.')
    const password = required(env, 'POSTGRES_PASSWORD', problems, 'Or set DATABASE_URL directly.')
    const host = env.POSTGRES_HOST?.trim() || '127.0.0.1'
    const port = env.POSTGRES_HOST_PORT?.trim() || '5432'
    const name = env.POSTGRES_DB?.trim() || 'Collega'

    // 127.0.0.1 rather than localhost by default: docker publishes the container on IPv4
    // only, and Node resolves localhost to ::1 first, so the URL fails to connect.
    // Both credentials are encoded, not just the password: a username containing ':' or '@'
    // produces a URL that parses to the wrong host in exactly the same way.
    const credentials = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`
    return { url: `postgresql://${credentials}@${host}:${port}/${name}?schema=public` }
  },
}
