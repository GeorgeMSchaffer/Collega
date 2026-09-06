import { type EnvFragment, required } from '../fragment.js'

export type DatabaseConfig = {
  /** What Prisma connects with. */
  readonly url: string
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
    if (direct) return { url: direct }

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
