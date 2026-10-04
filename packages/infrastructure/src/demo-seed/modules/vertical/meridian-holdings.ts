import type { DemoOrganizationScenario } from '../scenario.js'

export const MERIDIAN_HOLDINGS: DemoOrganizationScenario = {
  title: 'Meridian Holdings',
  slug: 'meridian-holdings',
  description:
    'Diversified corporation running Project Lighthouse, its company-wide business-improvement programme.',
  sprintGoal:
    'Cut invoice exception handling time by 30% and land the vendor consolidation business case before the Q4 steering committee.',
  accounts: [
    { firstName: 'Elena', lastName: 'Vasquez', localPart: 'orgadmin', role: 'OrgAdmin' },
    { firstName: 'Tomas', lastName: 'Reyes', localPart: 'user', role: 'User' },
    { firstName: 'Grace', lastName: 'Nakamura', localPart: 'user2', role: 'User' },
    { firstName: 'Henry', lastName: 'Osei', localPart: 'readonly', role: 'ReadOnly' },
  ],
  boards: [
    {
      name: 'Ideas',
      description:
        'Cross-department process fixes: procure-to-pay, hire-to-onboard, order-to-cash and month-end close.',
      focus: 'Process improvement',
      tagNames: ['procure-to-pay', 'month-end-close', 'onboarding', 'automation'],
      commentBodies: [
        'We saw the same exception pattern in the Q2 sample: roughly 40% of held invoices were quantity mismatches that a tolerance rule would clear. Can we pilot on the two highest-volume plants first?',
        'Agreed, start with the two plants. Please bring the tolerance thresholds to the finance controls review before we switch anything on.',
        'The offer-to-day-one handoff is where we lose people: new hires wait a median of four days for laptop and access. Worth timing it end to end before we design the fix.',
      ],
      checklists: [
        [
          { title: 'Baseline invoice exception volumes by plant', state: 'Done', assignee: 2 },
          { title: 'Agree match tolerances with finance controls', state: 'Done', assignee: 0 },
          { title: 'Configure matching rules in the AP tool', state: 'InProgress', assignee: 1 },
          { title: 'Run two-plant pilot and report results', state: 'NotStarted', assignee: null },
        ],
        [
          { title: 'Map the offer-to-day-one handoffs', state: 'Done', assignee: 2 },
          { title: 'Draft the single onboarding request form', state: 'InProgress', assignee: 1 },
          { title: 'Review the form with HR, IT and facilities', state: 'NotStarted', assignee: 0 },
        ],
      ],
      ideas: [
        {
          title: 'Three-way match automation for invoices',
          description:
            'Automatically match purchase order, goods receipt and invoice within agreed tolerances so clean invoices post without touch.',
          problem:
            'Accounts payable staff manually match about 62% of the 14,000 invoices received each month, and 18% of those sit in exception queues for an average of 6 days. Late payments cost roughly $85,000 a year in forfeited early-payment discounts.',
          proposedSolutions: [
            'Configure tolerance-based auto-matching (2% price, 5% quantity) in the existing AP tool',
            'Route only out-of-tolerance invoices to a buyer queue with the mismatch pre-labelled',
          ],
          impactRationale:
            'Auto-clearing an estimated 70% of current exceptions frees about 1,100 AP hours a year and cuts average invoice cycle time from 11 to 6 days. Recovered early-payment discounts are worth roughly $60,000 annually.',
        },
        {
          title: 'Single onboarding request for new hires',
          description:
            'Replace the separate HR, IT and facilities requests with one form that fans out to each team automatically.',
          problem:
            'A new hire currently triggers five separate requests across three teams, and 35% of starters are missing a laptop or system access on day one. Hiring managers spend about 3 hours each chasing status.',
          proposedSolutions: [
            'Build one onboarding form that creates the tickets for HR, IT and facilities',
            'Add a day-minus-five readiness check that flags any open item to the hiring manager',
          ],
          impactRationale:
            'Targeting day-one readiness above 95% removes an estimated 3 lost productive days per new hire. At 420 hires a year that is about 1,260 days recovered.',
        },
        {
          title: 'Standard purchase requisition templates',
          description:
            'Publish pre-approved requisition templates for the 20 most common categories so requesters stop starting from a blank form.',
          problem:
            'Free-text requisitions arrive with missing cost centres, vendors or specifications in roughly 27% of cases and bounce back an average of twice. Each bounce adds about 2 days to approval.',
          proposedSolutions: [
            'Create templates with mandatory fields for the top 20 spend categories',
            'Pre-fill preferred vendor and contract price from the catalogue',
          ],
          impactRationale:
            'Cutting rejected requisitions from 27% to under 8% saves about 2,400 buyer and requester hours a year and shortens requisition-to-PO time by around 2 days.',
        },
        {
          title: 'Automated month-end accrual postings',
          description:
            'Generate recurring accrual journals from approved schedules instead of keying them by hand each close.',
          problem:
            'Accountants key about 220 recurring accrual journals manually every month, with a 3% error rate that triggers reversal entries and late-close rework. This consumes roughly 90 hours of close time.',
          proposedSolutions: [
            'Load recurring accruals as templates that post on schedule with approval',
            'Add a variance check that flags any accrual moving more than 10% from the prior month',
          ],
          impactRationale:
            'Automating the recurring set saves about 70 close hours a month and reduces journal errors below 0.5%, supporting a one-day shorter close.',
        },
        {
          title: 'Purchase order approval thresholds redesign',
          description:
            'Rebase the approval limits on risk and category so low-risk spend stops queuing for senior sign-off.',
          problem:
            'Every PO above $2,500 needs a director signature, which puts 41% of POs into a queue with a median wait of 3.5 days. Directors approve 96% of what they see unchanged.',
          proposedSolutions: [
            'Raise limits to $10,000 for pre-contracted catalogue items',
            'Keep director approval for new vendors and off-contract spend',
          ],
          impactRationale:
            'Shifting about 30% of POs out of the director queue cuts median approval time from 3.5 to 1 day and returns roughly 500 director hours a year.',
        },
        {
          title: 'Supplier onboarding portal',
          description:
            'Let new suppliers submit banking, tax and compliance details themselves through a validated self-service portal.',
          problem:
            'Setting up a supplier takes 12 working days on average because details move by email and are re-keyed by procurement and AP. Bank detail errors caused 14 misdirected payments last year.',
          proposedSolutions: [
            'Launch a supplier-facing portal with field validation and document upload',
            'Verify bank details against a third-party check before activation',
          ],
          impactRationale:
            'Target setup time of 4 days and near-zero re-keying saves about 1,500 hours a year and removes the misdirected-payment risk, each incident costing about $9,000 to recover.',
        },
        {
          title: 'Order-to-cash dispute tracker',
          description:
            'Track customer invoice disputes in one shared queue with owners and ageing instead of scattered email threads.',
          problem:
            'Disputed invoices are handled across email by sales, billing and collections, and 22% are open for more than 45 days. Disputed balances inflate days sales outstanding by about 3 days.',
          proposedSolutions: [
            'Create a dispute queue with reason codes, owner and due date',
            'Report ageing weekly to the finance business partner for each division',
          ],
          impactRationale:
            'Closing disputes 40% faster reduces DSO by roughly 2 days, which releases about $6 million of working capital across the group.',
        },
        {
          title: 'Close calendar with task dependencies',
          description:
            'Replace the spreadsheet close checklist with a dependency-aware calendar that shows who is blocking whom.',
          problem:
            'The month-end close runs on a 140-line spreadsheet, and 25% of tasks start late because the predecessor was not visibly finished. Close takes 8 working days against a 5-day target.',
          proposedSolutions: [
            'Model task dependencies and notify the next owner on completion',
            'Publish a daily close dashboard to the controller',
          ],
          impactRationale:
            'Removing hand-off waits is expected to cut close from 8 to 6 days in the first quarter and about 40 hours of coordination effort per close.',
        },
        {
          title: 'Retire paper expense claims',
          description:
            'Move all expense claims to mobile receipt capture with policy checks at submission.',
          problem:
            'About 1,900 paper or emailed claims a month are keyed by shared services, with a 9% policy-breach rate found only after payment. Reimbursement takes a median of 17 days.',
          proposedSolutions: [
            'Roll out mobile receipt capture with automatic policy validation',
            'Pay approved claims in the next weekly run',
          ],
          impactRationale:
            'Eliminating re-keying saves around 1,800 hours a year, cuts reimbursement time to 5 days and prevents an estimated $120,000 a year in out-of-policy spend.',
        },
        {
          title: 'Standard job requisition workflow',
          description:
            'One approval route for new and backfill roles, replacing the mix of email and local forms used by each division.',
          problem:
            'Each division approves headcount differently, so requisitions take 19 days to reach recruiters and 12% are approved twice. Recruiters cannot report reliably on time-to-fill.',
          proposedSolutions: [
            'Adopt a single requisition workflow with budget check built in',
            'Auto-notify recruiting when approval completes',
          ],
          impactRationale:
            'Cutting approval to 7 days shortens time-to-fill by about 12 days and gives the programme a clean time-to-fill metric for the first time.',
        },
        {
          title: 'Intercompany reconciliation automation',
          description:
            'Match intercompany balances nightly so eliminations are ready on the first day of close.',
          problem:
            'Reconciling 38 legal entities takes the group accounting team about 4 days each month, and unmatched items of more than $50,000 were found after reporting in two of the last six months.',
          proposedSolutions: [
            'Run a nightly intercompany match with exception reporting by entity',
            'Require entity owners to clear exceptions by close day 2',
          ],
          impactRationale:
            'Moving reconciliation off the critical path saves roughly 3 close days of effort per month and removes late-found adjustments from the reporting pack.',
        },
      ],
    },
    {
      name: 'Opportunities',
      description:
        'Cost take-out, vendor consolidation, training, communications and adoption of new ways of working.',
      focus: 'Cost and change management',
      tagNames: ['cost-takeout', 'vendor-consolidation', 'training', 'adoption'],
      commentBodies: [
        'Procurement analytics shows 14 overlapping licence agreements for the same collaboration tools. A single negotiation could be worth more than the saving we have in the plan.',
        'Good find. Please add the renewal dates to the business case so we can sequence which contracts we can consolidate this year.',
        'Our change champions say managers hear about Lighthouse only at town halls. A short monthly manager briefing pack would give them something to repeat.',
      ],
      ideas: [
        {
          title: 'Consolidate regional software licenses',
          description:
            'Negotiate enterprise licence agreements to replace overlapping regional contracts for common software.',
          problem:
            'Regions buy the same collaboration, design and analytics tools under 14 separate contracts, and utilisation audits show 31% of seats unused. Annual licence spend on these tools is about $4.2 million.',
          proposedSolutions: [
            'Negotiate one enterprise agreement per tool and align renewal dates',
            'Reclaim inactive seats every quarter',
          ],
          impactRationale:
            'Volume pricing and removing idle seats are expected to save 18 to 22%, roughly $800,000 a year, with payback inside the first renewal cycle.',
        },
        {
          title: 'Reduce the preferred vendor list by half',
          description:
            'Cut the number of approved suppliers in each category to the strongest performers and concentrate spend with them.',
          problem:
            'Meridian buys from 3,400 active suppliers, and the top 200 hold only 58% of spend. Tail spend carries higher unit prices and about 2.5 times the invoice handling cost.',
          proposedSolutions: [
            'Segment categories and run competitive rounds to select two or three suppliers each',
            'Block new tail vendors without a business justification',
          ],
          impactRationale:
            'Consolidating tail spend typically yields 5 to 8% on affected categories, an estimated $2.4 million a year, plus lower supplier management effort.',
        },
        {
          title: 'Manager briefing pack for Lighthouse updates',
          description:
            'Send people managers a short monthly pack so they can explain programme changes to their own teams.',
          problem:
            'In the last pulse survey only 38% of employees said they understand what Project Lighthouse changes for them, and 61% said they heard about it from colleagues rather than their manager.',
          proposedSolutions: [
            'Publish a one-page monthly briefing with talking points and a short FAQ',
            'Hold a 20-minute manager call after each steering committee',
          ],
          impactRationale:
            'Raising understanding to 70% by year end is the biggest lever on adoption and is cheap, needing about 4 hours of PMO effort a month.',
        },
        {
          title: 'Travel booking policy and preferred rates',
          description:
            'Steer all travel through one booking tool with preferred hotel and airline rates and advance-booking rules.',
          problem:
            'About 45% of the $11 million travel budget is booked outside the corporate tool, at an average 17% premium. Bookings made under 7 days ahead cost 34% more than those made 21 days ahead.',
          proposedSolutions: [
            'Require booking through the corporate tool, with exceptions approved by the manager',
            'Negotiate preferred rates with the top five hotel and airline partners',
          ],
          impactRationale:
            'Bringing 85% of travel into policy is projected to save about $900,000 a year with minimal impact on travellers.',
        },
        {
          title: 'Lean yellow belt training for process owners',
          description:
            'Give every process owner a two-day yellow belt course so they can run small improvements themselves.',
          problem:
            'Only 22 of the 310 named process owners have any continuous-improvement training, so every improvement request is routed to the 6-person PMO and the backlog has reached 140 items.',
          proposedSolutions: [
            'Run two-day yellow belt cohorts of 25 people each quarter',
            'Pair each graduate with a PMO coach for their first improvement',
          ],
          impactRationale:
            'Training 300 owners at about $650 each should let teams close an estimated 120 small improvements a year, worth $1.5 million in avoided effort, and halve the PMO backlog.',
        },
        {
          title: 'Print and courier spend reduction',
          description:
            'Move statements, contracts and internal mail to digital delivery and retire unmanaged printers.',
          problem:
            'The group prints 9 million pages a year across 1,100 devices and spends $640,000 on courier services, mostly for documents that now have e-signature equivalents.',
          proposedSolutions: [
            'Default to e-signature and digital statements for new contracts',
            'Replace unmanaged printers with a managed print service',
          ],
          impactRationale:
            'Halving print volume and courier use saves about $420,000 a year and removes roughly 300 devices from the support estate.',
        },
        {
          title: 'Benefits tracking dashboard for Lighthouse',
          description:
            'Show validated savings by initiative and by month so the steering committee reviews one trusted number.',
          problem:
            'Savings are reported in four formats by four workstreams, and the finance team cannot reconcile $3.1 million of claimed benefits to the ledger. Steering committee papers take 20 hours to assemble.',
          proposedSolutions: [
            'Define one benefits definition with finance sign-off',
            'Build a dashboard fed from the initiative register and ledger actuals',
          ],
          impactRationale:
            'A single reconciled view saves about 15 PMO hours a month and gives executives confidence in a programme target of $38 million.',
        },
        {
          title: 'Change champion network in each division',
          description:
            'Appoint and support a champion per site to carry Lighthouse changes into daily work.',
          problem:
            'Adoption of the new request process varies from 85% in headquarters to 31% at smaller sites, with no local person responsible for follow-up.',
          proposedSolutions: [
            'Nominate one champion per site with 10% time allocation',
            'Run a monthly champions forum with the PMO',
          ],
          impactRationale:
            'Lifting low sites to 70% adoption is projected to deliver about $1.1 million of benefits that currently stall at handover.',
        },
        {
          title: 'Mobile device and telecom plan right-sizing',
          description:
            'Move mobile users onto plans that match actual use and cancel lines nobody uses.',
          problem:
            'Meridian pays for 7,800 mobile lines, 640 of which had no usage in the last 90 days, and 1,900 users are on plans with twice the data they consume.',
          proposedSolutions: [
            'Cancel inactive lines after a manager confirmation',
            'Re-tender the carrier contract on a pooled data plan',
          ],
          impactRationale:
            'Removing idle lines and pooling data saves roughly $530,000 a year, with the first $190,000 available within one billing cycle.',
        },
        {
          title: 'Standard operating procedure library',
          description:
            'Store current, owned procedures in one searchable library with a review date on each page.',
          problem:
            'Procedures live in team drives and email, and an audit found 47% were more than two years out of date. New starters spend about 6 hours searching for the right version in their first month.',
          proposedSolutions: [
            'Migrate the top 300 procedures into one library with named owners',
            'Flag anything past its review date to the owner automatically',
          ],
          impactRationale:
            'Having current procedures cuts onboarding search time by about 5 hours per starter and reduces repeat errors that rework estimates put at 1,000 hours a year.',
        },
        {
          title: 'Retire legacy reporting spreadsheets',
          description:
            'Replace the highest-effort manual spreadsheet reports with governed dashboards.',
          problem:
            'Finance and operations maintain around 260 recurring spreadsheet reports, and the top 40 take about 3,200 hours a year to refresh by hand. Version conflicts caused two board pack corrections last year.',
          proposedSolutions: [
            'Rebuild the top 40 reports as dashboards from a single data source',
            'Decommission replaced spreadsheets and publish the retirement list',
          ],
          impactRationale:
            'Automating the top 40 reports saves about 2,800 hours a year, worth roughly $190,000, and removes the version-control risk in board materials.',
        },
      ],
    },
  ],
}
