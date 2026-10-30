'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ApiError, apiPath, apiPut } from '../api/client'

/**
 * Turns the caller's own usage recording on or off (`PUT /usage/tracking`,
 * `SPEC/20-feature-analytics.md` rule 11). Answers the refusal to show beside the switch, or `null`.
 */
export async function setUsageTracking(enabled: boolean): Promise<string | null> {
  try {
    await apiPut(apiPath`/usage/tracking`, { enabled })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login?expired=1')
    if (error instanceof ApiError && error.status === 403) {
      return 'Only the account holder can change this, not someone acting as them.'
    }
    return 'The setting was not saved. Try again.'
  }
  revalidatePath('/settings/profile')
  return null
}
