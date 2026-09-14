'use server'

/**
 * Seeding and resetting the demo data from the settings screen.
 *
 * Both post to `apps/api`, which owns every rule worth having: the Site Admin role, and whether
 * this deployment has opted in at all through `COLLEGA_ALLOW_DEMO_SEED`. Nothing is re-checked
 * here, because a check here could only ever disagree with the one that counts — and the one that
 * counts is the one holding the database connection.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ApiError, apiPath, apiPost } from '../api/client'

export type DemoSeedState = { error: string | null; message: string | null }

/**
 * What the API answered, turned into the sentence the screen shows.
 *
 * A 403 here is far likelier to be "this deployment has not opted in" than "you are not a Site
 * Admin", since the screen is only reachable by one — so the API's own `detail` is rendered rather
 * than a message invented here, and it says which.
 */
function refusal(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) redirect('/login?expired=1')
    if (error.status === 403 || error.status === 404) return error.detail
  }
  throw error
}

/** Everything, because seeding changes the sidebar's counts as well as every list below it. */
function revalidateEverything(): void {
  revalidatePath('/', 'layout')
}

export async function seedDemoData(
  _previous: DemoSeedState,
  _form: FormData,
): Promise<DemoSeedState> {
  try {
    await apiPost(apiPath`/demo-seed`)
  } catch (error) {
    return { error: refusal(error), message: null }
  }

  revalidateEverything()
  return { error: null, message: 'Demo data is in place. Anything already there was left alone.' }
}

export async function resetDemoData(
  _previous: DemoSeedState,
  _form: FormData,
): Promise<DemoSeedState> {
  try {
    await apiPost(apiPath`/demo-seed/reset`)
  } catch (error) {
    return { error: refusal(error), message: null }
  }

  revalidateEverything()
  return {
    error: null,
    message: 'Demo data was removed and rebuilt. Anything you created yourself was left alone.',
  }
}
