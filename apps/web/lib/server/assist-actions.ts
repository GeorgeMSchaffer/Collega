'use server'

/**
 * The idea assistant's turn, for the create drawer's chat: the v2 turn route, as the signed-in
 * caller (`SPEC/contracts/ai-assist.md` "v2 turn contract").
 *
 * With a board, the board's route; with none, the organization-level one, for an idea drafted from
 * the Ideas list that starts in the pool. A refusal or any other failure throws, and the chat
 * treats a throw as a failed turn (its hand-off to the form is slice 310).
 */

import { apiPath, apiPostReturning } from '../api/client'
import type { AssistTurnRequest, AssistTurnResponse } from '../assist-turn'

export async function takeAssistTurn(
  boardId: string | null,
  request: AssistTurnRequest,
): Promise<AssistTurnResponse> {
  return apiPostReturning<AssistTurnResponse>(
    boardId ? apiPath`/boards/${boardId}/idea-assist/turns` : apiPath`/idea-assist/turns`,
    request,
  )
}
