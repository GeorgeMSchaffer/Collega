// The production adapter as the runner uses it (rules 8 and 37): built with a fake client for
// calls, and built without one only to read the client configuration it would construct.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { IdeaAssistTurn } from '@collega/application/ai'
import {
  buildSystemPrompt,
  defaultAiPromptSet,
  EMPTY_IDEA_DRAFT,
  IdeaDraftModelError,
} from '@collega/application/ai'
import { AnthropicIdeaDraftModel } from '@collega/infrastructure/integrations/ai'
import { loadCorpus } from '../src/corpus.ts'
import { prepareFixture, schemaPriorities } from '../src/fixture-context.ts'
import { fakeAnthropic, PACKAGE_ROOT, TEST_KEY, USAGE } from './helpers.ts'

const CONFIG = { apiKey: TEST_KEY, model: 'claude-sonnet-5', effort: 'low' }

async function acme() {
  const corpus = await loadCorpus(PACKAGE_ROOT, schemaPriorities())
  // biome-ignore lint/style/noNonNullAssertion: the corpus has an acme fixture
  return prepareFixture(corpus.fixtures.get('acme')!, defaultAiPromptSet())
}

/** The SDK client the adapter built, read through its private field. */
function builtClient(model: AnthropicIdeaDraftModel) {
  return (model as unknown as { client: Record<string, unknown> | null }).client
}

test('the adapter pins authToken to null and baseURL to the SDK default, whatever the environment says', () => {
  const saved = {
    base: process.env.ANTHROPIC_BASE_URL,
    token: process.env.ANTHROPIC_AUTH_TOKEN,
    key: process.env.ANTHROPIC_API_KEY,
  }
  process.env.ANTHROPIC_BASE_URL = 'https://attacker.example'
  process.env.ANTHROPIC_AUTH_TOKEN = 'stray-token'
  process.env.ANTHROPIC_API_KEY = 'sk-ant-api-the-apis-key'
  try {
    const client = builtClient(new AnthropicIdeaDraftModel(CONFIG))
    assert.ok(client !== null)
    assert.equal(client.baseURL, 'https://api.anthropic.com')
    assert.equal(client.authToken, null)
    assert.equal(client.apiKey, TEST_KEY, 'the configured key, not the environment one')
  } finally {
    for (const [name, value] of [
      ['ANTHROPIC_BASE_URL', saved.base],
      ['ANTHROPIC_AUTH_TOKEN', saved.token],
      ['ANTHROPIC_API_KEY', saved.key],
    ] as const) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
})

test('a blank key builds no client at all', () => {
  const model = new AnthropicIdeaDraftModel({ ...CONFIG, apiKey: '  ' })
  assert.equal(model.isConfigured, false)
  assert.equal(builtClient(model), null)
})

test('the request carries the configured model and effort and the application-rendered prompt', async () => {
  const fixture = await acme()
  const fake = fakeAnthropic(() => ({ kind: 'json', body: { inScope: true, nextQuestion: 'Q' } }))
  const model = new AnthropicIdeaDraftModel(
    { ...CONFIG, model: 'claude-other', effort: 'high' },
    fake.client,
  )
  const transcript: IdeaAssistTurn[] = [{ role: 'user', text: 'Our label printers jam.' }]
  await model.continueTurn(fixture.context, transcript, EMPTY_IDEA_DRAFT)

  const [request] = fake.requests as {
    model: string
    system: { text: string }[]
    output_config: { effort: string }
    messages: { content: string }[]
  }[]
  assert.equal(request.model, 'claude-other')
  assert.equal(request.output_config.effort, 'high')
  assert.equal(request.system[0].text, buildSystemPrompt(fixture.context))
  assert.equal(request.system[0].text, fixture.systemPrompt)
  assert.ok(request.messages[0].content.endsWith('Our label printers jam.'))
})

test("a provider's refusal stop is an IdeaDraftModelError that keeps the billed usage", async () => {
  const fixture = await acme()
  const fake = fakeAnthropic(() => ({ kind: 'refusal' }))
  const model = new AnthropicIdeaDraftModel(CONFIG, fake.client)
  await assert.rejects(
    model.continueTurn(fixture.context, [{ role: 'user', text: 'x' }], EMPTY_IDEA_DRAFT),
    (error: unknown) =>
      error instanceof IdeaDraftModelError && error.usage?.inputTokens === USAGE.input_tokens,
  )
})
