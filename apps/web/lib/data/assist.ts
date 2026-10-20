import { apiGet, apiPath } from '../api/client'
import type { WireAiAssistAvailability } from '../api/wire'

/**
 * Whether the create drawer opens with the assistant (rule 32a): a bare boolean that never says
 * why it is false. Read on the server when a create drawer is requested, so once per page load.
 *
 * A failed read answers `false` rather than throwing. The pre-check exists so the person can work
 * without the assistant; a page that errored because the pre-check did would be the opposite.
 */
export async function getAssistAvailability(): Promise<boolean> {
  try {
    const { available } = await apiGet<WireAiAssistAvailability>(
      'getAssistAvailability',
      apiPath`/ai-assist/availability`,
    )
    return available
  } catch {
    return false
  }
}
