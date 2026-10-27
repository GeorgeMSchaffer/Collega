import { timingSafeEqual } from 'node:crypto'
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import type { Request } from 'express'
import { CONFIG } from '../common/config/config.module.js'
import type { Config } from '../common/config/index.js'

/**
 * Admits Vercel Cron's calls to internal jobs: `Authorization: Bearer <CRON_SECRET>`
 * (SPEC/contracts/usage.md, the rollup route). It lives in the auth folder because it reads a
 * credential, and this folder is the identity chokepoint. It resolves no user: a job acts as no one.
 *
 * With `CRON_SECRET` unset every call is refused, so a deployment without one cannot run the job
 * by accident. A user's session is never accepted here.
 */
@Injectable()
export class CronSecretGuard implements CanActivate {
  constructor(@Inject(CONFIG) private readonly config: Config) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.usage.cronSecret
    const header = context.switchToHttp().getRequest<Request>().headers.authorization ?? ''
    if (secret === null || !matches(header, `Bearer ${secret}`)) {
      throw new UnauthorizedException()
    }
    return true
  }
}

function matches(actual: string, expected: string): boolean {
  const a = Buffer.from(actual)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
