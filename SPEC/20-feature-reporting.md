# Feature: Reporting (Post-MVP)

## Outcome
Authorized users can run organization-scoped operational reports for idea workflow, collaboration activity, and administration insights.

## Scope
- Out (MVP): reporting is not required for MVP release.
- In (post-MVP): read-only reporting views and exports for organization-scoped data.

## Initial Reporting Baseline (Resolved)
1. Idea Throughput Report: created vs completed ideas by date range and board.
2. Idea Aging Report: active ideas grouped by status, age bucket, and priority.
3. Engagement Activity Report: comment, mention, and upvote activity by date range.
4. Administration Activity Report: audit-event summaries for auth and admin actions.

## Filters and Dimensions
1. Required filters: date range and organization scope.
2. Optional filters: board, status, priority, assignee, and actor.
3. Date and time values are represented in UTC at API and export boundaries.

## Export Formats (Resolved)
1. CSV export is required for each report in the initial reporting phase.
2. JSON export is optional in the initial reporting phase.
3. PDF and spreadsheet-native formats are out of scope for the initial reporting phase unless later approved.

## Security and Access
1. Reporting access is organization-scoped and must not leak cross-organization data.
2. Site Admin can run reports across organizations with explicit organization selection.
3. Org Admin can run reports for their own organization only.
4. Report exports are subject to the same authorization checks as on-screen report queries.

## Acceptance Criteria
- [ ] Reporting implementation is not required for MVP release completion
- [ ] Initial reporting phase includes the four baseline reports
- [ ] CSV export is available for each baseline report
- [ ] Report queries and exports enforce organization-scoped authorization
- [ ] Report timestamps and exported date-time values are UTC