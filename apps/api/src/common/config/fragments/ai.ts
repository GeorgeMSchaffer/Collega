import { type EnvFragment, optional } from '../fragment.js'

export type AiConfig = {
  /**
   * The single deployment-level Anthropic key every organization shares
   * (SPEC/20-feature-ai-idea-assist.md rule 29). Per-organization keys stay unbuilt.
   */
  readonly anthropicApiKey: string | undefined

  /** Whether a drafting turn would even be attempted. Budget is checked separately. */
  readonly isConfigured: boolean
}

/**
 * ANTHROPIC_API_KEY, read from the environment - which in local development means `.env`.
 *
 * ABSENT IS A SUPPORTED STATE, NOT A MISCONFIGURATION. The feature runs dark (rule 31), so
 * this fragment must never report a problem for a missing key the way the site-admin
 * fragment does. Getting that backwards would make a deployment without AI fail to boot.
 *
 * The name has no prefix or nesting, so the environment variable and the config key are the
 * same string. That is deliberate: the .NET stack reached this same key through three
 * different names at once - `Ai:ApiKey`, `CLAUDE_API_KEY` and `ANTHROPIC_API_KEY` - and two
 * of them were read by nothing, which is why the feature was silently dark.
 */
export const aiFragment: EnvFragment<AiConfig> = {
  name: 'ai',
  read(env) {
    const anthropicApiKey = optional(env, 'ANTHROPIC_API_KEY')
    return { anthropicApiKey, isConfigured: anthropicApiKey !== undefined }
  },
}
