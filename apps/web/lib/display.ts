/**
 * Presentation constants: colour scales and the limits a form shows.
 *
 * Neither data nor identity, so neither `lib/data/` nor `lib/session.ts`. These are decisions the
 * client makes about how to render something, and they do not arrive over the wire — a priority
 * has a colour because comp Q says so, not because the API said so.
 */

export { EFFORT_COLORS, PRIORITY_COLORS } from './mock.js'
