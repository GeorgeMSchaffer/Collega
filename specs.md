speckit_version: "1.0"
spec:
  id: "SK-JIRA-SPRINT-001"
  title: "Sprint Planning and Tracking Workflow in Jira"
  owner: "Engineering Operations"
  status: "draft"
  last_updated: "2026-07-29"

context:
  problem_statement: >
    Teams use Jira inconsistently during sprint planning and execution, causing unclear sprint goals,
    over-commitment, and poor visibility into delivery risk.
  target_users:
    - "Scrum Master"
    - "Product Owner"
    - "Engineering Team"
  assumptions:
    - "Team uses Jira Software Cloud"
    - "Scrum board is already configured"
    - "Issue types include Epic, Story, Bug, Task"

objectives:
  primary:
    - "Standardize sprint planning in Jira"
    - "Improve in-sprint visibility and predictability"
    - "Reduce carryover work between sprints"
  success_metrics:
    - name: "Sprint commitment reliability"
      definition: "Completed story points / committed story points"
      target: ">= 85%"
    - name: "Carryover rate"
      definition: "Story points moved to next sprint / committed story points"
      target: "<= 15%"
    - name: "Blocked issue resolution time"
      definition: "Median time from blocked to unblocked"
      target: "<= 1 business day"

scope:
  in_scope:
    - "Create sprint and set sprint goal"
    - "Populate sprint backlog from prioritized product backlog"
    - "Estimate work using story points"
    - "Track progress via board columns and burndown chart"
    - "Handle blockers with labels/flags and ownership"
    - "Close sprint with completion and carryover handling"
  out_of_scope:
    - "Portfolio-level capacity planning"
    - "Cross-project dependency tooling outside Jira"
    - "Automated release deployment"

requirements:
  functional:
    - id: "FR-1"
      requirement: "Product Owner or Scrum Master can create a sprint with start/end dates and a sprint goal."
    - id: "FR-2"
      requirement: "Team can move prioritized issues from backlog into the active sprint."
    - id: "FR-3"
      requirement: "Each Story and Bug in sprint must have story points before sprint start."
    - id: "FR-4"
      requirement: "Board workflow must include To Do, In Progress, In Review, Done."
    - id: "FR-5"
      requirement: "Blocked items (identified by flag or blocker label) must be assigned an owner within 4 business hours in project timezone."
    - id: "FR-6"
      requirement: "Daily updates must be reflected through status changes in Jira before standup ends."
    - id: "FR-7"
      requirement: "Sprint closure must produce: completed work, incomplete work, carryover rate, commitment reliability, and velocity snapshot."
    - id: "FR-8"
      requirement: "Sprint commitment is locked at sprint start timestamp for metric calculations."
    - id: "FR-9"
      requirement: "Issues added after sprint start must be marked as scope-added and excluded from commitment reliability denominator."
    - id: "FR-10"
      requirement: "Only Product Owner or Scrum Master can start and close sprints."
    - id: "FR-11"
      requirement: "A Task contributes to reliability/carryover metrics only when marked customer-facing and estimated."
  non_functional:
    - id: "NFR-1"
      requirement: "Sprint dashboard average load time is < 3 seconds for normal team usage."
    - id: "NFR-2"
      requirement: "Permission model follows least privilege; sprint start/close rights are limited to Product Owner and Scrum Master."
    - id: "NFR-3"
      requirement: "Audit trail available via Jira issue history and sprint reports."

governance_rules:
  commitment_and_scope:
    - "Commitment lock time is the sprint start timestamp."
    - "Items added after lock must be tagged scope-added and tracked separately."
  blocker_handling:
    - "Either impediment flag or blocked label indicates blocked state."
    - "Automation must keep flag and blocked label synchronized."
    - "Blocker owner assignment SLA runs in business hours using project timezone."
  done_policy:
    - "Done requires code committed, merged, tested, deployed, and client signoff."
    - "If deployment/signoff is outside sprint control, PO may approve exception via Jira comment."

workflow:
  planning:
    - "Refine top backlog items and ensure acceptance criteria exist."
    - "Estimate Stories and Bugs using team-defined point scale."
    - "Create sprint and define sprint goal."
    - "Commit issues up to team capacity threshold."
  execution:
    - "Run daily standup using active sprint board."
    - "Update statuses in real time."
    - "Set blocked flag or label and add blocker note/comment with owner and ETA."
    - "Review burndown daily for scope or flow risk."
  closure:
    - "Move all completed items to Done (meeting DoD)."
    - "Close sprint and move incomplete issues to backlog/next sprint."
    - "Review velocity and carryover in retrospective."

jira_configuration:
  board_type: "Scrum"
  issue_fields_required:
    backlog_item:
      - "Summary"
      - "Issue Type"
      - "Assignee"
    sprint_committed_item:
      - "Summary"
      - "Issue Type"
      - "Assignee"
      - "Sprint"
      - "Story Points (required for Story and Bug; for Task only when customer-facing)"
  labels:
    blocker_label: "blocked"
    risk_label: "at-risk"
    scope_added_label: "scope-added"
    customer_facing_label: "customer-facing"
  automations:
    - name: "Blocked issue alert"
      trigger: "Issue flagged as impediment OR blocker label added"
      action: "Sync flag and blocker label, notify #team-channel, and assign Scrum Master watcher"
    - name: "Missing estimate check"
      trigger: "Issue added to active sprint"
      condition: "Issue type is Story or Bug and Story Points is empty"
      action: "Comment + notify assignee and PO"
    - name: "Scope-added tagging"
      trigger: "Issue added to active sprint after sprint start"
      action: "Add scope-added label and comment with sprint-goal impact note requirement"

acceptance_criteria:
  - "Sprint can be created and started with goal, dates, and committed backlog."
  - "100% of Stories and Bugs in committed sprint backlog have estimates at sprint start."
  - "Estimated Tasks count in metrics only when customer-facing label is present."
  - "Blocked issues are visible and tracked to resolution."
  - "Every blocked issue has an owner assigned within 4 business hours (project timezone)."
  - "Sprint report and burndown are available and reviewed at close."
  - "Carryover, commitment reliability, and velocity metrics are recorded within 24 hours after sprint close."

risks_and_mitigations:
  - risk: "Scope creep during sprint"
    mitigation: "Require PO approval and explicit sprint goal impact note for added scope."
  - risk: "Inconsistent status updates"
    mitigation: "Daily board hygiene rule and standup enforcement."
  - risk: "Over-commitment"
    mitigation: "Capacity-based planning using last 3 sprint velocity average."

rollout_plan:
  phase_1:
    name: "Pilot"
    duration: "2 sprints"
    activities:
      - "Enable configuration for one team"
      - "Collect baseline metrics"
  phase_2:
    name: "Scale"
    duration: "4 sprints"
    activities:
      - "Adopt across all scrum teams"
      - "Standardize dashboard/report templates"

reporting:
  dashboards:
    - "Sprint Health Dashboard"
    - "Blocked Issues Dashboard"
  reports:
    - "Burndown Chart"
    - "Velocity Chart"
    - "Sprint Report"
  review_cadence: "Daily by team (execution), weekly stakeholder summary, end-of-sprint (closure)"

validation_checklist:
  objective_evidence:
    - requirement_id: "FR-1"
      validation: "Sprint record includes goal, start date, and end date; creator is PO or Scrum Master."
      evidence_source: "Jira sprint metadata and audit history"
      owner: "Scrum Master"
      cadence: "Each sprint start"
    - requirement_id: "FR-2"
      validation: "Committed issues are moved from prioritized backlog into active sprint before start."
      evidence_source: "Jira sprint issue list and backlog ordering snapshot"
      owner: "Product Owner"
      cadence: "Each sprint planning"
    - requirement_id: "FR-3"
      validation: "All Stories and Bugs in committed backlog have non-empty Story Points at lock time."
      evidence_source: "Jira filter/export at sprint start timestamp"
      owner: "Engineering Team"
      cadence: "Each sprint start"
    - requirement_id: "FR-4"
      validation: "Board columns map to To Do, In Progress, In Review, Done and are actively used."
      evidence_source: "Board configuration and workflow mapping"
      owner: "Scrum Master"
      cadence: "Monthly and on workflow change"
    - requirement_id: "FR-5"
      validation: "Blocked issue owner is assigned within 4 business hours in project timezone."
      evidence_source: "Issue history for block event and owner assignment timestamp"
      owner: "Scrum Master"
      cadence: "Daily"
    - requirement_id: "FR-6"
      validation: "Status updates occur before standup ends for active sprint issues."
      evidence_source: "Issue transition history and standup attendance/notes"
      owner: "Engineering Team"
      cadence: "Daily"
    - requirement_id: "FR-7"
      validation: "Closure package includes completed/incomplete work, carryover, reliability, and velocity snapshot."
      evidence_source: "Sprint report artifact and dashboard snapshot"
      owner: "Scrum Master"
      cadence: "Each sprint close"
    - requirement_id: "FR-8"
      validation: "Metric baseline uses sprint start timestamp as commitment lock."
      evidence_source: "Metric job/query configuration and sprint start record"
      owner: "Engineering Operations"
      cadence: "Per metric run"
    - requirement_id: "FR-9"
      validation: "Post-lock additions are tagged scope-added and excluded from reliability denominator."
      evidence_source: "Issue changelog plus metric calculation output"
      owner: "Product Owner"
      cadence: "Daily and at sprint close"
    - requirement_id: "FR-10"
      validation: "Only PO or Scrum Master starts/closes sprint."
      evidence_source: "Sprint action audit history"
      owner: "Engineering Operations"
      cadence: "Each sprint lifecycle event"
    - requirement_id: "FR-11"
      validation: "Tasks counted in metrics are both estimated and labeled customer-facing."
      evidence_source: "Issue fields/labels and metric inclusion query"
      owner: "Product Owner"
      cadence: "At sprint start and close"
    - requirement_id: "NFR-1"
      validation: "Average dashboard load time remains under 3 seconds for normal team usage."
      evidence_source: "Dashboard performance telemetry"
      owner: "Engineering Operations"
      cadence: "Weekly"
    - requirement_id: "NFR-2"
      validation: "Least-privilege permissions are enforced; sprint start/close rights only for PO and Scrum Master."
      evidence_source: "Jira permission scheme and role mapping"
      owner: "Engineering Operations"
      cadence: "Quarterly and on role change"
    - requirement_id: "NFR-3"
      validation: "Issue history and sprint reports retain sufficient data for audit reviews."
      evidence_source: "Jira history entries and sprint artifacts"
      owner: "Engineering Operations"
      cadence: "Quarterly"