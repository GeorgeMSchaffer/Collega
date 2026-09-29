// The two rules `start.ts` applies to `.env` that are worth a test of their own, kept apart from it
// because `start.ts` starts containers and servers the moment it is imported.

/**
 * `KEY=VALUE` lines, which is all `.env` holds and all the Prisma CLI reads out of it.
 *
 * Hand-parsed rather than through `--env-file`, because `start.ts` has to *derive* one variable
 * from the others before anything runs, and because Node's env-file precedence rules are one more
 * thing to be wrong about when a value is already exported in the shell.
 */
export function parseEnvText(text: string): Map<string, string> {
  const values = new Map<string, string>()
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator <= 0) continue
    const value = trimmed.slice(separator + 1).trim()
    // A value copied from Prisma or Vercel usually arrives quoted; Prisma's own loader drops them.
    const quoted =
      value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0]
    values.set(trimmed.slice(0, separator).trim(), quoted ? value.slice(1, -1) : value)
  }
  return values
}

/**
 * Whether `COLLEGA_ALLOW_REMOTE_DATABASE` opts in to a non-local database: the shell's value when
 * it is set at all, otherwise `.env`'s, as `.env.example` documents it. Only `1` opts in.
 */
export function allowsRemoteDatabase(
  fromShell: string | undefined,
  fromEnvFile: string | undefined,
): boolean {
  return (fromShell ?? fromEnvFile) === '1'
}
