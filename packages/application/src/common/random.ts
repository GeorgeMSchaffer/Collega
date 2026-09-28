import { randomInt } from 'node:crypto'

/**
 * Randomness, as a dependency rather than an ambient call - the `Clock` of chance. A port so tests
 * can fix it: a new tag's colour is drawn from the palette at random (SPEC/20-feature-ideas-and-
 * engagement.md Tags rule 10), and a test that cannot pin the draw cannot assert the colour.
 */
export interface RandomSource {
  /** An integer in `[0, maxExclusive)`. */
  nextInt(maxExclusive: number): number
}

/** The real one. Injected everywhere except tests. */
export const systemRandom: RandomSource = {
  nextInt: (maxExclusive) => randomInt(maxExclusive),
}
