/**
 * The shot list, and the only place the deck's narrative lives.
 *
 * `capture.ts` reads it to drive the browser; `deck.ts` reads it to build the HTML deck. Adding a
 * screenshot means adding an entry here and nothing else — the two consumers stay in step because
 * neither holds its own copy of the order, the captions or the file names.
 *
 * `as` names the seeded account the shot is taken through (see `demo.md`), which is what makes the
 * three role-contrast shots legible: the same board, photographed from three permission levels.
 * `route` is the URL that screen actually lives at — the deck shows it, because "which screen is
 * this?" is the first question a demo audience asks and the second one is "can I link to it?".
 */

export interface Shot {
  /** Stable handle: the anchor in the deck, and what `capture.ts` names each shot by. */
  readonly id: string
  readonly file: string
  readonly title: string
  readonly caption: string
  /** The route the screen lives at, as the deck prints it. */
  readonly route: string
  /** The seeded account it was taken through. */
  readonly as: string
}

export const SHOTS: readonly Shot[] = [
  {
    id: 'sign-in',
    file: '01-sign-in.png',
    title: 'One account, scoped to one organization',
    caption:
      'Sign-in is the whole front door. An account belongs to exactly one organization, and every board, idea and person it can reach is inside that boundary — there is no workspace switcher to get wrong.',
    route: '/login',
    as: 'anonymous',
  },
  {
    id: 'boards',
    file: '02-boards.png',
    title: 'Boards organize the same ideas different ways',
    caption:
      'An organization defines its own boards, and each one picks its own lanes from the organization’s status catalog. The counts are live: two boards, eleven ideas apiece, twenty-two in the organization.',
    route: '/boards',
    as: 'Org Admin',
  },
  {
    id: 'board-kanban',
    file: '03-board-kanban.png',
    title: 'The board is the workflow',
    caption:
      'Lanes come from the board’s own status list, not a fixed set. A card carries its priority, tags, assignee and vote count; the arrows move it one lane at a time and each move saves immediately, so the board always shows what the server holds.',
    route: '/boards/:boardId',
    as: 'Org Admin',
  },
  {
    id: 'board-kanban-right',
    file: '04-board-kanban-complete.png',
    title: 'Through to Complete',
    caption:
      'The same board, scrolled to its right-hand lanes. Client Review and Complete are ordinary statuses the organization configured — a team that works differently configures different ones.',
    route: '/boards/:boardId',
    as: 'Org Admin',
  },
  {
    id: 'new-idea',
    file: '05-new-idea.png',
    title: 'Raising an idea takes five fields',
    caption:
      'Title, description, priority, idea type and business impact. Idea type and business impact are per-organization catalogs, so the vocabulary on this form is the organization’s own — and the new idea lands in the board’s left-most lane.',
    route: '/boards/:boardId',
    as: 'Org Admin',
  },
  {
    id: 'ideas-list',
    file: '06-ideas-list.png',
    title: 'Every idea in the organization, one list',
    caption:
      'The list view crosses boards: title, board, status, priority, assignee and votes, newest first. It is the view for triage — the board view is for working.',
    route: '/ideas',
    as: 'Org Admin',
  },
  {
    id: 'idea-inspector',
    file: '07-idea-inspector.png',
    title: 'Open an idea without losing the list',
    caption:
      'The inspector opens beside the list rather than over it, and its URL is addressable — a link to an idea opens the list with that idea already open. Classification, votes, tags and assignee all read from the same record.',
    route: '/ideas/:ideaId',
    as: 'Org Admin',
  },
  {
    id: 'discussion',
    file: '08-discussion.png',
    title: 'The conversation stays attached to the idea',
    caption:
      'Comments live on the idea, not in a thread somewhere else, and an @mention resolves against the organization’s members. Three people, one record, no context to reassemble later.',
    route: '/ideas/:ideaId',
    as: 'User (Noah)',
  },
  {
    id: 'palette',
    file: '09-command-palette.png',
    title: 'Keyboard-first navigation',
    caption:
      'Ctrl K from anywhere; arrow keys and Enter navigate. It jumps between surfaces today and is where idea search lands next.',
    route: 'Ctrl K · any route',
    as: 'Org Admin',
  },
  {
    id: 'role-user',
    file: '10-role-user.png',
    title: 'Same board, seen as a contributor',
    caption:
      'A plain User raises ideas, votes and comments. Whether they may move a card between lanes is the board’s own setting, not their role — so one board can let contributors drive the workflow while another keeps it with administrators.',
    route: '/boards/:boardId',
    as: 'User (Noah)',
  },
  {
    id: 'role-readonly',
    file: '11-role-readonly.png',
    title: 'Same board, seen read-only',
    caption:
      'A Read Only account still sees everything and can still upvote — engagement is not authorship. The refusal is shown rather than hidden: “New idea” stays visible, disabled, and says why.',
    route: '/boards/:boardId',
    as: 'Read Only (Rosa)',
  },
]
