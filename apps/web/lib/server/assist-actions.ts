'use server'

/**
 * The idea assistant's turn, for the create drawer's chat: the v2 turn route, as the signed-in
 * caller (`SPEC/contracts/ai-assist.md` "v2 turn contract").
 *
 * With a board, the board's route; with none, the organization-level one, for an idea drafted from
 * the Ideas list that starts in the pool.
 *
 * It returns the outcome rather than throwing: an `ApiError`'s status does not survive a Server
 * Function in production, and the chat must tell a `429`, which keeps the conversation, from every
 * other failure, which ends it and hands off to the form.
 */

import { ApiError, apiPath, apiPostReturning } from '../api/client'
import type { AssistTurnRequest, AssistTurnResponse, AssistTurnResult } from '../assist-turn'

export async function takeAssistTurn(
  boardId: string | null,
  request: AssistTurnRequest,
): Promise<AssistTurnResult> {
  try {
    const turn = await apiPostReturning<AssistTurnResponse>(
      boardId ? apiPath`/boards/${boardId}/idea-assist/turns` : apiPath`/idea-assist/turns`,
      request,
    )
    return { ok: true, turn }
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) {
      return { ok: false, rateLimited: true, retryAfter: error.retryAfter }
    }
    return { ok: false, rateLimited: false }
  }
}
