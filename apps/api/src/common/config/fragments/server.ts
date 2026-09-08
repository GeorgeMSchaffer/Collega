import type { EnvFragment } from '../fragment.js'

export type ServerConfig = {
  readonly port: number
}

const DEFAULT_PORT = 3001 // apps/web takes Next's default 3000; this avoids the collision.

/** PORT - Vercel injects it; local dev falls back to DEFAULT_PORT. */
export const serverFragment: EnvFragment<ServerConfig> = {
  name: 'server',
  read(env, problems) {
    const raw = env.PORT?.trim()
    const port = raw ? Number(raw) : DEFAULT_PORT
    if (!Number.isInteger(port) || port <= 0) {
      problems.push('PORT must be a positive integer.')
    }
    return { port }
  },
}
