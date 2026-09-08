import { Controller, Get } from '@nestjs/common'

type HealthResponse = {
  readonly status: 'Healthy'
  readonly timestampUtc: string
}

/**
 * `GET /api/v1/health` (SPEC/30-Contracts.md; `tools/golden/fixtures/health.*.json`). Injects
 * nothing, deliberately, matching .NET's `HealthController` - a liveness probe that depended on
 * the database could report unhealthy while the database itself is merely slow, and this route
 * is also the one endpoint the corpus expects to answer identically anonymous or at any role
 * (no `AuthGuard` here at all, not an allowed-anonymous special case).
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return { status: 'Healthy', timestampUtc: new Date().toISOString() }
  }
}
