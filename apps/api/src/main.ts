import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import cookieParser from 'cookie-parser'
import { AppModule } from './app.module.js'
import { CONFIG } from './common/config/config.module.js'
import type { Config } from './common/config/index.js'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  // The ONLY place the session cookie's raw value is parsed off the wire before the auth guard
  // reads it - still inside the allowlisted auth surface, never a feature controller's concern.
  app.use(cookieParser())

  // SPEC/30-Contracts.md: every route lives under /api/v1. Nest's own routing sees the
  // unprefixed path; the corpus's recorded `instance` is the REAL request path, prefix
  // included, which is what the incoming request's own URL already carries -
  // ProblemDetailsFilter reads that, not this prefix.
  app.setGlobalPrefix('api/v1')

  const config = app.get<Config>(CONFIG)

  // Without this the per-IP auth rate limiter reads `req.ip` as the address of Vercel's proxy,
  // which is the SAME for every caller - one bucket for the whole deployment, so the limit is
  // either meaningless or locks everyone out at once. See `trustedProxyHops` for why the value
  // is 0 anywhere else. `server.js` boots this same file, so there is no second entrypoint that
  // could miss it.
  app.set('trust proxy', config.server.trustedProxyHops)

  // Lets Nest run each provider's `onModuleDestroy` (PrismaLifecycle's $disconnect) on
  // SIGTERM/SIGINT, so a redeploy or local Ctrl+C closes the connection pool instead of leaking
  // it - registered before `listen()` so a shutdown mid-startup is still caught.
  app.enableShutdownHooks()

  await app.listen(config.server.port)
  // eslint-disable-next-line no-console -- the one expected startup line, not application logging.
  console.log(`Collega API listening on port ${config.server.port} (prefix /api/v1)`)
}

bootstrap()
