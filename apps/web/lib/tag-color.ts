import { TAG_PALETTE } from '@collega/design-system'

/**
 * The swatch a new tag's form starts on: a palette colour at random (ideas rule 10). The random
 * source is a parameter so a test can fix it; the page picks once per request, so the server render
 * and the client agree.
 */
export function randomTagColor(random: () => number = Math.random): string {
  const index = Math.min(Math.floor(random() * TAG_PALETTE.length), TAG_PALETTE.length - 1)
  return TAG_PALETTE[index] ?? TAG_PALETTE[0]
}
