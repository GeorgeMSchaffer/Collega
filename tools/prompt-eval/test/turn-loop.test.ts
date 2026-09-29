// The turn loop (rules 11, 25 and 28) through a fake `IdeaDraftModel`: no adapter, no client.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  IdeaAssistContext,
  IdeaAssistTurn,
  IdeaDraft,
  IdeaDraftModel,
  IdeaDraftModelResponse,
} from '@collega/application/ai'
import { defaultAiPromptSet, IdeaDraftModelError } from '@collega/application/ai'
import type { EvalCase } from '../src/corpus.ts'
import { fixtureContext } from '../src/fixture-context.ts'
import { type LoopOptions, runTrials, type TrialSpec } from '../src/turn-loop.ts'
import { EMPTY_DRAFT, TEST_KEY } from './helpers.ts'

const CONTEXT: IdeaAssistContext = fixtureContext(
  {
    name: 'f',
    organizationName: 'Org',
    scopeStatement: null,
    ideaTypes: [{ name: 'Continuous Improvement' }],
    businessImpacts: [{ name: 'High' }],
    statuses: [],
    tags: [],
    memberNames: [],
    file: 'fixtures/f.json',
  },
  defaultAiPromptSet(),
)
const TYPE_ID = CONTEXT.ideaTypes[0].id

function evalCase(id: string, turns: string[], fixture = 'f'): EvalCase {
  return {
    id,
    fixture,
    note: '',
    turns,
    expect: { inScope: true },
    pair: null,
    assistant: 'v1',
    draft: null,
    lockedFields: [],
    file: `cases/${id}.json`,
  }
}

function spec(c: EvalCase, repeat = 0): TrialSpec {
  return { evalCase: c, repeat, context: CONTEXT }
}

interface Call {
  readonly transcript: readonly IdeaAssistTurn[]
  readonly draft: IdeaDraft
}

type Answer = (text: string, call: number) => Partial<IdeaDraftModelResponse> | Error

/** A model that answers from `answer` and records what it was sent. */
function fakeModel(answer: Answer): { model: IdeaDraftModel; calls: Call[] } {
  const calls: Call[] = []
  const model: IdeaDraftModel = {
    isConfigured: true,
    continueTurn: async (_context, transcript, draft) => {
      calls.push({ transcript, draft })
      const reply = answer(transcript[transcript.length - 1].text, calls.length - 1)
      if (reply instanceof Error) throw reply
      return {
        inScope: true,
        nextQuestion: `asked after ${transcript[transcript.length - 1].text}`,
        draft: EMPTY_DRAFT,
        inputTokens: 10,
        outputTokens: 5,
        cacheReadInputTokens: 3,
        cacheCreationInputTokens: 2,
        ...reply,
      }
    },
  }
  return { model, calls }
}

function options(model: IdeaDraftModel, overrides: Partial<LoopOptions> = {}): LoopOptions {
  let tick = 0
  return {
    model,
    ceilings: { maxCalls: 200, maxTokens: 1_000_000 },
    concurrency: 1,
    stopwatch: { elapsedMs: () => (tick += 7) },
    redact: (text) => text.split(TEST_KEY).join('[redacted]'),
    ...overrides,
  }
}

test('an in-scope turn appends its question and carries the sanitized draft', async () => {
  const { model, calls } = fakeModel((_text, call) =>
    call === 0 ? { draft: { ...EMPTY_DRAFT, title: 'Jams', ideaTypeId: TYPE_ID } } : {},
  )
  const result = await runTrials([spec(evalCase('c', ['first', 'second']))], options(model))

  assert.deepEqual(calls[1].transcript, [
    { role: 'user', text: 'first' },
    { role: 'assistant', text: 'asked after first' },
    { role: 'user', text: 'second' },
  ])
  assert.equal(calls[1].draft.title, 'Jams')
  assert.equal(calls[1].draft.ideaTypeId, TYPE_ID)
  assert.equal(result.trials[0].status, 'completed')
  assert.equal(result.trials[0].turns.length, 2)
})

test('a refused turn is dropped from the next transcript and the draft is kept', async () => {
  const { model, calls } = fakeModel((text) =>
    text === 'first'
      ? { draft: { ...EMPTY_DRAFT, title: 'Kept' } }
      : text === 'off topic'
        ? { inScope: false, draft: { ...EMPTY_DRAFT, title: 'Discarded' } }
        : {},
  )
  const result = await runTrials(
    [spec(evalCase('c', ['first', 'off topic', 'third']))],
    options(model),
  )

  assert.deepEqual(
    calls[2].transcript.map((t) => t.text),
    ['first', 'asked after first', 'third'],
  )
  assert.equal(calls[2].draft.title, 'Kept')
  const refused = result.trials[0].turns[1]
  assert.equal(refused.inScope, false)
  assert.equal(refused.rawDraft?.title, 'Discarded', 'the raw output is still recorded')
  assert.equal(refused.sanitizedDraft?.title, 'Kept', 'the service returns the draft unchanged')
})

test('the draft goes through sanitizeDraft: an unknown id is dropped, a long title cut', async () => {
  const { model, calls } = fakeModel((_text, call) =>
    call === 0
      ? {
          draft: {
            ...EMPTY_DRAFT,
            title: 'x'.repeat(500),
            ideaTypeId: '00000000-0000-4000-8000-000000000000',
          },
        }
      : {},
  )
  const result = await runTrials([spec(evalCase('c', ['a', 'b']))], options(model))
  const first = result.trials[0].turns[0]
  assert.equal(first.rawDraft?.ideaTypeId, '00000000-0000-4000-8000-000000000000')
  assert.equal(first.sanitizedDraft?.ideaTypeId, null)
  assert.ok((first.sanitizedDraft?.title ?? '').length < 500)
  assert.equal(calls[1].draft.ideaTypeId, null, 'the sanitized draft is what is carried')
})

test('an IdeaDraftModelError ends the trial as errored, with the key redacted, and the run goes on', async () => {
  const { model } = fakeModel((text) =>
    text === 'fails'
      ? new IdeaDraftModelError('The idea assist model call failed.', {
          cause: new Error(`401 invalid x-api-key ${TEST_KEY}`),
          usage: {
            inputTokens: 4,
            outputTokens: 0,
            cacheReadInputTokens: 0,
            cacheCreationInputTokens: 0,
          },
        })
      : {},
  )
  const result = await runTrials(
    [spec(evalCase('bad', ['fails', 'never sent'])), spec(evalCase('good', ['fine']))],
    options(model),
  )

  const [bad, good] = result.trials
  assert.equal(bad.status, 'errored')
  assert.equal(bad.turns.length, 1, 'the trial stops at the failed turn')
  assert.equal(bad.turns[0].inScope, null)
  assert.match(
    bad.turns[0].error ?? '',
    /model call failed\. Cause: 401 invalid x-api-key \[redacted\]/,
  )
  assert.ok(!(bad.turns[0].error ?? '').includes(TEST_KEY))
  assert.equal(bad.turns[0].usage?.inputTokens, 4, 'a failed call still bills')
  assert.equal(good.status, 'completed')
  assert.equal(result.abortReason, null)
  assert.equal(result.tokens.inputTokens, 4 + 10)
})

test('any other exception is a defect: the run aborts as unexpected-error, message redacted', async () => {
  const { model, calls } = fakeModel(() => new TypeError(`cannot read ${TEST_KEY}`))
  const result = await runTrials(
    [spec(evalCase('a', ['x'])), spec(evalCase('b', ['y']))],
    options(model),
  )
  assert.equal(result.abortReason, 'unexpected-error')
  assert.equal(result.abortMessage, 'cannot read [redacted]')
  assert.equal(calls.length, 1, 'no further call after the defect')
  assert.deepEqual(
    result.trials.map((t) => t.caseId),
    [],
    'a trial with no recorded turn is absent',
  )
})

test('--max-calls stops the run before the call that would exceed it', async () => {
  const { model, calls } = fakeModel(() => ({}))
  const result = await runTrials(
    [spec(evalCase('a', ['1', '2'])), spec(evalCase('b', ['3', '4']))],
    options(model, { ceilings: { maxCalls: 3, maxTokens: 1_000_000 } }),
  )
  assert.equal(calls.length, 3)
  assert.equal(result.calls, 3)
  assert.equal(result.abortReason, 'max-calls')
  assert.deepEqual(
    result.trials.map((t) => [t.caseId, t.status, t.turns.length]),
    [
      ['a', 'completed', 2],
      ['b', 'aborted', 1],
    ],
  )
})

test('a run that uses exactly --max-calls is not aborted', async () => {
  const { model } = fakeModel(() => ({}))
  const result = await runTrials(
    [spec(evalCase('a', ['1', '2']))],
    options(model, { ceilings: { maxCalls: 2, maxTokens: 1_000_000 } }),
  )
  assert.equal(result.abortReason, null)
})

test('--max-tokens counts all four token kinds and stops before the next call', async () => {
  // Each call reports 10 + 5 + 3 + 2 = 20 tokens.
  const { model, calls } = fakeModel(() => ({}))
  const result = await runTrials(
    [spec(evalCase('a', ['1', '2', '3']))],
    options(model, { ceilings: { maxCalls: 200, maxTokens: 40 } }),
  )
  assert.equal(calls.length, 2)
  assert.equal(result.abortReason, 'max-tokens')
  assert.equal(result.trials[0].status, 'aborted')
})

test('trials come back in spec order whatever order they finish in', async () => {
  const pending: { text: string; release: () => void }[] = []
  const model: IdeaDraftModel = {
    isConfigured: true,
    continueTurn: (_c, transcript) =>
      new Promise((resolve) => {
        const text = transcript[transcript.length - 1].text
        pending.push({
          text,
          release: () =>
            resolve({
              inScope: true,
              nextQuestion: text,
              draft: EMPTY_DRAFT,
              inputTokens: 1,
              outputTokens: 1,
              cacheReadInputTokens: 0,
              cacheCreationInputTokens: 0,
            }),
        })
      }),
  }
  const specs = ['a', 'b', 'c', 'd'].map((id) => spec(evalCase(id, [id])))
  const running = runTrials(specs, options(model, { concurrency: 3 }))

  const settle = () => new Promise((resolve) => setImmediate(resolve))
  await settle()
  assert.equal(pending.length, 1, 'the first call per fixture runs alone')
  pending.shift()?.release()
  await settle()
  assert.equal(pending.length, 3, 'then every worker has a call in flight')
  // Finish in reverse order.
  for (let i = 0; i < 3; i++) {
    await settle()
    pending.pop()?.release()
  }
  const result = await running
  assert.deepEqual(
    result.trials.map((t) => t.caseId),
    ['a', 'b', 'c', 'd'],
  )
})

test('the latency of a turn is read from the injected stopwatch', async () => {
  const { model } = fakeModel(() => ({}))
  const result = await runTrials([spec(evalCase('a', ['1']))], options(model))
  assert.equal(result.trials[0].turns[0].latencyMs, 7)
})
