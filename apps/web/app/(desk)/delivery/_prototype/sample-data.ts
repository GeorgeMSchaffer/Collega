/**
 * ============================================================================
 *  INVENTED DATA. NOT A RECORDING. NOT FROM THE API.
 * ============================================================================
 *
 * Every other screen in this app is drawn from the golden corpus — 447 responses recorded
 * from the live .NET API — and where nothing was recorded the mock answers 501 and the screen
 * says so. This file is the single, deliberate exception.
 *
 * Delivery (`SPEC/20-feature-issues-and-delivery.md`) is specified but was never built, so it
 * is not among the 81 recorded endpoints; `GET /api/mock/coverage` will confirm that. The
 * delivery screens are a **design prototype** built so the shape can be reviewed before the
 * feature exists, and the numbers, names, dates and sentences below were written by hand for
 * that review. They describe nothing that ever happened.
 *
 * Rules this file exists to keep honest, and which the screens above it obey:
 *
 *  1. **No delivery screen calls `/api/v1/*` for delivery data.** Wiring these screens to the
 *     mock would imply recordings exist. There are none, and none may be added.
 *  2. **Everything invented lives here.** One module, one import site per screen, so deleting
 *     this file and following the compile errors is the whole removal when the real endpoints
 *     land.
 *  3. **Every export is prefixed `SAMPLE_`** so an invented value cannot be mistaken for a
 *     recorded one at its use site.
 *  4. **Rollups are derived, never stored** — `SPEC/20-feature-issues-and-delivery.md` requires
 *     it of the real feature, and deriving them here is what makes the roadmap's arithmetic
 *     demonstrably a partition rather than four typed-in numbers that happen to add up.
 *
 * The organization is unnamed on purpose. The desk's sidebar shows the *recorded* organization,
 * and giving these issues a company would set an invented name beside a real one.
 */

export const SAMPLE_DELIVERY_STATUSES = [
  "Pending",
  "Scoping",
  "Development",
  "Review",
  "Complete",
] as const;
export type SampleDeliveryStatus = (typeof SAMPLE_DELIVERY_STATUSES)[number];

export const SAMPLE_EFFORTS = ["Low", "Medium", "High"] as const;
export type SampleEffort = (typeof SAMPLE_EFFORTS)[number];

export const SAMPLE_TASK_STATES = ["Not started", "In progress", "Done"] as const;
export type SampleTaskState = (typeof SAMPLE_TASK_STATES)[number];

export type SampleSprintState = "Planned" | "Active" | "Completed";

/**
 * Colours, only ever drawn beside the name they belong to.
 *
 * `SPEC/decisions.md` 2026-08-31 forbids colour carrying meaning alone, and the Blazor board
 * broke that rule twice. Every dot in these screens goes through `Marker`, which writes the
 * label next to it; strip the colour out and each one still reads.
 */
export const SAMPLE_STATUS_COLORS: Record<SampleDeliveryStatus, string | null> = {
  Pending: null,
  Scoping: "var(--purple)",
  Development: "var(--sky)",
  Review: "var(--pink)",
  Complete: "var(--green)",
};

export const SAMPLE_EFFORT_COLORS: Record<SampleEffort, string | null> = {
  Low: null,
  Medium: "var(--teal)",
  High: "var(--orange)",
};

export const SAMPLE_SPRINT_STATE_COLORS: Record<SampleSprintState, string | null> = {
  Planned: null,
  Active: "var(--green)",
  Completed: "var(--ink-muted)",
};

export interface SampleSprint {
  readonly sprintId: string;
  readonly name: string;
  readonly goal: string;
  /** ISO dates. A sprint boxes the dates; the spec drops per-issue start/end deliberately. */
  readonly startDate: string;
  readonly endDate: string;
  readonly owner: string | null;
  readonly state: SampleSprintState;
}

export interface SampleOutcome {
  readonly outcomeId: string;
  readonly name: string;
  readonly description: string;
  readonly targetStartDate: string;
  readonly targetEndDate: string;
  readonly owner: string | null;
  readonly color: string;
}

export interface SampleTask {
  readonly taskId: string;
  readonly title: string;
  readonly state: SampleTaskState;
  readonly assignee: string | null;
  /** Set only while the task is `Done`, mirroring the spec's `CompletedAtUtc` stamp. */
  readonly completedOn: string | null;
}

export interface SampleComment {
  readonly commentId: string;
  readonly author: string;
  readonly on: string;
  readonly body: string;
}

export interface SampleIssue {
  /** The human key the comps show on every card. Also this prototype's route segment. */
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly deliveryStatus: SampleDeliveryStatus;
  readonly effort: SampleEffort;
  /** Null is the delivery backlog. */
  readonly sprintId: string | null;
  /** Single-parent, per `SPEC/decisions.md` 2026-09-02. Null is ungrouped. */
  readonly outcomeId: string | null;
  readonly assignees: readonly string[];
  readonly tasks: readonly SampleTask[];
  readonly comments: readonly SampleComment[];

  // Provenance. In the real feature none of this is retyped — the Issue *is* the Idea — which
  // is the differentiator the spec says ships in this slice.
  readonly author: string;
  readonly raisedOn: string;
  readonly upvotes: number;
  readonly upvotesAtPromotion: number;
  readonly promotedBy: string;
  readonly promotedOn: string;
  readonly ideaType: string;
  readonly businessImpact: string;
  /** Frozen at its last Discovery value; promotion never clears it. */
  readonly ideaStatus: string;
  readonly tags: readonly string[];
}

export const SAMPLE_SPRINTS: readonly SampleSprint[] = [
  {
    sprintId: "sp-11",
    name: "Sprint 11",
    goal: "Get a reporting extract out of the warehouse and in front of Ops.",
    startDate: "2026-07-21",
    endDate: "2026-08-04",
    owner: "Olivia Administer",
    state: "Completed",
  },
  {
    sprintId: "sp-12",
    name: "Sprint 12",
    goal: "Cut weekly reporting effort in half.",
    startDate: "2026-08-18",
    endDate: "2026-09-01",
    owner: "Olivia Administer",
    state: "Active",
  },
  {
    sprintId: "sp-13",
    name: "Sprint 13",
    goal: "Make the review path measurably faster end to end.",
    startDate: "2026-09-01",
    endDate: "2026-09-15",
    owner: "Olivia Administer",
    state: "Planned",
  },
  {
    sprintId: "sp-14",
    name: "Sprint 14",
    goal: "Agree what a review owes the person waiting on it.",
    startDate: "2026-10-06",
    endDate: "2026-10-20",
    owner: "Maya Collaborator",
    state: "Planned",
  },
  {
    sprintId: "sp-15",
    name: "Sprint 15",
    goal: "One intake form, used everywhere.",
    startDate: "2027-01-12",
    endDate: "2027-01-26",
    owner: null,
    state: "Planned",
  },
  {
    sprintId: "sp-16",
    name: "Sprint 16",
    goal: "Switch the legacy exporter off for good.",
    startDate: "2027-04-13",
    endDate: "2027-04-27",
    owner: null,
    state: "Planned",
  },
];

export const SAMPLE_OUTCOMES: readonly SampleOutcome[] = [
  {
    outcomeId: "oc-report",
    name: "Cut reporting effort",
    description:
      "Nobody rebuilds the weekly summary by hand. The number to beat is three hours per coordinator per week.",
    targetStartDate: "2026-07-01",
    targetEndDate: "2026-09-30",
    owner: "Olivia Administer",
    color: "var(--sky)",
  },
  {
    outcomeId: "oc-review",
    name: "Make review predictable",
    description: "A reviewer knows what is expected of them, and the person waiting knows when.",
    targetStartDate: "2026-09-01",
    targetEndDate: "2026-12-31",
    owner: "Maya Collaborator",
    color: "var(--teal)",
  },
  {
    outcomeId: "oc-intake",
    name: "Standardize intake",
    description: "One way in, whichever team you are. Everything after it gets simpler.",
    targetStartDate: "2026-10-01",
    targetEndDate: "2027-03-31",
    owner: "Olivia Administer",
    color: "var(--green)",
  },
  {
    outcomeId: "oc-legacy",
    name: "Retire legacy steps",
    description: "Every manual step the automation replaced is switched off rather than left running.",
    targetStartDate: "2027-01-01",
    targetEndDate: "2027-06-30",
    owner: null,
    color: "var(--orange)",
  },
];

export const SAMPLE_ISSUES: readonly SampleIssue[] = [
  {
    key: "CLG-114",
    title: "Automate weekly reporting",
    description:
      "Coordinators rebuild the same weekly summary by hand every Friday. Generating it from the data we already hold removes roughly three hours a week and the transcription errors that come with it.",
    deliveryStatus: "Development",
    effort: "Medium",
    sprintId: "sp-12",
    outcomeId: "oc-report",
    assignees: ["Marcus Green", "Olivia Administer"],
    tasks: [
      {
        taskId: "t-114-1",
        title: "Agree the report’s column set with Ops",
        state: "Done",
        assignee: "Marcus Green",
        completedOn: "2026-08-24",
      },
      {
        taskId: "t-114-2",
        title: "Build the extract query",
        state: "Done",
        assignee: "Marcus Green",
        completedOn: "2026-08-26",
      },
      {
        taskId: "t-114-3",
        title: "Schedule the Friday 06:00 run",
        state: "Done",
        assignee: "Olivia Administer",
        completedOn: "2026-08-28",
      },
      {
        taskId: "t-114-4",
        title: "Handle the empty-week edge case",
        state: "In progress",
        assignee: "Marcus Green",
        completedOn: null,
      },
      {
        taskId: "t-114-5",
        title: "Write the one-page runbook",
        state: "Not started",
        assignee: null,
        completedOn: null,
      },
    ],
    comments: [
      {
        commentId: "c-114-1",
        author: "Marcus Green",
        on: "2026-07-14",
        body: "Three hours every Friday, every coordinator. If we generate it from what we already store, the errors go too.",
      },
      {
        commentId: "c-114-2",
        author: "Maya Collaborator",
        on: "2026-07-16",
        body: "Ops will want the same column set they have now, at least for the first quarter. Worth agreeing that before anything is built.",
      },
      {
        commentId: "c-114-3",
        author: "Olivia Administer",
        on: "2026-08-18",
        body: "Promoting this — 14 votes and a clear scope. Marcus, it’s yours.",
      },
    ],
    author: "Marcus Green",
    raisedOn: "2026-07-14",
    upvotes: 17,
    upvotesAtPromotion: 14,
    promotedBy: "Olivia Administer",
    promotedOn: "2026-08-18",
    ideaType: "Process Revision",
    businessImpact: "High",
    ideaStatus: "In Progress",
    tags: ["quality", "reporting"],
  },
  {
    key: "CLG-116",
    title: "Add proactive alerts",
    description:
      "The report tells you what went wrong after the week is over. An alert on the same thresholds tells someone while it can still be fixed.",
    deliveryStatus: "Development",
    effort: "Medium",
    sprintId: "sp-12",
    outcomeId: "oc-report",
    assignees: ["Noah Contributor"],
    tasks: [
      {
        taskId: "t-116-1",
        title: "Pick the two thresholds worth waking someone for",
        state: "Done",
        assignee: "Noah Contributor",
        completedOn: "2026-08-25",
      },
      {
        taskId: "t-116-2",
        title: "Wire the notification writer",
        state: "Done",
        assignee: "Noah Contributor",
        completedOn: "2026-08-27",
      },
      {
        taskId: "t-116-3",
        title: "Add the per-user mute",
        state: "In progress",
        assignee: "Noah Contributor",
        completedOn: null,
      },
      {
        taskId: "t-116-4",
        title: "Check nothing fires on a quiet week",
        state: "Not started",
        assignee: null,
        completedOn: null,
      },
    ],
    comments: [
      {
        commentId: "c-116-1",
        author: "Noah Contributor",
        on: "2026-07-29",
        body: "A weekly report is a post-mortem. Two thresholds and a message would stop most of what it reports.",
      },
    ],
    author: "Noah Contributor",
    raisedOn: "2026-07-29",
    upvotes: 11,
    upvotesAtPromotion: 9,
    promotedBy: "Olivia Administer",
    promotedOn: "2026-08-18",
    ideaType: "Process Revision",
    businessImpact: "Medium",
    ideaStatus: "In Progress",
    tags: ["reporting"],
  },
  {
    key: "CLG-118",
    title: "Retire the legacy export step",
    description:
      "The nightly CSV drop predates the warehouse and nothing downstream reads it any more. Leaving it running is a job that can fail at 02:00 for no reason.",
    deliveryStatus: "Pending",
    effort: "Low",
    sprintId: "sp-12",
    outcomeId: "oc-legacy",
    assignees: ["Noah Contributor"],
    tasks: [
      {
        taskId: "t-118-1",
        title: "Confirm no consumer still reads the drop",
        state: "Not started",
        assignee: "Noah Contributor",
        completedOn: null,
      },
      {
        taskId: "t-118-2",
        title: "Disable the schedule and keep the code for one quarter",
        state: "Not started",
        assignee: null,
        completedOn: null,
      },
    ],
    comments: [],
    author: "Umar Mensah",
    raisedOn: "2026-08-02",
    upvotes: 6,
    upvotesAtPromotion: 5,
    promotedBy: "Olivia Administer",
    promotedOn: "2026-08-18",
    ideaType: "Technical Debt",
    businessImpact: "Low",
    ideaStatus: "Approved",
    tags: ["cleanup"],
  },
  {
    key: "CLG-121",
    title: "Standardize the intake checklist",
    description:
      "Three teams take requests in three shapes, so the first thing anyone does is ask for the fields the other team did not collect.",
    deliveryStatus: "Scoping",
    effort: "High",
    sprintId: "sp-12",
    outcomeId: "oc-intake",
    assignees: ["Marcus Green"],
    tasks: [
      {
        taskId: "t-121-1",
        title: "Collect the three checklists as they stand today",
        state: "Done",
        assignee: "Marcus Green",
        completedOn: "2026-08-22",
      },
      {
        taskId: "t-121-2",
        title: "Find the fields all three already share",
        state: "In progress",
        assignee: "Marcus Green",
        completedOn: null,
      },
      {
        taskId: "t-121-3",
        title: "Agree the contested four with each team lead",
        state: "Not started",
        assignee: null,
        completedOn: null,
      },
      {
        taskId: "t-121-4",
        title: "Write the single checklist",
        state: "Not started",
        assignee: null,
        completedOn: null,
      },
      {
        taskId: "t-121-5",
        title: "Pilot it with one team for a fortnight",
        state: "Not started",
        assignee: null,
        completedOn: null,
      },
    ],
    comments: [
      {
        commentId: "c-121-1",
        author: "Maya Collaborator",
        on: "2026-06-30",
        body: "Worth saying out loud that the goal is one checklist, not three that agree. Three that agree drift apart again by March.",
      },
    ],
    author: "Maya Collaborator",
    raisedOn: "2026-06-28",
    upvotes: 19,
    upvotesAtPromotion: 16,
    promotedBy: "Olivia Administer",
    promotedOn: "2026-08-18",
    ideaType: "Process Revision",
    businessImpact: "High",
    ideaStatus: "In Progress",
    tags: ["intake", "quality"],
  },
  {
    key: "CLG-109",
    title: "Create a shared playbook",
    description:
      "The answers to the twelve questions a new reviewer asks are in six people's heads. Writing them down once is cheaper than answering them forever.",
    deliveryStatus: "Review",
    effort: "High",
    sprintId: "sp-12",
    outcomeId: "oc-review",
    assignees: ["Olivia Administer"],
    tasks: [
      {
        taskId: "t-109-1",
        title: "List the questions new reviewers actually ask",
        state: "Done",
        assignee: "Olivia Administer",
        completedOn: "2026-08-20",
      },
      {
        taskId: "t-109-2",
        title: "Draft an answer for each",
        state: "Done",
        assignee: "Olivia Administer",
        completedOn: "2026-08-24",
      },
      {
        taskId: "t-109-3",
        title: "Have two reviewers try it cold",
        state: "Done",
        assignee: "Maya Collaborator",
        completedOn: "2026-08-27",
      },
      {
        taskId: "t-109-4",
        title: "Publish and link it from the review screen",
        state: "Done",
        assignee: "Olivia Administer",
        completedOn: "2026-08-29",
      },
    ],
    comments: [],
    author: "Olivia Administer",
    raisedOn: "2026-06-11",
    upvotes: 22,
    upvotesAtPromotion: 20,
    promotedBy: "Olivia Administer",
    promotedOn: "2026-08-18",
    ideaType: "Documentation",
    businessImpact: "Medium",
    ideaStatus: "In Progress",
    tags: ["review", "onboarding"],
  },
  {
    key: "CLG-120",
    title: "Document the alert thresholds",
    description:
      "Whoever gets paged at 02:00 needs to know what the number means and what to do about it, on one page.",
    deliveryStatus: "Complete",
    effort: "Low",
    sprintId: "sp-12",
    outcomeId: "oc-report",
    assignees: ["Noah Contributor"],
    tasks: [
      {
        taskId: "t-120-1",
        title: "Write down what each threshold means",
        state: "Done",
        assignee: "Noah Contributor",
        completedOn: "2026-08-21",
      },
      {
        taskId: "t-120-2",
        title: "Add the first response for each",
        state: "Done",
        assignee: "Noah Contributor",
        completedOn: "2026-08-23",
      },
      {
        taskId: "t-120-3",
        title: "Link it from the alert body",
        state: "Done",
        assignee: "Marcus Green",
        completedOn: "2026-08-26",
      },
    ],
    comments: [],
    author: "Noah Contributor",
    raisedOn: "2026-08-04",
    upvotes: 5,
    upvotesAtPromotion: 4,
    promotedBy: "Olivia Administer",
    promotedOn: "2026-08-18",
    ideaType: "Documentation",
    businessImpact: "Low",
    ideaStatus: "Approved",
    tags: ["reporting"],
  },
  {
    key: "CLG-104",
    title: "Publish the reporting extract",
    description:
      "Everything about the weekly summary depends on the numbers being reachable from one place. This was that place.",
    deliveryStatus: "Complete",
    effort: "Medium",
    sprintId: "sp-11",
    outcomeId: "oc-report",
    assignees: ["Marcus Green"],
    tasks: [
      {
        taskId: "t-104-1",
        title: "Model the extract",
        state: "Done",
        assignee: "Marcus Green",
        completedOn: "2026-07-24",
      },
      {
        taskId: "t-104-2",
        title: "Backfill twelve months",
        state: "Done",
        assignee: "Marcus Green",
        completedOn: "2026-07-30",
      },
    ],
    comments: [],
    author: "Marcus Green",
    raisedOn: "2026-06-02",
    upvotes: 13,
    upvotesAtPromotion: 13,
    promotedBy: "Olivia Administer",
    promotedOn: "2026-07-20",
    ideaType: "Process Revision",
    businessImpact: "High",
    ideaStatus: "Complete",
    tags: ["reporting"],
  },
  {
    key: "CLG-127",
    title: "Pilot a faster review path",
    description:
      "A small change waits the same nine days as a large one. One team tries a shorter path for a fortnight and we measure both.",
    deliveryStatus: "Pending",
    effort: "High",
    sprintId: "sp-13",
    outcomeId: "oc-review",
    assignees: ["Maya Collaborator"],
    tasks: [
      {
        taskId: "t-127-1",
        title: "Define what counts as a small change",
        state: "Not started",
        assignee: "Maya Collaborator",
        completedOn: null,
      },
      {
        taskId: "t-127-2",
        title: "Pick the team and the fortnight",
        state: "Not started",
        assignee: null,
        completedOn: null,
      },
      {
        taskId: "t-127-3",
        title: "Agree what we measure before we start",
        state: "Not started",
        assignee: null,
        completedOn: null,
      },
    ],
    comments: [],
    author: "Maya Collaborator",
    raisedOn: "2026-08-11",
    upvotes: 21,
    upvotesAtPromotion: 18,
    promotedBy: "Olivia Administer",
    promotedOn: "2026-08-29",
    ideaType: "Process Revision",
    businessImpact: "High",
    ideaStatus: "Approved",
    tags: ["review"],
  },
  {
    key: "CLG-136",
    title: "Agree the review SLA",
    description:
      "A number both sides accept, published, so “it is taking too long” becomes a fact rather than a mood.",
    deliveryStatus: "Pending",
    effort: "Medium",
    sprintId: "sp-14",
    outcomeId: "oc-review",
    assignees: [],
    tasks: [],
    comments: [],
    author: "Umar Mensah",
    raisedOn: "2026-08-19",
    upvotes: 8,
    upvotesAtPromotion: 7,
    promotedBy: "Olivia Administer",
    promotedOn: "2026-08-30",
    ideaType: "Process Revision",
    businessImpact: "Medium",
    ideaStatus: "Approved",
    tags: ["review"],
  },
  {
    key: "CLG-137",
    title: "Draft the intake form",
    description: "The single checklist, as something a person can actually fill in.",
    deliveryStatus: "Pending",
    effort: "Low",
    sprintId: "sp-14",
    outcomeId: "oc-intake",
    assignees: [],
    tasks: [],
    comments: [],
    author: "Marcus Green",
    raisedOn: "2026-08-20",
    upvotes: 7,
    upvotesAtPromotion: 6,
    promotedBy: "Olivia Administer",
    promotedOn: "2026-08-30",
    ideaType: "Process Revision",
    businessImpact: "Medium",
    ideaStatus: "Approved",
    tags: ["intake"],
  },
  {
    key: "CLG-140",
    title: "Roll the intake form out",
    description: "All three teams on the one form, with the old routes closed rather than merely discouraged.",
    deliveryStatus: "Pending",
    effort: "Medium",
    sprintId: "sp-15",
    outcomeId: "oc-intake",
    assignees: [],
    tasks: [],
    comments: [],
    author: "Maya Collaborator",
    raisedOn: "2026-08-24",
    upvotes: 6,
    upvotesAtPromotion: 6,
    promotedBy: "Olivia Administer",
    promotedOn: "2026-08-31",
    ideaType: "Process Revision",
    businessImpact: "Medium",
    ideaStatus: "Approved",
    tags: ["intake"],
  },
  {
    key: "CLG-142",
    title: "Delete the legacy exporter",
    description:
      "Once the drop has been off for a quarter with nobody noticing, the code goes too. Kept until then so switching it back on is one commit.",
    deliveryStatus: "Pending",
    effort: "High",
    sprintId: "sp-16",
    outcomeId: "oc-legacy",
    assignees: [],
    tasks: [],
    comments: [],
    author: "Umar Mensah",
    raisedOn: "2026-08-26",
    upvotes: 4,
    upvotesAtPromotion: 4,
    promotedBy: "Olivia Administer",
    promotedOn: "2026-08-31",
    ideaType: "Technical Debt",
    businessImpact: "Low",
    ideaStatus: "Approved",
    tags: ["cleanup"],
  },
  {
    key: "CLG-130",
    title: "Validate the customer feedback loop",
    description:
      "We ask for feedback and then nothing visibly happens to it. Closing that loop is most of why people stop giving it.",
    deliveryStatus: "Pending",
    effort: "Medium",
    sprintId: null,
    outcomeId: "oc-review",
    assignees: [],
    tasks: [],
    comments: [],
    author: "Noah Contributor",
    raisedOn: "2026-08-06",
    upvotes: 12,
    upvotesAtPromotion: 11,
    promotedBy: "Olivia Administer",
    promotedOn: "2026-08-29",
    ideaType: "Process Revision",
    businessImpact: "Medium",
    ideaStatus: "Approved",
    tags: ["feedback"],
  },
  {
    key: "CLG-122",
    title: "Reduce manual handoffs",
    description:
      "Four of the seven steps exist only to tell the next person the previous step finished.",
    deliveryStatus: "Pending",
    effort: "Low",
    sprintId: null,
    outcomeId: null,
    assignees: [],
    tasks: [],
    comments: [],
    author: "Umar Mensah",
    raisedOn: "2026-07-31",
    upvotes: 9,
    upvotesAtPromotion: 8,
    promotedBy: "Olivia Administer",
    promotedOn: "2026-08-29",
    ideaType: "Process Revision",
    businessImpact: "Medium",
    ideaStatus: "Approved",
    tags: ["workflow"],
  },
  {
    key: "CLG-125",
    title: "Improve exception visibility",
    description: "When something is stuck, nobody finds out until someone asks after it.",
    deliveryStatus: "Pending",
    effort: "Medium",
    sprintId: null,
    outcomeId: null,
    assignees: [],
    tasks: [],
    comments: [],
    author: "Noah Contributor",
    raisedOn: "2026-08-03",
    upvotes: 6,
    upvotesAtPromotion: 6,
    promotedBy: "Olivia Administer",
    promotedOn: "2026-08-29",
    ideaType: "Process Revision",
    businessImpact: "Medium",
    ideaStatus: "Approved",
    tags: ["workflow"],
  },
  {
    key: "CLG-131",
    title: "Roll out the proven workflow",
    description: "The pilot team's workflow, given to the other two, once the pilot has actually proven it.",
    deliveryStatus: "Pending",
    effort: "Low",
    sprintId: null,
    outcomeId: "oc-review",
    assignees: [],
    tasks: [],
    comments: [],
    author: "Maya Collaborator",
    raisedOn: "2026-08-09",
    upvotes: 4,
    upvotesAtPromotion: 4,
    promotedBy: "Olivia Administer",
    promotedOn: "2026-08-29",
    ideaType: "Process Revision",
    businessImpact: "Low",
    ideaStatus: "Approved",
    tags: ["workflow"],
  },
];

/** The sprint the board opens on: the one that is running. */
export const SAMPLE_ACTIVE_SPRINT_ID = "sp-12";
/** The sprint the backlog plans into: the next one that has not started. */
export const SAMPLE_NEXT_PLANNED_SPRINT_ID = "sp-13";

/** Today, for this prototype. Fixed so a screenshot taken next month still reads the same. */
export const SAMPLE_TODAY = "2026-08-28";

// ---------------------------------------------------------------------------
// Derivations. Nothing below is stored — the spec requires every roadmap rollup to be
// computed at read time, and computing them here is what makes the arithmetic checkable.
// ---------------------------------------------------------------------------

export function sampleSprint(sprintId: string | null): SampleSprint | null {
  return SAMPLE_SPRINTS.find((sprint) => sprint.sprintId === sprintId) ?? null;
}

export function sampleOutcome(outcomeId: string | null): SampleOutcome | null {
  return SAMPLE_OUTCOMES.find((outcome) => outcome.outcomeId === outcomeId) ?? null;
}

export function sampleIssue(key: string): SampleIssue | null {
  return SAMPLE_ISSUES.find((issue) => issue.key === key) ?? null;
}

export function sampleTaskRollup(issue: SampleIssue): { done: number; total: number } {
  return {
    done: issue.tasks.filter((task) => task.state === "Done").length,
    total: issue.tasks.length,
  };
}

/** `Q3 2026` for a sprint's start date. The bucket the roadmap's quarter axis uses. */
export function sampleQuarterOf(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`;
}

/** Human window for a sprint or an outcome — "18 Aug – 1 Sep 2026". */
const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function sampleDate(isoDate: string): string {
  return DAY_MONTH_YEAR.format(new Date(`${isoDate}T00:00:00Z`));
}

export function sampleWindow(startIso: string, endIso: string): string {
  return `${DAY_MONTH.format(new Date(`${startIso}T00:00:00Z`))} – ${sampleDate(endIso)}`;
}

/** Whole days from `SAMPLE_TODAY` to the sprint's end, floored at zero. */
export function sampleDaysLeft(sprint: SampleSprint): number {
  const end = Date.parse(`${sprint.endDate}T00:00:00Z`);
  const today = Date.parse(`${SAMPLE_TODAY}T00:00:00Z`);
  return Math.max(0, Math.round((end - today) / 86_400_000));
}
