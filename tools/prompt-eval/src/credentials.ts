import { readFile } from 'node:fs/promises'

/**
 * The only variable the runner reads a key from (rule 36). Never `ANTHROPIC_API_KEY`: that is the
 * API's key, and both would otherwise sit in the same `.env` under the same name.
 */
export const KEY_VARIABLE = 'PROMPT_EVAL_ANTHROPIC_API_KEY'

/**
 * The key from the environment, else that one variable from `envFile`. The file is parsed for
 * that line alone and never loaded into the environment. Blank counts as unset (rule 37).
 */
export async function readEvaluationKey(
  env: NodeJS.ProcessEnv,
  envFile: string,
): Promise<string | null> {
  const fromEnvironment = env[KEY_VARIABLE]?.trim()
  if (fromEnvironment) return fromEnvironment

  let text: string
  try {
    text = await readFile(envFile, 'utf8')
  } catch {
    return null
  }
  return parseEnvVariable(text, KEY_VARIABLE)
}

/** `NAME=value`, optionally after `export ` and optionally quoted; the last assignment wins. */
export function parseEnvVariable(text: string, name: string): string | null {
  let value: string | null = null
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (match === null || match[1] !== name) continue
    let raw = match[2].trim()
    const quote = raw[0]
    if ((quote === '"' || quote === "'") && raw.length >= 2 && raw.endsWith(quote)) {
      raw = raw.slice(1, -1)
    } else {
      raw = raw.replace(/\s+#.*$/, '')
    }
    value = raw.trim() || null
  }
  return value
}

/**
 * Removes the key from text bound for a run file or stdout (rule 22), including an SDK error that
 * echoes a request. Anything shaped like an Anthropic key goes too, in case it is not ours.
 */
export function redact(text: string, key: string | null): string {
  let out = key ? text.split(key).join('[redacted]') : text
  out = out.replace(/sk-ant-[A-Za-z0-9_-]+/g, '[redacted]')
  return out
}
