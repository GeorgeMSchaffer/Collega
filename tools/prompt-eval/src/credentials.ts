import { readFile } from 'node:fs/promises'
import { parseEnv } from 'node:util'

/**
 * The only variable the runner reads a key from (rule 36). Never `ANTHROPIC_API_KEY`: that is the
 * API's key, and both would otherwise sit in the same `.env` under the same name.
 */
export const KEY_VARIABLE = 'PROMPT_EVAL_ANTHROPIC_API_KEY'

/**
 * The key from the environment, else that one variable from the first of `envFiles` that holds it
 * (`.env.local`, which `pnpm env:pull` writes from Vercel, then `.env`), each parsed with
 * `util.parseEnv` so no file is loaded into the environment. Blank counts as unset (rule 37).
 */
export async function readEvaluationKey(
  env: NodeJS.ProcessEnv,
  envFiles: string | readonly string[],
): Promise<string | null> {
  const fromEnvironment = env[KEY_VARIABLE]?.trim()
  if (fromEnvironment) return fromEnvironment

  for (const envFile of typeof envFiles === 'string' ? [envFiles] : envFiles) {
    let text: string
    try {
      text = await readFile(envFile, 'utf8')
    } catch {
      continue
    }
    const fromFile = parseEnv(text)[KEY_VARIABLE]?.trim()
    if (fromFile) return fromFile
  }
  return null
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
