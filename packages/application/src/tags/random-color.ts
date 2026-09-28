import { paletteColorAt, TAG_COLOR_PALETTE } from '@collega/domain/tags'
import type { RandomSource } from '../common/index.js'

/** A palette colour drawn from `random` - every tag created without a colour gets one (Tags rule 10). */
export function randomTagColor(random: RandomSource): string {
  return paletteColorAt(random.nextInt(TAG_COLOR_PALETTE.length))
}
