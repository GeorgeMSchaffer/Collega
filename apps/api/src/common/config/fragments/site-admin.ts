import { type EnvFragment, required } from '../fragment.js'

export type SiteAdminConfig = {
  readonly email: string
}

/**
 * The bootstrap Site Admin, seeded on first run (SPEC/20-feature-auth.md requirement 8).
 *
 * The email DOES fail fast when absent, unlike the AI key. A deployment without a Site Admin has
 * no way to create the first organization, so booting without one produces an application
 * nobody can administer - better to refuse at startup than to look healthy and be unusable.
 *
 * The password is deliberately not read here: only the build-time db:bootstrap-admin uses it
 * (SPEC/decisions.md 2026-10-15), so it can be removed from the environment after first login.
 */
export const siteAdminFragment: EnvFragment<SiteAdminConfig> = {
  name: 'siteAdmin',
  read(env, problems) {
    return {
      email: required(env, 'SITE_ADMIN_EMAIL', problems, 'The bootstrap Site Admin is required.'),
    }
  },
}
