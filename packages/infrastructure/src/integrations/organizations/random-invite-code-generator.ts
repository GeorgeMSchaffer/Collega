import { randomInt } from 'node:crypto'
import type { InviteCodeGenerator } from '@collega/application/organizations'

// Excludes ambiguous characters (0/O, 1/I) so a code read off a screen is easy to type - matches
// .NET's `InviteCodeGenerator`.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 10

/** Generates random, human-friendly organization invite codes. Uniqueness is enforced by the
 * caller (`OrganizationRepository.inviteCodeExists`). */
export class RandomInviteCodeGenerator implements InviteCodeGenerator {
  generate(): string {
    let code = ''
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += ALPHABET.charAt(randomInt(ALPHABET.length))
    }
    return code
  }
}
