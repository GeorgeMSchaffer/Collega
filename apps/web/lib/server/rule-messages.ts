/**
 * The plain-language rule behind each Board References refusal.
 *
 * A `422` from the API carries the rule's key as its `detail` (`laneInUse`) and no message, so a
 * screen that shows `detail` as it arrives shows a camel-case word to the person who tripped the
 * rule. Where comp U or comp T gives wording, it is used here; the rest is the rule stated plainly.
 * An unknown key is shown as it came, which is no worse than before.
 */
const RULE_MESSAGES: Readonly<Record<string, string>> = {
  laneReferencesOwnBoard: 'A lane can’t reference its own board.',
  referenceChainNotAllowed: 'Only one level of references is allowed.',
  laneInUse:
    'A lane with ideas in it can’t have its reference changed or removed, and can’t be removed.',
  referenceTargetArchived: 'A board that a lane references can’t be archived.',
  referencesBoardInvalid: 'A lane can reference only an active board of this organization.',
  finalLaneCannotReference: 'A Final lane can’t reference a board.',
  autoCreateTaskRequiresReference: 'Auto-create needs a referenced board.',
  keyPrefixLocked: 'Keys have been issued on this board, so the prefix can’t change.',
  parentNotInReferenceLane:
    'A task can only be added while the idea is in the lane that references that board.',
  parentIsTask: 'A task can’t have tasks of its own.',
  referencedBoardArchived: 'That board is archived, so tasks can’t be added to it.',
  noDefaultIdeaType: 'The organization has no default Idea Type, so a task can’t be created yet.',
  noDefaultBusinessImpact:
    'The organization has no default Business Impact, so a task can’t be created yet.',
  effortRequiredInReferenceLane:
    'Effort can be changed but not cleared while the idea is in a lane that references a board.',
}

/**
 * What a refusal can say about the card it refused. The API sends the rule's key and no message, so
 * a sentence that names the card or counts its open tasks needs the caller's own figures; without
 * them the sentence is the rule stated plainly.
 */
export type RuleContext = {
  title?: string
  openTasks?: number
  blockers?: number
  /** `remove` when the refused write was Remove from board; a move otherwise. */
  action?: 'move' | 'remove'
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

/** Sentences that name the card, composed here from the key and what the caller knows. */
const CONTEXTUAL: Readonly<Record<string, (context: RuleContext) => string>> = {
  // `contracts/ideas.md`, decided 2026-10-16.
  parentHasOpenTasks: ({ title, openTasks, action }) => {
    const what = action === 'remove' ? 'removed from the board' : 'moved'
    if (title === undefined || openTasks === undefined) {
      return `This card is waiting on open tasks, so it cannot be ${what}.`
    }
    return `‘${title}’ is waiting on ${plural(openTasks, 'open task')}, so it cannot be ${what}.`
  },
  // Comp U screen 6 frame B, COPY PROPOSED there.
  taskBlocked: ({ title, blockers }) => {
    if (title === undefined || blockers === undefined) {
      return 'This task is blocked, so it cannot leave its first lane.'
    }
    return `‘${title}’ is blocked by ${plural(blockers, 'open task')}, so it cannot leave its first lane.`
  },
  effortRequiredForReferenceLane: ({ title }) =>
    title === undefined ? 'Add Effort first.' : `Add Effort to ‘${title}’ first.`,
}

export function ruleMessage(detail: string, context: RuleContext = {}): string {
  const contextual = CONTEXTUAL[detail]
  return contextual ? contextual(context) : (RULE_MESSAGES[detail] ?? detail)
}

/** The key prefix rule, in comp U frame E's words. */
export const KEY_PREFIX_RULE = 'Use 2 to 10 letters or digits, A to Z and 0 to 9.'
