/**
 * Hard-coded stand-ins for what Wave D's API will return.
 *
 * Every value here mirrors the demo seed in `demo.md`, so a screen built against this and the same
 * screen built against the real API should differ only in where the data came from. Nothing else in
 * `apps/web` may invent its own fixtures — when the API lands, this file is the only thing deleted.
 */

export type Role = 'SiteAdmin' | 'OrgAdmin' | 'User' | 'ReadOnly'

export type CurrentUser = {
  displayName: string
  initials: string
  role: Role
  roleLabel: string
  organizationName: string | null
}

export const currentUser: CurrentUser = {
  displayName: 'Olivia Administer',
  initials: 'OA',
  role: 'OrgAdmin',
  roleLabel: 'Org Admin',
  organizationName: 'Acme Robotics',
}

/** Counts the sidebar shows beside a nav item. The seed gives each org 2 boards and 22 ideas. */
export const navCounts = {
  boards: 2,
  ideas: 22,
  backlog: 7,
} as const
