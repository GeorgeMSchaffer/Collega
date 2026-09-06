/**
 * One feature's slice of the environment.
 *
 * The config schema is split this way because every feature wants to add keys and there is
 * only one environment - so without composition, every Wave B-E slice would be editing one
 * root schema. A slice adds a fragment under ./fragments and registers it in ./index.ts;
 * nobody edits a shared body of validation logic.
 * SPEC/50-typescript-migration.md section 4.2.
 */
export type EnvFragment<T> = {
  /** Unique, and what an error message names when this fragment rejects the environment. */
  readonly name: string

  /**
   * Reads and validates this fragment's keys.
   *
   * Push every problem into `problems` rather than throwing on the first one: a deployment
   * missing four variables should be told all four at once, not made to redeploy four times.
   * Return the parsed value regardless; the composer refuses to hand back a config when any
   * fragment reported a problem.
   */
  read(env: NodeJS.ProcessEnv, problems: string[]): T
}

/** Reads a variable that must be present and non-empty. */
export function required(
  env: NodeJS.ProcessEnv,
  key: string,
  problems: string[],
  why: string,
): string {
  const value = env[key]?.trim()
  if (!value) {
    problems.push(`${key} is missing or empty. ${why}`)
    return ''
  }
  return value
}

/**
 * Reads a variable that may legitimately be absent.
 *
 * Absent and empty collapse to `undefined` on purpose: `KEY=` in a .env file is how people
 * disable something, and treating that as the empty string would configure a feature with a
 * credential of length zero rather than leaving it unconfigured.
 */
export function optional(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key]?.trim()
  return value ? value : undefined
}
