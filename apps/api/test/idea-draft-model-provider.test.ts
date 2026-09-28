import { AnthropicIdeaDraftModel } from '@collega/infrastructure/integrations/ai'
import { describe, expect, it, vi } from 'vitest'
import type { Config } from '../src/common/config/index.js'
import { ADAPTER_PROVIDERS } from '../src/common/persistence/adapters.providers.js'

// Sentinel values, so a factory that went back to literals equal to today's defaults still fails.
vi.mock('@collega/application/ai', async (importOriginal) => {
  const original = await importOriginal<typeof import('@collega/application/ai')>()
  return {
    ...original,
    DEFAULT_AI_USAGE_LIMITS: {
      ...original.DEFAULT_AI_USAGE_LIMITS,
      model: 'sentinel-model',
      effort: 'sentinel-effort',
    },
  }
})

describe('the AnthropicIdeaDraftModel provider', () => {
  it('takes model and effort from DEFAULT_AI_USAGE_LIMITS, the constant tools/prompt-eval reads', () => {
    const provider = ADAPTER_PROVIDERS.find(
      (p) => typeof p === 'object' && 'provide' in p && p.provide === AnthropicIdeaDraftModel,
    ) as { useFactory: (config: Config) => AnthropicIdeaDraftModel } | undefined
    expect(provider).toBeDefined()

    const model = provider?.useFactory({ ai: { anthropicApiKey: undefined } } as unknown as Config)
    const config = (model as unknown as { config: { model: string; effort: string } }).config
    expect(config.model).toBe('sentinel-model')
    expect(config.effort).toBe('sentinel-effort')
    expect(model?.isConfigured).toBe(false)
  })
})
