import { EFFORT_FIELD } from '../fields-scenario.js'
import type { DemoOrganizationScenario } from '../scenario.js'

export const PINECONE_LABS: DemoOrganizationScenario = {
  title: 'Pinecone Labs',
  slug: 'pinecone-labs',
  description: 'B2B SaaS product team building a workflow automation platform for ops teams.',
  extraIdeaTypes: ['Spike'],
  fieldConfig: {
    fields: [
      EFFORT_FIELD,
      { name: 'Story points', type: 'Number' },
      { name: 'Customer-requested', type: 'Boolean' },
      { name: 'Release target', type: 'Date' },
      {
        name: 'Affected component',
        type: 'Dropdown',
        options: ['API', 'Web app', 'Mobile app', 'Workflow engine', 'Billing'],
      },
      { name: 'Spec link', type: 'Url' },
    ],
    fieldsets: [
      {
        name: 'Sizing',
        description: 'Effort and story points for planning.',
        fields: ['Effort', 'Story points'],
      },
      {
        name: 'Delivery details',
        description: 'Where the change lands and when.',
        fields: ['Release target', 'Affected component', 'Spec link'],
      },
    ],
    typeFields: [
      {
        ideaType: 'Continuous Improvement',
        fieldsets: ['Sizing'],
        fields: [{ name: 'Customer-requested', required: true }],
      },
      { ideaType: 'Process Revision', fieldsets: ['Sizing', 'Delivery details'], fields: [] },
    ],
    fieldValues: [
      { ideaIndex: 0, values: { Effort: 'M', 'Story points': '5', 'Customer-requested': 'true' } },
      {
        ideaIndex: 1,
        values: {
          Effort: 'L',
          'Story points': '8',
          'Release target': '2026-11-20',
          'Affected component': 'Workflow engine',
          'Spec link': 'https://docs.pinecone-labs.example/specs/run-history',
        },
      },
      { ideaIndex: 2, values: { Effort: 'S', 'Story points': '3', 'Customer-requested': 'false' } },
      {
        ideaIndex: 3,
        values: {
          Effort: 'XL',
          'Story points': '13',
          'Release target': '2027-01-15',
          'Affected component': 'API',
        },
      },
      { ideaIndex: 4, values: { Effort: 'XS', 'Story points': '2', 'Customer-requested': 'true' } },
    ],
  },
  sprintGoal:
    'Let a customer admin connect their identity provider and invite a first teammate without contacting support.',
  accounts: [
    { firstName: 'Priya', lastName: 'Raman', localPart: 'orgadmin', role: 'OrgAdmin' },
    { firstName: 'Daniel', lastName: 'Okafor', localPart: 'user', role: 'User' },
    { firstName: 'Hannah', lastName: 'Lindqvist', localPart: 'user2', role: 'User' },
    { firstName: 'Marcus', lastName: 'Bell', localPart: 'readonly', role: 'ReadOnly' },
  ],
  boards: [
    {
      name: 'Ideas',
      description:
        'Product backlog: user-facing improvements to onboarding, the public API and reliability.',
      focus: 'Product backlog',
      tagNames: ['onboarding', 'api', 'reliability', 'customer-request'],
      ideas: [
        {
          title: 'Self-serve SSO setup',
          description:
            'Let customer admins configure SAML single sign-on themselves from workspace settings.',
          problem:
            'SSO is configured by a support engineer over a shared screen, and the queue averages nine days. Four enterprise trials stalled in the last quarter waiting on it.',
          proposedSolutions: [
            'Add a SAML setup wizard with metadata upload and a test-login step.',
            'Show per-field validation errors that name the identity provider setting to fix.',
          ],
          impactRationale:
            'SSO tickets are about 12% of support volume and gate most enterprise deals. Self-serve setup should cut time-to-SSO from nine days to under one hour.',
        },
        {
          title: 'Guided onboarding checklist',
          description:
            'Show new workspaces a short checklist that leads to their first working automation.',
          problem:
            'Only 38% of new workspaces create an automation in their first week. Session recordings show people leaving the empty dashboard without knowing where to start.',
          proposedSolutions: [
            'Add a five-step checklist (invite teammate, connect an app, build, test, activate) pinned to the dashboard.',
            'Track each step so the checklist resumes where the user left off.',
          ],
          impactRationale:
            'Lifting week-one activation from 38% to 50% would add roughly 90 activated workspaces a month at current signup volume.',
        },
        {
          title: 'Webhook delivery log',
          description:
            'Give customers a searchable log of outbound webhook attempts with status and payload.',
          problem:
            'When a customer endpoint fails, they email support asking whether we sent the event. Engineers grep production logs to answer, which takes about 25 minutes per ticket.',
          proposedSolutions: [
            'Store the last 30 days of delivery attempts with response code and latency.',
            'Add a one-click replay for failed deliveries.',
          ],
          impactRationale:
            'Webhook questions generate around 40 tickets a month. A self-serve log removes most of them, saving roughly 15 engineer hours monthly.',
        },
        {
          title: 'API key rotation without downtime',
          description:
            'Allow two active API keys per integration so customers can rotate without an outage.',
          problem:
            'Creating a new API key immediately revokes the old one, so customers rotating keys see failures until every service is redeployed. Two customers had outages during rotation last quarter.',
          proposedSolutions: [
            'Permit two active keys per integration with an optional expiry on the older one.',
            'Show last-used time per key so customers know when it is safe to delete the old one.',
          ],
          impactRationale:
            'Security reviews increasingly require 90-day rotation. Removing the outage risk unblocks about six pending enterprise security questionnaires.',
        },
        {
          title: 'Rate limit headers on every API response',
          description:
            'Return remaining quota and reset time headers so clients can back off before hitting 429s.',
          problem:
            'Clients only learn they are throttled when they receive a 429, and many retry immediately. That amplifies load and produces about 1,200 support-visible errors a week.',
          proposedSolutions: [
            'Add RateLimit-Limit, RateLimit-Remaining and RateLimit-Reset headers to all authenticated endpoints.',
            'Document a recommended backoff pattern in the API reference.',
          ],
          impactRationale:
            'Cooperative backoff should cut retry-driven 429s by about 60% and lower peak API load during customer batch jobs.',
        },
        {
          title: 'Role-based workspace permissions',
          description: 'Add viewer, editor and admin roles to control who can change automations.',
          problem:
            'Every member can edit and delete any automation. One customer lost a production workflow to an accidental delete and asked for restricted access.',
          proposedSolutions: [
            'Introduce viewer, editor and admin roles with sensible defaults for existing members.',
            'Record role changes in the audit log.',
          ],
          impactRationale:
            'Permissions are requested in 17 of the last 30 sales calls. It is also a prerequisite for the compliance package planned next quarter.',
        },
        {
          title: 'Bulk CSV import for contacts',
          description:
            'Support importing thousands of contacts from CSV with a column mapping step.',
          problem:
            'The importer accepts only 500 rows at a time and fails silently on malformed lines. Customers migrating from competitors split files by hand.',
          proposedSolutions: [
            'Process uploads asynchronously up to 100,000 rows with a downloadable error report.',
            'Let users map CSV columns to fields and save the mapping for reuse.',
          ],
          impactRationale:
            'Migration friction is the top reason cited in lost-deal notes for mid-market accounts, about 8 deals in the last two quarters.',
        },
        {
          title: 'In-app status banner for incidents',
          description:
            'Show a banner in the product when there is an active incident affecting the customer.',
          problem:
            'During the March outage customers learned about it from social media because our status page is a separate site nobody checks. Support received 140 tickets in two hours.',
          proposedSolutions: [
            'Poll the status page API and show a dismissible banner for active incidents.',
            'Link the banner to the incident with its latest update.',
          ],
          impactRationale:
            'Proactive notice should deflect most duplicate tickets during an incident, roughly 100 per major event, and protect trust.',
        },
        {
          title: 'Automation run history export',
          description:
            'Let admins export run history as CSV for audits and billing reconciliation.',
          problem:
            'Finance teams at customers ask for monthly run counts per automation. We produce them with a manual SQL query for each request.',
          proposedSolutions: [
            'Add an export button on the runs page with date range and automation filters.',
            'Offer a scheduled monthly export delivered by email.',
          ],
          impactRationale:
            'About 25 requests a month currently go to engineering. Self-serve export frees roughly 10 hours a month and supports usage-based billing disputes.',
        },
        {
          title: 'Dark mode for the builder',
          description:
            'Add a dark theme to the automation builder that follows the system setting.',
          problem:
            'The builder is bright white, and users working in long sessions or at night ask for a dark theme. It has 60 votes on the public feedback board.',
          proposedSolutions: [
            'Add dark theme tokens and follow prefers-color-scheme with a manual override.',
          ],
          impactRationale:
            'A low-risk change that addresses the most-voted request and improves comfort for the power users who spend hours a day in the builder.',
        },
        {
          title: 'Retry policy per automation step',
          description:
            'Configure retry count and backoff on each step instead of using a global default.',
          problem:
            'All steps retry three times with a fixed delay. Calls to slow partner APIs fail needlessly while idempotency-sensitive steps get retried when they should not.',
          proposedSolutions: [
            'Add per-step retry settings with exponential backoff and a no-retry option.',
            'Surface retry attempts in the run timeline.',
          ],
          impactRationale:
            'Roughly 4% of failed runs are due to transient partner timeouts. Tuned retries should recover most of them without customer action.',
        },
      ],
      commentBodies: [
        'The wizard needs a test-login step before it saves anything, otherwise admins will lock themselves out with a bad certificate. Can we build that into the first slice?',
        'Agreed, saving only after a successful test login is in scope. I have asked design for the metadata upload screen and we can start the backend this sprint.',
        'Support can share the last ten SSO tickets so we know which identity providers to test first. Okta and Entra cover most of them.',
      ],
      checklists: [
        [
          { title: 'Draft SAML metadata upload screen', state: 'Done', assignee: 2 },
          { title: 'Implement ACS endpoint and assertion validation', state: 'Done', assignee: 1 },
          { title: 'Add test-login step before save', state: 'InProgress', assignee: 1 },
          { title: 'Document Okta and Entra setup', state: 'NotStarted', assignee: 0 },
        ],
        [
          { title: 'Define the five checklist steps with product', state: 'Done', assignee: 0 },
          { title: 'Build checklist component on the dashboard', state: 'InProgress', assignee: 2 },
          { title: 'Instrument step completion events', state: 'NotStarted', assignee: null },
        ],
      ],
    },
    {
      name: 'Opportunities',
      description:
        'Engineering health: faster CI, less tech debt, a calmer on-call and more trustworthy tests.',
      focus: 'Engineering health',
      tagNames: ['ci-speed', 'tech-debt', 'on-call', 'testing'],
      ideas: [
        {
          title: 'Flaky test quarantine',
          description:
            'Automatically quarantine tests that fail intermittently so they stop blocking merges.',
          problem:
            'About 7% of main-branch CI runs fail on a test that passes on retry. Developers rerun by habit and stop trusting red builds.',
          proposedSolutions: [
            'Detect tests that flip result on the same commit and move them to a non-blocking quarantine suite.',
            'Open a ticket per quarantined test with an owner and a two-week deadline.',
          ],
          impactRationale:
            'Reruns burn about 30 engineer-hours a week of waiting. Quarantine should cut false red builds by around 80%.',
        },
        {
          title: 'Cache dependencies in CI',
          description: 'Restore the package and build caches between CI runs to shorten pipelines.',
          problem:
            'Every pipeline reinstalls dependencies from scratch, which takes about six minutes of a fourteen-minute run.',
          proposedSolutions: [
            'Cache the package store keyed on the lockfile hash.',
            'Enable remote build caching for the monorepo tasks.',
          ],
          impactRationale:
            'Cutting median pipeline time from 14 to under 8 minutes saves roughly 400 developer-minutes per day across the team.',
        },
        {
          title: 'Runbooks linked from every alert',
          description: 'Attach a runbook link and first-response steps to each paging alert.',
          problem:
            'New on-call engineers get paged for alerts with no context and spend 15 to 20 minutes finding the right dashboard and past incidents.',
          proposedSolutions: [
            'Require a runbook URL on every paging alert definition.',
            'Write runbooks for the ten noisiest alerts first.',
          ],
          impactRationale:
            'Faster first response should cut mean time to acknowledge by about 10 minutes and make the rotation less daunting to join.',
        },
        {
          title: 'Retire the legacy billing module',
          description:
            'Remove the old billing code path now that all customers are on the new one.',
          problem:
            'Two billing implementations coexist behind a feature flag, doubling the test matrix. Every pricing change touches both and has caused two invoice bugs this year.',
          proposedSolutions: [
            'Confirm no accounts remain on the legacy flag, then delete the module and its tests.',
          ],
          impactRationale:
            'Removes about 6,000 lines and a flag from the hottest path, and cuts pricing change effort by roughly a third.',
        },
        {
          title: 'Alert noise review',
          description: 'Audit paging alerts and delete or downgrade the ones nobody acts on.',
          problem:
            'On-call received 94 pages last month, and 61 were auto-resolved or ignored. Engineers have started to mute the channel.',
          proposedSolutions: [
            'Review each alert against whether it needs a human within 15 minutes.',
            'Downgrade the rest to tickets or dashboards.',
          ],
          impactRationale:
            'Targeting under 30 actionable pages a month should reduce burnout and the risk of missing a real incident.',
        },
        {
          title: 'Contract tests for partner integrations',
          description: 'Add contract tests so partner API changes are caught before production.',
          problem:
            'Three integration breakages this year came from partners changing response shapes. We found out from customer reports hours later.',
          proposedSolutions: [
            'Record partner responses as contracts and verify them in a nightly job.',
            'Alert the owning team when a contract drifts.',
          ],
          impactRationale:
            'Each breakage cost about a day of engineering and several affected customers. Early detection should turn them into planned fixes.',
        },
        {
          title: 'Upgrade to the current Node LTS',
          description:
            'Move services and CI to the current Node LTS before the old one reaches end of life.',
          problem:
            'Production runs a Node version that leaves security support in four months, and several dependencies have dropped it.',
          proposedSolutions: [
            'Upgrade CI first, fix failures, then roll services one at a time behind a canary.',
          ],
          impactRationale:
            'Avoids an unsupported runtime in production and unlocks faster startup, which trims about 15% from cold-start latency.',
        },
        {
          title: 'Database migration safety checks',
          description: 'Lint migrations for locks and unsafe changes before they can merge.',
          problem:
            'A column rewrite locked the runs table for four minutes last quarter and delayed automations for every customer.',
          proposedSolutions: [
            'Add a migration linter in CI that blocks table-rewriting changes without an approved plan.',
            'Document the expand and contract pattern for schema changes.',
          ],
          impactRationale:
            'Prevents a repeat of a customer-visible incident and gives reviewers an objective check instead of relying on memory.',
        },
        {
          title: 'Preview environments for pull requests',
          description: 'Spin up a disposable environment for each pull request for review and QA.',
          problem:
            'QA tests on a single shared staging environment, so branches queue up and test results get mixed. Verification waits average a day and a half.',
          proposedSolutions: [
            'Deploy every pull request to a short-lived environment with seeded data.',
            'Tear it down automatically on merge or after seven days.',
          ],
          impactRationale:
            'Removing the staging queue should cut review-to-merge time by about a day and let product sign off on UI changes earlier.',
        },
        {
          title: 'Structured logging with trace ids',
          description: 'Emit structured logs carrying a trace id across API, workers and queues.',
          problem:
            'Following one automation run across services means correlating timestamps by hand. Incident investigations spend most of their time finding the relevant lines.',
          proposedSolutions: [
            'Adopt a shared logger that adds trace and run ids to every line.',
            'Propagate the trace id through queue messages.',
          ],
          impactRationale:
            'Cuts typical investigation time from about 45 minutes to 10 and makes customer support lookups feasible without an engineer.',
        },
        {
          title: 'Weekly dependency update bot',
          description:
            'Open grouped dependency update pull requests weekly instead of letting versions age.',
          problem:
            'Dependencies are updated only when something breaks. We currently carry 23 packages with known advisories and several major versions behind.',
          proposedSolutions: [
            'Enable an update bot that groups minor and patch bumps into one weekly pull request.',
          ],
          impactRationale:
            'Keeps upgrades small and reviewable, and should bring open security advisories to zero within a month.',
        },
      ],
      commentBodies: [
        'I pulled the last 30 days of CI data: 41 tests account for almost all the flakes. Quarantining just those would clear most of the false reds.',
        'Good data. Let us start with a quarantine suite that still reports but does not block, and give each owner two weeks before we delete anything.',
        'On-call would also like the quarantine list posted in the team channel every Monday so it does not quietly grow.',
      ],
    },
  ],
}
