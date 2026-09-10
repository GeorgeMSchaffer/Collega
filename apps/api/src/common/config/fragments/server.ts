import type { EnvFragment } from '../fragment.js'

export type ServerConfig = {
  readonly port: number

  /**
   * How many proxy hops Express may believe when it derives `req.ip` from `x-forwarded-for`.
   *
   * Zero unless the process is running on Vercel, and that asymmetry is the point. Vercel
   * OVERWRITES `x-forwarded-for` with the real client address and does not forward a
   * caller-supplied one (vercel.com/docs/headers/request-headers), so exactly one hop is
   * trustworthy there and `req.ip` is the client. Anywhere else - `pnpm dev`, a container, the
   * golden replay - nothing has rewritten the header, so trusting it would let any caller pick
   * their own rate-limit bucket by sending the header themselves, and `req.ip` falls back to the
   * socket address, which is the truth in that shape of deployment.
   */
  readonly trustedProxyHops: number
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
    // `VERCEL` is set to "1" in every Vercel environment, build and runtime alike, so this needs
    // no variable of its own and cannot be left unset on the one deployment that requires it.
    return { port, trustedProxyHops: env.VERCEL === '1' ? 1 : 0 }
  },
}
