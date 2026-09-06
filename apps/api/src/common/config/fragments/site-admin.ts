import { type EnvFragment, required } from '../fragment.js'

export type SiteAdminConfig = {
  readonly email: string
  readonly password: string
}

/**
 * The bootstrap Site Admin, seeded on first run (SPEC/20-feature-auth.md requirement 8).
 *
 * These DO fail fast when absent, unlike the AI key. A deployment without a Site Admin has
 * no way to create the first organization, so booting without one produces an application
 * nobody can administer - better to refuse at startup than to look healthy and be unusable.
 */
export const siteAdminFragment: EnvFragment<SiteAdminConfig> = {
  name: 'siteAdmin',
  read(env, problems) {
    return {
      email: required(env, 'SITE_ADMIN_EMAIL', problems, 'The bootstrap Site Admin is required.'),
      password: required(
        env,
        'SITE_ADMIN_PASSWORD',
        problems,
        'The bootstrap Site Admin is required.',
      ),
    }
  },
}
