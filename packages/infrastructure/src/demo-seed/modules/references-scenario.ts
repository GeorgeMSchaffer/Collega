/**
 * The Board References demo data: for each vertical organization, a work board that its
 * `Opportunities` board hands tasks to, the sprints on it, the Outcomes that group the organization's
 * top-level items, and the metric values those Outcomes total.
 *
 * Content only; `board-references.ts` writes it. Items are named by reference, not by id:
 *   - `ideas:N` / `opps:N`  the Nth idea of the organization's first / second board;
 *   - `card:KEY`            a standalone card on the work board (a task with no parent).
 * Only top-level items (no parent) can sit under an Outcome or carry metric values.
 *
 * Why the verticals only: Acme and Blue Harbor are the fixtures the golden corpus and the E2E suite
 * pin by slug (4 boards, 44 ideas), so they stay as they were.
 */

export type WorkLane = 'todo' | 'doing' | 'review' | 'done'
export type DemoEffort = 'Low' | 'Medium' | 'High'

export type DemoTask = {
  /** Unique within the organization; what `blockedBy` and `card:` refer to. */
  readonly key: string
  readonly title: string
  readonly lane: WorkLane
  /** Indexes into CONTRIBUTOR_LOCAL_PARTS. */
  readonly assignees?: readonly number[]
  /** 1-5, the organization's sprints below; absent is the backlog. */
  readonly sprint?: 1 | 2 | 3 | 4 | 5
  /** Keys of tasks defined earlier, so a cycle cannot be written. */
  readonly blockedBy?: readonly string[]
  /** A tag name the organization already has. */
  readonly tag?: string
}

export type DemoParent = {
  /** Index into the second board's ideas. */
  readonly idea: number
  readonly effort: DemoEffort
  /** true: the idea sits in the reference lane (In Progress); false: it is already past it. */
  readonly inLane: boolean
  readonly tasks: readonly DemoTask[]
}

export type DemoMetricType = {
  readonly key: string
  readonly name: string
  readonly unit: string | null
  readonly archived?: boolean
}

export type DemoMetricValue = {
  readonly item: string
  readonly metric: string
  readonly projected?: number
  readonly realized?: number
}

export type DemoOutcome = {
  readonly key: string
  readonly name: string
  readonly description: string
  /** Index into CONTRIBUTOR_LOCAL_PARTS. */
  readonly owner: number
  /** Quarter offsets from the quarter containing the seed's today: -1 is last quarter. */
  readonly startQuarter: number
  readonly endQuarter: number
  /** Index into the tag palette, so the colours are distinct and stable. */
  readonly color: number
  readonly items: readonly string[]
}

export type DemoReferenceScenario = {
  readonly slug: string
  readonly workBoard: {
    readonly name: string
    readonly keyPrefix: string
    readonly description: string
  }
  /** Exactly five: two completed, one active, two planned. */
  readonly sprints: readonly { readonly name: string; readonly goal: string | null }[]
  readonly parents: readonly DemoParent[]
  readonly cards: readonly DemoTask[]
  /** Effort on ideas that are not parents, so the Effort field varies across the boards. */
  readonly otherEfforts: Readonly<Record<string, DemoEffort>>
  readonly metricTypes: readonly DemoMetricType[]
  readonly metricValues: readonly DemoMetricValue[]
  readonly outcomes: readonly DemoOutcome[]
}

/** Sprint windows in days from today, two weeks each, contiguous; the third is the active one. */
export const SPRINT_WINDOWS: readonly (readonly [number, number])[] = [
  [-35, -22],
  [-21, -8],
  [-7, 6],
  [7, 20],
  [21, 34],
]
export const SPRINT_STATES = ['Completed', 'Completed', 'Active', 'Planned', 'Planned'] as const

// Opportunities ideas 2 and 4 start in other lanes and are moved into In Progress; 5 and 6 already
// sit there; 7 (Client Review) and 8 (Complete) are past the lane.

const PINECONE: DemoReferenceScenario = {
  slug: 'pinecone-labs',
  workBoard: {
    name: 'Engineering',
    keyPrefix: 'ENG',
    description: 'Engineering tasks that deliver approved improvements, planned in sprints.',
  },
  sprints: [
    { name: 'Sprint 41', goal: 'Cut alert noise before the next on-call rotation.' },
    { name: 'Sprint 42', goal: 'Contract-test groundwork and the first migration checks.' },
    { name: 'Sprint 43', goal: 'Get the Node upgrade and the partner fixtures into review.' },
    { name: 'Sprint 44', goal: 'Run the contract tests nightly and take the upgrade to staging.' },
    { name: 'Sprint 45', goal: null },
  ],
  parents: [
    { idea: 2, effort: 'Low', inLane: true, tasks: [] },
    {
      idea: 4,
      effort: 'Medium',
      inLane: true,
      tasks: [
        {
          key: '4a',
          title: 'Export 90 days of alert history',
          lane: 'done',
          assignees: [1],
          sprint: 1,
        },
        {
          key: '4b',
          title: 'Classify alerts by actionability',
          lane: 'done',
          assignees: [1],
          sprint: 1,
        },
        {
          key: '4c',
          title: 'Delete or retune the 12 noisiest alerts',
          lane: 'done',
          assignees: [0],
          sprint: 2,
          tag: 'on-call',
        },
      ],
    },
    {
      idea: 5,
      effort: 'High',
      inLane: true,
      tasks: [
        {
          key: '5a',
          title: 'Pick the three partners to cover first',
          lane: 'done',
          assignees: [0],
          sprint: 2,
        },
        {
          key: '5b',
          title: 'Record sandbox fixtures for partner A',
          lane: 'review',
          assignees: [2],
          sprint: 3,
          tag: 'testing',
        },
        {
          key: '5f',
          title: 'Record sandbox fixtures for partner B',
          lane: 'doing',
          assignees: [1],
          sprint: 3,
          tag: 'testing',
        },
        {
          key: '5c',
          title: 'Write consumer contract tests for partner A',
          lane: 'todo',
          assignees: [2],
          sprint: 4,
          blockedBy: ['5b'],
          tag: 'testing',
        },
        {
          key: '5d',
          title: 'Run the contract tests in the nightly pipeline',
          lane: 'todo',
          assignees: [1],
          sprint: 4,
          blockedBy: ['5c'],
          tag: 'ci-speed',
        },
      ],
    },
    {
      idea: 6,
      effort: 'High',
      inLane: true,
      tasks: [
        {
          key: '6a',
          title: 'Audit native dependencies for LTS support',
          lane: 'doing',
          assignees: [2],
          sprint: 3,
          tag: 'tech-debt',
        },
        {
          key: '6b',
          title: 'Upgrade the build image and the CI matrix',
          lane: 'todo',
          assignees: [1],
          sprint: 3,
          blockedBy: ['6a'],
          tag: 'ci-speed',
        },
        {
          key: '6c',
          title: 'Roll out to staging and watch it for a week',
          lane: 'todo',
          assignees: [0],
          sprint: 4,
          blockedBy: ['6b'],
        },
      ],
    },
    {
      idea: 7,
      effort: 'Medium',
      inLane: false,
      tasks: [
        {
          key: '7a',
          title: 'Lint migrations for locking statements',
          lane: 'done',
          assignees: [1],
          sprint: 1,
        },
        {
          key: '7b',
          title: 'Block destructive changes without an expand step',
          lane: 'done',
          assignees: [2],
          sprint: 2,
        },
        {
          key: '7c',
          title: 'Dry-run migrations against a production-sized copy',
          lane: 'done',
          assignees: [1],
          sprint: 2,
        },
        {
          key: '7d',
          title: 'Add the checks to the release checklist',
          lane: 'todo',
          assignees: [0],
        },
      ],
    },
    {
      idea: 8,
      effort: 'High',
      inLane: false,
      tasks: [
        {
          key: '8a',
          title: 'Provision per-branch databases from a snapshot',
          lane: 'done',
          assignees: [2],
          sprint: 1,
          tag: 'ci-speed',
        },
        {
          key: '8b',
          title: 'Tear down previews when the pull request closes',
          lane: 'done',
          assignees: [1],
          sprint: 2,
        },
      ],
    },
  ],
  cards: [
    {
      key: 'rotate',
      title: 'Rotate the staging signing keys',
      lane: 'done',
      assignees: [0],
      sprint: 2,
    },
    {
      key: 'flaky',
      title: 'Fix the flaky invoice export spec',
      lane: 'doing',
      assignees: [2],
      sprint: 3,
      tag: 'testing',
    },
    {
      key: 'worker',
      title: 'Investigate slow webhook worker startup',
      lane: 'todo',
      assignees: [1],
      sprint: 4,
      blockedBy: ['6a'],
      tag: 'tech-debt',
    },
    { key: 'flags', title: "Tidy the onboarding script's dead flags", lane: 'todo' },
  ],
  otherEfforts: {
    'opps:0': 'Low',
    'opps:1': 'Medium',
    'opps:3': 'High',
    'ideas:5': 'Medium',
    'ideas:6': 'High',
    'ideas:7': 'Low',
  },
  metricTypes: [
    { key: 'hours', name: 'Engineer hours saved', unit: 'h' },
    { key: 'cost', name: 'Annual cost avoided', unit: '$' },
    { key: 'pages', name: 'Pages avoided per month', unit: 'pages' },
    { key: 'build', name: 'Build minutes saved', unit: 'min', archived: true },
  ],
  metricValues: [
    { item: 'opps:8', metric: 'hours', projected: 120, realized: 140 },
    { item: 'opps:8', metric: 'cost', projected: 18000, realized: 21500 },
    { item: 'opps:8', metric: 'build', projected: 3000, realized: 3600 },
    { item: 'opps:7', metric: 'hours', projected: 60 },
    { item: 'opps:7', metric: 'cost', projected: 12000 },
    { item: 'opps:6', metric: 'hours', projected: 30 },
    { item: 'opps:4', metric: 'hours', projected: 90, realized: 75 },
    { item: 'opps:4', metric: 'pages', projected: 160, realized: 120 },
    { item: 'opps:2', metric: 'pages', projected: 80 },
    { item: 'opps:5', metric: 'hours', projected: 45 },
    { item: 'opps:5', metric: 'cost', projected: 20000 },
    { item: 'ideas:8', metric: 'hours', projected: 40, realized: 52 },
    { item: 'ideas:9', metric: 'cost', projected: 3000, realized: 2400 },
    { item: 'ideas:10', metric: 'hours', projected: 24, realized: 20 },
    { item: 'ideas:10', metric: 'cost', projected: 6000, realized: 4800 },
    { item: 'ideas:0', metric: 'hours', projected: 200 },
    { item: 'ideas:0', metric: 'cost', projected: 150000 },
    { item: 'ideas:1', metric: 'hours', projected: 60 },
    { item: 'ideas:3', metric: 'cost', projected: 30000 },
  ],
  outcomes: [
    {
      key: 'polish',
      name: 'Builder polish',
      description:
        'Small, visible improvements to the automation builder that customers asked for.',
      owner: 2,
      startQuarter: -2,
      endQuarter: -1,
      color: 2,
      items: ['ideas:8', 'ideas:9', 'ideas:10'],
    },
    {
      key: 'oncall',
      name: 'On-call that lets people sleep',
      description:
        'Fewer, better pages: retune the noisy alerts and link a runbook from every one.',
      owner: 0,
      startQuarter: -1,
      endQuarter: -1,
      color: 0,
      items: ['opps:4', 'opps:2', 'card:rotate'],
    },
    {
      key: 'releases',
      name: 'Faster, safer releases',
      description:
        'Take the friction out of shipping: migration checks, preview environments and a current runtime.',
      owner: 0,
      startQuarter: -1,
      endQuarter: 0,
      color: 5,
      items: ['opps:7', 'opps:8', 'opps:6', 'card:flaky'],
    },
    {
      key: 'integrations',
      name: 'Trustworthy integrations',
      description: 'Partners find out about a break from our tests, not from their customers.',
      owner: 1,
      startQuarter: 0,
      endQuarter: 1,
      color: 6,
      items: ['opps:5', 'card:worker', 'ideas:2'],
    },
    {
      key: 'onboarding',
      name: 'Self-serve enterprise onboarding',
      description:
        'A customer admin connects their identity provider and invites a first teammate without contacting support.',
      owner: 0,
      startQuarter: 1,
      endQuarter: 2,
      color: 1,
      items: ['ideas:0', 'ideas:1', 'ideas:3'],
    },
    {
      key: 'residency',
      name: 'Data residency options',
      description: 'Scoping what it takes to offer EU-only data storage. Nothing committed yet.',
      owner: 1,
      startQuarter: 2,
      endQuarter: 2,
      color: 7,
      items: [],
    },
  ],
}

const BRIGHTLINE: DemoReferenceScenario = {
  slug: 'brightline-creative',
  workBoard: {
    name: 'Production',
    keyPrefix: 'PROD',
    description: 'Agency operations work that delivers approved improvements, planned in cycles.',
  },
  sprints: [
    { name: 'Cycle 18', goal: 'Land the reporting template and the first client pilots.' },
    { name: 'Cycle 19', goal: 'Finish the naming standard and collect freelancer rates.' },
    { name: 'Cycle 20', goal: 'Get the rate card and the change-request form into review.' },
    {
      name: 'Cycle 21',
      goal: 'Finance sign-off on the rate card; wire the form into the tracker.',
    },
    { name: 'Cycle 22', goal: null },
  ],
  parents: [
    { idea: 2, effort: 'Low', inLane: true, tasks: [] },
    {
      idea: 4,
      effort: 'Medium',
      inLane: true,
      tasks: [
        {
          key: '4a',
          title: 'Map the metrics each client already reports',
          lane: 'done',
          assignees: [1],
          sprint: 1,
          tag: 'reporting',
        },
        {
          key: '4b',
          title: 'Build the report template in the reporting tool',
          lane: 'done',
          assignees: [2],
          sprint: 1,
          tag: 'reporting',
        },
        {
          key: '4c',
          title: 'Send the first automated report to two pilot clients',
          lane: 'done',
          assignees: [1],
          sprint: 2,
          tag: 'reporting',
        },
      ],
    },
    {
      idea: 5,
      effort: 'Medium',
      inLane: true,
      tasks: [
        {
          key: '5a',
          title: 'Collect rates from the 15 regular freelancers',
          lane: 'done',
          assignees: [0],
          sprint: 2,
        },
        {
          key: '5b',
          title: 'Draft the tiered rate card',
          lane: 'review',
          assignees: [1],
          sprint: 3,
        },
        {
          key: '5f',
          title: 'Tag freelancers by skill and availability',
          lane: 'doing',
          assignees: [2],
          sprint: 3,
          tag: 'utilization',
        },
        {
          key: '5c',
          title: 'Get finance sign-off on the rate card',
          lane: 'todo',
          assignees: [0],
          sprint: 4,
          blockedBy: ['5b'],
        },
        {
          key: '5d',
          title: 'Publish the bench in the resourcing tool',
          lane: 'todo',
          assignees: [2],
          sprint: 4,
          blockedBy: ['5c'],
          tag: 'utilization',
        },
      ],
    },
    {
      idea: 6,
      effort: 'Low',
      inLane: true,
      tasks: [
        {
          key: '6a',
          title: 'Interview three account leads about change requests',
          lane: 'doing',
          assignees: [2],
          sprint: 3,
        },
        {
          key: '6b',
          title: 'Draft the request form with cost and timeline fields',
          lane: 'todo',
          assignees: [1],
          sprint: 3,
          blockedBy: ['6a'],
          tag: 'approvals',
        },
        {
          key: '6c',
          title: 'Wire the form into the project tracker',
          lane: 'todo',
          assignees: [0],
          sprint: 4,
          blockedBy: ['6b'],
        },
      ],
    },
    {
      idea: 7,
      effort: 'Low',
      inLane: false,
      tasks: [
        {
          key: '7a',
          title: 'Audit the folder structure on five accounts',
          lane: 'done',
          assignees: [2],
          sprint: 1,
        },
        {
          key: '7b',
          title: 'Write the naming convention',
          lane: 'done',
          assignees: [1],
          sprint: 2,
        },
        {
          key: '7c',
          title: 'Migrate the two pilot accounts',
          lane: 'done',
          assignees: [2],
          sprint: 2,
        },
        {
          key: '7d',
          title: 'Add the standard to the new hire checklist',
          lane: 'todo',
          assignees: [0],
        },
      ],
    },
    {
      idea: 8,
      effort: 'Medium',
      inLane: false,
      tasks: [
        {
          key: '8a',
          title: "Collect last year's best review decks",
          lane: 'done',
          assignees: [1],
          sprint: 1,
        },
        {
          key: '8b',
          title: 'Build the template with the three standard sections',
          lane: 'done',
          assignees: [2],
          sprint: 2,
        },
      ],
    },
  ],
  cards: [
    {
      key: 'licence',
      title: 'Renew the stock footage licence',
      lane: 'done',
      assignees: [0],
      sprint: 2,
    },
    {
      key: 'tracker',
      title: 'Set up the Q4 retainer tracker sheet',
      lane: 'doing',
      assignees: [1],
      sprint: 3,
      tag: 'utilization',
    },
    {
      key: 'pitch',
      title: 'Prepare the pitch folder for the beverage launch',
      lane: 'todo',
      assignees: [2],
      sprint: 4,
    },
    { key: 'perms', title: 'Clean up shared drive permissions', lane: 'todo' },
  ],
  otherEfforts: {
    'opps:0': 'Low',
    'opps:1': 'Medium',
    'opps:3': 'High',
    'ideas:5': 'Medium',
    'ideas:6': 'High',
    'ideas:7': 'Low',
  },
  metricTypes: [
    { key: 'hours', name: 'Hours recovered per month', unit: 'h' },
    { key: 'revenue', name: 'Annual revenue protected', unit: '$' },
    { key: 'reports', name: 'Reports automated', unit: null, archived: true },
  ],
  metricValues: [
    { item: 'opps:4', metric: 'hours', projected: 36, realized: 30 },
    { item: 'opps:4', metric: 'reports', projected: 12, realized: 12 },
    { item: 'opps:8', metric: 'hours', projected: 20, realized: 22 },
    { item: 'opps:6', metric: 'hours', projected: 25 },
    { item: 'opps:7', metric: 'hours', projected: 18 },
    { item: 'opps:2', metric: 'hours', projected: 50 },
    { item: 'opps:2', metric: 'revenue', projected: 90000 },
    { item: 'opps:5', metric: 'revenue', projected: 60000 },
    { item: 'ideas:8', metric: 'hours', projected: 10, realized: 8 },
    { item: 'ideas:9', metric: 'revenue', projected: 40000, realized: 52000 },
    { item: 'ideas:10', metric: 'revenue', projected: 15000, realized: 9000 },
    { item: 'ideas:0', metric: 'revenue', projected: 120000 },
    { item: 'ideas:1', metric: 'hours', projected: 80 },
    { item: 'ideas:5', metric: 'revenue', projected: 35000 },
  ],
  outcomes: [
    {
      key: 'seasonal',
      name: 'Seasonal planning',
      description:
        'A shared campaign calendar and a burn-down view so seasons stop surprising the team.',
      owner: 2,
      startQuarter: -2,
      endQuarter: -1,
      color: 2,
      items: ['ideas:8', 'ideas:10'],
    },
    {
      key: 'reporting',
      name: 'Consistent client reporting',
      description: 'Every client gets the same monthly report and the same review deck, on time.',
      owner: 0,
      startQuarter: -1,
      endQuarter: 0,
      color: 5,
      items: ['opps:4', 'opps:8', 'ideas:9'],
    },
    {
      key: 'intake',
      name: 'Cleaner project intake',
      description:
        'Scope changes and assets come in through one door, named and filed the same way.',
      owner: 1,
      startQuarter: 0,
      endQuarter: 0,
      color: 1,
      items: ['opps:6', 'opps:7', 'card:perms'],
    },
    {
      key: 'resourcing',
      name: 'Predictable resourcing',
      description: 'Know who is free, at what rate, a month ahead.',
      owner: 0,
      startQuarter: 0,
      endQuarter: 1,
      color: 6,
      items: ['opps:2', 'opps:5', 'card:tracker'],
    },
    {
      key: 'learning',
      name: 'Creative that learns',
      description: 'Test creative systematically and feed the winners back into new work.',
      owner: 2,
      startQuarter: 1,
      endQuarter: 2,
      color: 7,
      items: ['ideas:0', 'ideas:1', 'ideas:5', 'card:pitch'],
    },
    {
      key: 'retainers',
      name: 'Retainer profitability',
      description: 'Understand which retainers earn their keep. Scoping only.',
      owner: 1,
      startQuarter: 2,
      endQuarter: 2,
      color: 0,
      items: [],
    },
  ],
}

const MERIDIAN: DemoReferenceScenario = {
  slug: 'meridian-holdings',
  workBoard: {
    name: 'Improvement Actions',
    keyPrefix: 'ACT',
    description:
      'Actions that deliver approved improvements across the divisions, planned in iterations.',
  },
  sprints: [
    {
      name: 'Iteration 7',
      goal: 'Pick the first training cohort and nominate division champions.',
    },
    { name: 'Iteration 8', goal: 'Run cohort one; get the invoices for the carrier negotiation.' },
    { name: 'Iteration 9', goal: 'Close the carrier contract and agree the benefit definitions.' },
    {
      name: 'Iteration 10',
      goal: 'Move the regions to the new carrier; load the first realized benefits.',
    },
    { name: 'Iteration 11', goal: null },
  ],
  parents: [
    { idea: 2, effort: 'Low', inLane: true, tasks: [] },
    {
      idea: 4,
      effort: 'Medium',
      inLane: true,
      tasks: [
        {
          key: '4a',
          title: 'Pick the 40 process owners for the first cohort',
          lane: 'done',
          assignees: [0],
          sprint: 1,
          tag: 'training',
        },
        {
          key: '4b',
          title: 'Book the facilitator and three training dates',
          lane: 'done',
          assignees: [1],
          sprint: 1,
          tag: 'training',
        },
        {
          key: '4c',
          title: 'Run cohort one and collect feedback',
          lane: 'done',
          assignees: [2],
          sprint: 2,
          tag: 'training',
        },
      ],
    },
    {
      idea: 5,
      effort: 'Medium',
      inLane: true,
      tasks: [
        {
          key: '5a',
          title: 'Pull 12 months of print and courier invoices',
          lane: 'done',
          assignees: [1],
          sprint: 2,
          tag: 'cost-takeout',
        },
        {
          key: '5b',
          title: 'Negotiate the consolidated carrier contract',
          lane: 'review',
          assignees: [0],
          sprint: 3,
          tag: 'vendor-consolidation',
        },
        {
          key: '5f',
          title: 'Set up the monthly spend report',
          lane: 'doing',
          assignees: [2],
          sprint: 3,
        },
        {
          key: '5c',
          title: 'Move the regional offices to the new carrier',
          lane: 'todo',
          assignees: [1],
          sprint: 4,
          blockedBy: ['5b'],
        },
        {
          key: '5d',
          title: 'Switch internal mailing to digital delivery',
          lane: 'todo',
          assignees: [2],
          sprint: 4,
          blockedBy: ['5c'],
        },
      ],
    },
    {
      idea: 6,
      effort: 'High',
      inLane: true,
      tasks: [
        {
          key: '6a',
          title: 'Agree the benefit definitions with Finance',
          lane: 'doing',
          assignees: [0],
          sprint: 3,
        },
        {
          key: '6b',
          title: 'Build the dashboard on the finance data mart',
          lane: 'todo',
          assignees: [1],
          sprint: 3,
          blockedBy: ['6a'],
        },
        {
          key: '6c',
          title: 'Load the first two quarters of realized benefits',
          lane: 'todo',
          assignees: [2],
          sprint: 4,
          blockedBy: ['6b'],
        },
      ],
    },
    {
      idea: 7,
      effort: 'Medium',
      inLane: false,
      tasks: [
        {
          key: '7a',
          title: 'Nominate champions in all six divisions',
          lane: 'done',
          assignees: [0],
          sprint: 1,
          tag: 'adoption',
        },
        {
          key: '7b',
          title: 'Hold the kickoff and share the playbook',
          lane: 'done',
          assignees: [1],
          sprint: 2,
          tag: 'adoption',
        },
        {
          key: '7c',
          title: 'Set up the monthly champion call',
          lane: 'done',
          assignees: [2],
          sprint: 2,
        },
        {
          key: '7d',
          title: 'Add champion goals to the annual review template',
          lane: 'todo',
          assignees: [0],
        },
      ],
    },
    {
      idea: 8,
      effort: 'Medium',
      inLane: false,
      tasks: [
        {
          key: '8a',
          title: 'Match devices to the plans they use',
          lane: 'done',
          assignees: [1],
          sprint: 1,
          tag: 'cost-takeout',
        },
        {
          key: '8b',
          title: 'Move 300 lines to the pooled plan',
          lane: 'done',
          assignees: [2],
          sprint: 2,
          tag: 'cost-takeout',
        },
      ],
    },
  ],
  cards: [
    {
      key: 'intranet',
      title: 'Update the Lighthouse intranet page',
      lane: 'done',
      assignees: [2],
      sprint: 2,
    },
    {
      key: 'steerco',
      title: 'Prepare the steering committee pack',
      lane: 'doing',
      assignees: [0],
      sprint: 3,
    },
    {
      key: 'claims',
      title: 'Collect Q4 benefit claims from the divisions',
      lane: 'todo',
      assignees: [1],
      sprint: 4,
      blockedBy: ['6a'],
    },
    { key: 'archive', title: 'Archive the 2025 workshop recordings', lane: 'todo' },
  ],
  otherEfforts: {
    'opps:0': 'Low',
    'opps:1': 'Medium',
    'opps:3': 'High',
    'ideas:5': 'Medium',
    'ideas:6': 'High',
    'ideas:7': 'Low',
  },
  metricTypes: [
    { key: 'cost', name: 'Annual cost avoided', unit: '$' },
    { key: 'hours', name: 'Hours saved per month', unit: 'h' },
    { key: 'trained', name: 'Employees trained', unit: 'people' },
    { key: 'licences', name: 'Licences retired', unit: null, archived: true },
  ],
  metricValues: [
    { item: 'opps:5', metric: 'cost', projected: 85000 },
    { item: 'opps:8', metric: 'cost', projected: 48000, realized: 51000 },
    { item: 'opps:0', metric: 'cost', projected: 120000 },
    { item: 'opps:0', metric: 'licences', projected: 14 },
    { item: 'opps:4', metric: 'trained', projected: 40, realized: 40 },
    { item: 'opps:7', metric: 'hours', projected: 25 },
    { item: 'ideas:8', metric: 'cost', projected: 22000, realized: 24500 },
    { item: 'ideas:8', metric: 'hours', projected: 90, realized: 110 },
    { item: 'ideas:9', metric: 'hours', projected: 35, realized: 30 },
    { item: 'ideas:10', metric: 'cost', projected: 30000, realized: 21000 },
    { item: 'ideas:10', metric: 'hours', projected: 60, realized: 48 },
    { item: 'ideas:0', metric: 'cost', projected: 200000 },
    { item: 'ideas:0', metric: 'hours', projected: 150 },
    { item: 'ideas:2', metric: 'hours', projected: 40 },
    { item: 'ideas:3', metric: 'cost', projected: 45000 },
    { item: 'ideas:3', metric: 'hours', projected: 55 },
  ],
  outcomes: [
    {
      key: 'paperless',
      name: 'Paperless back office',
      description:
        'Retire paper expense claims, standardize job requisitions and reconcile intercompany balances automatically.',
      owner: 1,
      startQuarter: -2,
      endQuarter: -1,
      color: 2,
      items: ['ideas:8', 'ideas:9', 'ideas:10'],
    },
    {
      key: 'spend',
      name: 'Lower indirect spend',
      description:
        'Consolidate carriers and licences and right-size what the divisions already pay for.',
      owner: 0,
      startQuarter: -1,
      endQuarter: 0,
      color: 5,
      items: ['opps:5', 'opps:8', 'opps:0'],
    },
    {
      key: 'adoption',
      name: 'Adoption of the Lighthouse way',
      description: 'Process owners trained, a champion in every division and managers briefed.',
      owner: 2,
      startQuarter: 0,
      endQuarter: 0,
      color: 1,
      items: ['opps:4', 'opps:7', 'opps:2', 'card:intranet'],
    },
    {
      key: 'benefits',
      name: 'Visible benefits',
      description:
        'Realized benefits tracked against the business case and reported to the steering committee.',
      owner: 0,
      startQuarter: 0,
      endQuarter: 1,
      color: 6,
      items: ['opps:6', 'card:steerco', 'card:claims'],
    },
    {
      key: 'p2p',
      name: 'Faster procure-to-pay',
      description: 'Three-way matching, standard requisitions and automated accruals.',
      owner: 1,
      startQuarter: 1,
      endQuarter: 2,
      color: 7,
      items: ['ideas:0', 'ideas:2', 'ideas:3'],
    },
    {
      key: 'shared',
      name: 'Shared services scoping',
      description: 'Decide which finance and HR work could move to a shared service. Scoping only.',
      owner: 2,
      startQuarter: 2,
      endQuarter: 2,
      color: 0,
      items: [],
    },
  ],
}

export const REFERENCE_SCENARIOS: readonly DemoReferenceScenario[] = [
  PINECONE,
  BRIGHTLINE,
  MERIDIAN,
]

const LANE_ORDER: readonly WorkLane[] = ['todo', 'doing', 'review', 'done']

/**
 * Throws on a scenario the application would not have produced. The rules are the ones the services
 * enforce: a blocked card leaves its first lane only once its blockers are final, a completed sprint
 * holds nothing unfinished, and only top-level items are grouped or valued.
 */
export function validateReferenceScenario(scenario: DemoReferenceScenario): void {
  const fail = (message: string): never => {
    throw new Error(`Reference scenario '${scenario.slug}': ${message}`)
  }
  if (scenario.sprints.length !== SPRINT_WINDOWS.length) fail('needs exactly five sprints')

  const tasks = [...scenario.parents.flatMap((parent) => parent.tasks), ...scenario.cards]
  const byKey = new Map<string, DemoTask>()
  for (const task of tasks) {
    if (byKey.has(task.key)) fail(`task key '${task.key}' is used twice`)
    for (const blockerKey of task.blockedBy ?? []) {
      const blocker = byKey.get(blockerKey)
      if (blocker === undefined)
        fail(`'${task.key}' is blocked by '${blockerKey}', which is not defined earlier`)
      if (task.lane !== 'todo' && blocker?.lane !== 'done') {
        fail(`'${task.key}' is past its first lane while '${blockerKey}' is not final`)
      }
    }
    const sprintState = task.sprint === undefined ? null : SPRINT_STATES[task.sprint - 1]
    if (sprintState === 'Completed' && task.lane !== 'done') {
      fail(`'${task.key}' is unfinished in a completed sprint`)
    }
    byKey.set(task.key, task)
  }

  for (const parent of scenario.parents) {
    const open = parent.tasks.some((task) => task.lane !== 'done')
    if (!parent.inLane && parent.tasks.length === 0)
      fail(`parent ${parent.idea} is past the lane with no tasks`)
    if (!parent.inLane && open && parent.tasks.filter((task) => task.lane !== 'done').length > 1) {
      fail(`parent ${parent.idea} is past the lane with several open tasks`)
    }
  }

  const topLevel = new Set<string>([
    ...scenario.parents.map((parent) => `opps:${parent.idea}`),
    ...scenario.cards.map((card) => `card:${card.key}`),
    ...Array.from({ length: 11 }, (_, i) => `ideas:${i}`),
    ...Array.from({ length: 11 }, (_, i) => `opps:${i}`),
  ])
  const grouped = new Set<string>()
  for (const outcome of scenario.outcomes) {
    if (outcome.endQuarter < outcome.startQuarter)
      fail(`outcome '${outcome.key}' ends before it starts`)
    for (const item of outcome.items) {
      if (!topLevel.has(item) || (item.startsWith('card:') && !byKey.has(item.slice(5)))) {
        fail(`outcome '${outcome.key}' names '${item}', which is not a top-level item`)
      }
      if (grouped.has(item)) fail(`'${item}' sits under two outcomes`)
      grouped.add(item)
    }
  }
  const metricKeys = new Set(scenario.metricTypes.map((type) => type.key))
  const valued = new Set<string>()
  for (const value of scenario.metricValues) {
    const id = `${value.item}|${value.metric}`
    if (!topLevel.has(value.item))
      fail(`metric value on '${value.item}', which is not a top-level item`)
    if (!metricKeys.has(value.metric)) fail(`unknown metric '${value.metric}'`)
    if (valued.has(id)) fail(`'${id}' is valued twice`)
    valued.add(id)
  }
  if (LANE_ORDER.length !== 4) fail('lane order changed')
}
