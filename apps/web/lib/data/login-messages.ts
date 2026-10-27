/**
 * Sign-in messages (`SPEC/20-feature-login-messages.md`): the managing list for Settings → Sign-in
 * messages, its acknowledgement report, and the set the desk shows after sign-in.
 *
 * The wire shapes are the screen's shapes - nothing is renamed - so there is no adapter.
 */

import { apiGet, apiPath, withQuery } from '../api/client'
import type {
  WireLoginMessage,
  WireLoginMessageAcknowledgements,
  WirePage,
  WireVisibleLoginMessage,
} from '../api/wire'
import { API_MAX_PAGE_SIZE } from '../limits'
import { failIfRequested } from './latency'
import { organizationScope } from './scope'

export type LoginMessage = WireLoginMessage
export type VisibleLoginMessage = WireVisibleLoginMessage
export type LoginMessageAcknowledgements = WireLoginMessageAcknowledgements

/** How many rows of the acknowledgement report the drawer shows per page. */
export const ACKNOWLEDGEMENT_PAGE_SIZE = 25

/**
 * The messages this reader manages: the system's for a Site Admin acting directly (who has no
 * organization), otherwise the acting organization's. One page at the API's maximum; the list
 * sorts and pages in the client like the other settings lists.
 */
export async function getManagedLoginMessages(): Promise<LoginMessage[]> {
  failIfRequested('getManagedLoginMessages')

  const scope = organizationScope()
  const params = new URLSearchParams({ pageSize: String(API_MAX_PAGE_SIZE) })
  const path =
    scope === null
      ? apiPath`/login-messages/system`
      : apiPath`/organizations/${scope}/login-messages`
  const page = await apiGet<WirePage<WireLoginMessage>>(
    'getManagedLoginMessages',
    withQuery(path, params),
  )
  return [...page.items]
}

/** LMS-6: who has acknowledged the current revision, acknowledged first. */
export async function getLoginMessageAcknowledgements(
  messageId: string,
  page: number,
): Promise<LoginMessageAcknowledgements> {
  failIfRequested('getLoginMessageAcknowledgements')

  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(ACKNOWLEDGEMENT_PAGE_SIZE),
  })
  return apiGet<WireLoginMessageAcknowledgements>(
    'getLoginMessageAcknowledgements',
    withQuery(apiPath`/login-messages/${messageId}/acknowledgements`, params),
  )
}

/** LMS-3: the live messages not hidden for this sign-in. Empty during View As (LMS-3f). */
export async function getVisibleLoginMessages(): Promise<VisibleLoginMessage[]> {
  failIfRequested('getVisibleLoginMessages')

  const { items } = await apiGet<{ items: readonly WireVisibleLoginMessage[] }>(
    'getVisibleLoginMessages',
    apiPath`/login-messages/visible`,
  )
  return [...items]
}
