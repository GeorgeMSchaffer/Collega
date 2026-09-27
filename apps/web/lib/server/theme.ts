/**
 * Reads the theme cookie for the root layout, so `<html data-theme>` is right on the first render.
 *
 * The only other `next/headers` reader in `apps/web` besides `current-user.ts`. That import is
 * restricted because it is how a credential gets read, and this file reads no credential — only
 * `collega-theme`. It is allowlisted by path in `biome.json` and
 * `tools/arch/identity-chokepoint.test.ts` so the exception stays visible; keep it to this one
 * cookie.
 */

import 'server-only'

import { cookies } from 'next/headers'
import { THEME_COOKIE, type Theme, toTheme } from '../theme'

export async function currentTheme(): Promise<Theme> {
  return toTheme((await cookies()).get(THEME_COOKIE)?.value)
}
