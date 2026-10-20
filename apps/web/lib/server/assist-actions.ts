'use server'

/**
 * The idea assistant's turn, for the create drawer's chat.
 *
 * **Mocked until slice 307 lands.** The backend turn is built in parallel, so this answers from a
 * script in the contract's shape (`lib/assist-turn.ts`): it never sets a field, which is slice 309's
 * to wire. Swapping it is a body change — `apiPostReturning` to
 * `/boards/{boardId}/idea-assist/turns` with `request` — and no signature moves. A `503` or any
 * other failure throws, as the real one will; the chat treats a throw as a failed turn.
 */

import {
  ASSIST_TRANSCRIPT_CAP,
  type AssistTurnRequest,
  type AssistTurnResponse,
} from '../assist-turn'

const OFF_TOPIC = /\b(weather|joke|recipe|football|movie|stock price|poem|horoscope)\b/i

/** The interview order from the spec, one question per turn: the step just answered -> what is next. */
const NEXT: Record<string, [step: string, ask: string]> = {
  problem: [
    'proposedSolutions',
    'What would you do about it? List any ways you can think of to fix it.',
  ],
  proposedSolutions: [
    'impactRationale',
    'Why is it worth doing? A number, such as hours or cost saved, makes the case stronger.',
  ],
  impactRationale: ['businessImpactId', 'How much would this matter to the business?'],
  businessImpactId: ['ideaTypeId', 'What kind of change is this?'],
  ideaTypeId: ['title', 'What should we call it?'],
  title: [
    'done',
    'That covers what the idea needs. Check the form, then create it when you are ready.',
  ],
}

export async function takeAssistTurn(
  _boardId: string | null,
  request: AssistTurnRequest,
): Promise<AssistTurnResponse> {
  await new Promise((done) => setTimeout(done, 900))

  const entries = request.transcript.length
  const step = request.step ?? 'problem'
  const last = request.transcript.at(-1)?.text ?? ''

  if (OFF_TOPIC.test(last)) {
    return {
      inScope: false,
      conversationClosed: false,
      nextQuestion:
        'I can only help with ideas for your organization. What is the problem you would like to solve?',
      changes: {},
      nextStep: step,
      // The offending turn is dropped, so the transcript stands as it did before it.
      turnsRemaining: Math.floor((ASSIST_TRANSCRIPT_CAP - entries + 1) / 2),
    }
  }

  const [nextStep, nextQuestion] = NEXT[step] ?? NEXT.title ?? ['done', '']
  return {
    inScope: true,
    conversationClosed: false,
    nextQuestion,
    changes: {},
    nextStep,
    turnsRemaining: Math.floor((ASSIST_TRANSCRIPT_CAP - entries) / 2),
  }
}
