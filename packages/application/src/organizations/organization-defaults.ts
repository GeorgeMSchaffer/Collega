// Canonical defaults provisioned for every new organization
// (SPEC/20-feature-boards-and-statuses.md "Status Rules" #3-4, "Board Rules" #4). This is data
// only - the entities it describes (Board, Status, IdeaType, BusinessImpact) belong to other
// Wave B partitions, so the orchestration that turns this into rows lives behind
// `OrganizationBootstrapPort` (see ports.ts) rather than here.

export type DefaultStatus = {
  readonly name: string
  readonly color: string
  readonly sortOrder: number
}
export type DefaultIdeaType = { readonly name: string; readonly sortOrder: number }
export type DefaultBusinessImpact = {
  readonly name: string
  readonly color: string
  readonly sortOrder: number
}

export const DEFAULT_BOARD_NAME = 'Ideas'

/** Fallback color applied to a custom status created without an explicit color. Matches the
 * slate used for the "New / Pending" default (SPEC/20-feature-boards-and-statuses.md rule #9). */
export const DEFAULT_STATUS_COLOR = '#64748B'

/** The 5 canonical default statuses in catalog order, with the color/sortOrder values ratified
 * in SPEC/20-feature-boards-and-statuses.md "Status Rules" #4 (New/Pending slate, In Review
 * amber, In Progress blue, Client Review purple, Complete green). */
export const DEFAULT_STATUSES: readonly DefaultStatus[] = [
  { name: 'New / Pending', color: '#64748B', sortOrder: 10 },
  { name: 'In Review', color: '#D97706', sortOrder: 20 },
  { name: 'In Progress', color: '#2563EB', sortOrder: 30 },
  { name: 'Client Review', color: '#7C3AED', sortOrder: 40 },
  { name: 'Complete', color: '#16A34A', sortOrder: 50 },
]

/** Canonical default Idea Types provisioned for every new organization
 * (SPEC/50-technical-implementation-plan.md Phase 4 #9). The first by sort order is the
 * default. */
export const DEFAULT_IDEA_TYPES: readonly DefaultIdeaType[] = [
  { name: 'Continuous Improvement', sortOrder: 10 },
  { name: 'Process Revision', sortOrder: 20 },
]

/**
 * Canonical default Business Impacts provisioned for every new organization, most severe first
 * (user decision 2026-08-17).
 *
 * Unlike `DEFAULT_IDEA_TYPES` and `DEFAULT_STATUSES`, the first option here is NOT the default
 * for a new idea - `DEFAULT_BUSINESS_IMPACT_NAME` is. Reversing this list without that
 * decoupling would have pre-marked every new idea Critical, inflating reported severity through
 * a default nobody chose. Colors stay bound to meaning, not to position: red is Critical
 * wherever it sits.
 */
export const DEFAULT_BUSINESS_IMPACTS: readonly DefaultBusinessImpact[] = [
  { name: 'Critical', color: '#DC2626', sortOrder: 10 },
  { name: 'High', color: '#D97706', sortOrder: 20 },
  { name: 'Medium', color: '#2563EB', sortOrder: 30 },
  { name: 'Low', color: '#16A34A', sortOrder: 40 },
]

/** The Business Impact pre-selected on a new idea, matched by name. Mirrors Priority, which
 * already hard-defaults to Medium rather than to first-in-list. Callers fall back to the first
 * active option when an organization has renamed or removed this one. */
export const DEFAULT_BUSINESS_IMPACT_NAME = 'Medium'
