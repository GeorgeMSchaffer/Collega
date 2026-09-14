import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The seeded demo roster, and where each role's saved session lives.
 *
 * **Its own module, not `auth.setup.ts`, because Playwright forbids a spec importing a test file**
 * — and the setup that writes these files is a test file by construction, since it needs a browser
 * to sign in with. So the shared names live here and both sides import them.
 *
 * The roster's password is published in `demo.md` and in `scenario.ts`. That is safe here and only
 * here: `global-setup.ts` refuses to seed anything but a local `collega_e2e` schema.
 */

const HERE = dirname(fileURLToPath(import.meta.url))

/** Gitignored — a session cookie, even a seeded one, is not a thing to commit. */
export const STATE_DIR = join(HERE, '.auth')

export const DEMO_PASSWORD = 'Abc123!'

export const SEEDED = {
  siteAdmin: { email: 'siteadmin@demo.collega.test', file: join(STATE_DIR, 'site-admin.json') },
  orgAdmin: {
    email: 'orgadmin@acme-robotics.demo.collega.test',
    file: join(STATE_DIR, 'org-admin.json'),
  },
  readOnly: {
    email: 'readonly@acme-robotics.demo.collega.test',
    file: join(STATE_DIR, 'read-only.json'),
  },
} as const
