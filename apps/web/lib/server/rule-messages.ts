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
}

export function ruleMessage(detail: string): string {
  return RULE_MESSAGES[detail] ?? detail
}

/** The key prefix rule, in comp U frame E's words. */
export const KEY_PREFIX_RULE = 'Use 2 to 10 letters or digits, A to Z and 0 to 9.'
