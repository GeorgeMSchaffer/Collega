import type { EnvFragment } from '../fragment.js'

export type UsageConfig = {
  readonly enabled: boolean
  readonly retentionDays: number
  /** `null` when unset: the rollup route then refuses every call. */
  readonly cronSecret: string | null
}

/**
 * Usage analytics (SPEC/20-feature-analytics.md rules 12, 16 and 17).
 *
 * `COLLEGA_USAGE_TRACKING` is `on` or `off`. Unset means on, except in production, which stays
 * off until the privacy page's wording is signed off (rule 21) and someone sets it to `on`.
 */
export const usageFragment: EnvFragment<UsageConfig> = {
  name: 'usage',
  read(env, problems) {
    const switchValue = env.COLLEGA_USAGE_TRACKING?.trim().toLowerCase() ?? ''
    if (switchValue !== '' && switchValue !== 'on' && switchValue !== 'off') {
      problems.push(`COLLEGA_USAGE_TRACKING must be "on" or "off", not "${switchValue}".`)
    }
    const enabled = switchValue === '' ? env.VERCEL_ENV !== 'production' : switchValue === 'on'

    const daysValue = env.COLLEGA_USAGE_RETENTION_DAYS?.trim() ?? ''
    const retentionDays = daysValue === '' ? 90 : Number(daysValue)
    if (!Number.isInteger(retentionDays) || retentionDays < 1) {
      problems.push(
        `COLLEGA_USAGE_RETENTION_DAYS must be a whole number of days, not "${daysValue}".`,
      )
    }

    const cronSecret = env.CRON_SECRET?.trim() || null
    return { enabled, retentionDays, cronSecret }
  },
}
