import { readFile } from 'node:fs/promises'
import type { AiPromptSet } from '@collega/application/ai'
import { defaultAiPromptSet } from '@collega/application/ai'
import { sha256 } from './hashing.ts'

// The two placeholders the server owns (v1 rule 35). Declared in @collega/domain/ai, which this
// package does not depend on directly.
const REQUIRED_PLACEHOLDERS = ['{{ORGANIZATION_CATALOG}}', '{{SCOPE_STATEMENT}}'] as const

export interface PromptSource {
  /** `default`, or the path given to `--prompt-file`. */
  readonly source: string
  readonly prompts: AiPromptSet
  readonly templateSha256: string
}

export class PromptFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PromptFileError'
  }
}

/**
 * The built-in default, or a candidate template read from a file (rule 26) - the raw template
 * text, as `GET /api/v1/ai-assist/prompt` returns it in `body`. The redirect strings are the
 * defaults either way: the model never sees them, so they cannot change what is measured.
 */
export async function loadPromptSource(promptFile: string | undefined): Promise<PromptSource> {
  const defaults = defaultAiPromptSet()
  if (promptFile === undefined) {
    return {
      source: 'default',
      prompts: defaults,
      templateSha256: sha256(defaults.systemPromptTemplate),
    }
  }

  let template: string
  try {
    // Trimmed as publishing trims it (`publishAiPromptVersion`), so a file saved with a trailing
    // newline renders and hashes as the version it would publish.
    template = (await readFile(promptFile, 'utf8')).trim()
  } catch (error) {
    throw new PromptFileError(
      `Cannot read --prompt-file ${promptFile}: ${(error as Error).message}`,
    )
  }

  const missing = REQUIRED_PLACEHOLDERS.filter((p) => !template.includes(p))
  if (missing.length > 0) {
    throw new PromptFileError(
      `--prompt-file ${promptFile} must contain ${missing.join(' and ')}. ` +
        'It takes the raw template text (the "body" of GET /api/v1/ai-assist/prompt), not the JSON response.',
    )
  }

  return {
    source: promptFile,
    prompts: { ...defaults, systemPromptTemplate: template },
    templateSha256: sha256(template),
  }
}
