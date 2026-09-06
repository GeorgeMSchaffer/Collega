import { randomInt } from 'node:crypto'

// Generates admin-issued temporary passwords (SPEC/20-feature-auth.md #12-13) that always
// satisfy the password policy so the recipient never hits a complexity error on first use.
// Excludes visually ambiguous characters (0/O, 1/l/I) to reduce transcription errors when the
// one-time value is read aloud or copied from a screen.

const UPPERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWERS = 'abcdefghjkmnpqrstuvwxyz'
const DIGITS = '23456789'
const SPECIALS = '!@#$%^&*?'
const LENGTH = 12

function pickRandom(source: string): string {
  const index = randomInt(source.length)
  return source[index] as string
}

function shuffle(chars: string[]): void {
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    const a = chars[i] as string
    const b = chars[j] as string
    chars[i] = b
    chars[j] = a
  }
}

export function generateTemporaryPassword(): string {
  const all = UPPERS + LOWERS + DIGITS + SPECIALS
  const chars: string[] = new Array(LENGTH)

  chars[0] = pickRandom(UPPERS)
  chars[1] = pickRandom(LOWERS)
  chars[2] = pickRandom(DIGITS)
  chars[3] = pickRandom(SPECIALS)

  for (let i = 4; i < LENGTH; i++) {
    chars[i] = pickRandom(all)
  }

  shuffle(chars)

  return chars.join('')
}
