'use client'

import { Button, cn, Denied } from '@collega/design-system'
import {
  type KeyboardEvent,
  useActionState,
  useEffect,
  useId,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from 'react'
import { Icon } from '@/components/list/icons'
import { type ActionState, addComment, setFollowing, toggleUpvote } from '@/lib/server/idea-actions'
import type { MentionCandidate } from '@/lib/types'

const IDLE: ActionState = { error: null }

/**
 * `CreateCommentRequest.Body`'s limit, transcribed because the constant lives in `@collega/domain`.
 * The API enforces it either way; this only stops the browser letting someone type past it.
 */
const BODY_MAX_LENGTH = 2000

/**
 * The drawer's upvote control.
 *
 * Engagement and editing are gated separately on purpose: a Read Only account may vote and comment
 * but not edit, and a Site Admin may do none of it — not a member of the organization. `denial` is
 * `engagementDenial(role)`, never the write denial, or Read Only silently loses its vote.
 *
 * A denied vote stays a reachable control with its reason beside it (`Denied`), outside any form:
 * `aria-disabled` marks a control without inerting it, so inside the form it would still submit.
 */
export function UpvoteButton({
  ideaId,
  boardId,
  count,
  hasUpvoted,
  denial,
}: {
  ideaId: string
  boardId: string | null
  count: number
  hasUpvoted: boolean
  denial: string | null
}) {
  const [state, vote, voting] = useActionState(toggleUpvote, IDLE)

  if (denial) {
    return (
      <Denied reason={denial} id="why-upvote">
        <Button
          variant="outline"
          size="sm"
          aria-disabled="true"
          aria-describedby="why-upvote"
          aria-label={`Upvote this idea, currently ${count} votes`}
        >
          <span aria-hidden="true">▲</span> {count}
        </Button>
      </Denied>
    )
  }

  return (
    <form action={vote} className="inline-flex items-center gap-2">
      <input type="hidden" name="boardId" value={boardId ?? ''} />
      <input type="hidden" name="ideaId" value={ideaId} />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={voting}
        aria-pressed={hasUpvoted}
        aria-label={`${hasUpvoted ? 'Remove your upvote from' : 'Upvote'} this idea, currently ${count} votes`}
        className={cn(hasUpvoted && 'border-primary text-primary')}
      >
        <span aria-hidden="true">▲</span> {count}
      </Button>
      {state.error ? (
        <span role="status" className="text-xs font-medium text-destructive">
          {state.error}
        </span>
      ) : null}
    </form>
  )
}

const followers = (n: number) => `${n} ${n === 1 ? 'person follows' : 'people follow'} this idea`

/**
 * The Follow / Following toggle (`20-feature-idea-following.md` rules 45–46).
 *
 * Saves at once, with no confirmation: the new state and count show immediately and fall back to
 * the detail's on a refusal, with the API's message beside the control. `denial` is
 * `followDenial(role)` — Read Only follows; only a Site Admin acting as themselves is refused.
 */
export function FollowButton({
  ideaId,
  boardId,
  isFollowing,
  followerCount,
  denial,
}: {
  ideaId: string
  boardId: string | null
  isFollowing: boolean
  followerCount: number
  denial: string | null
}) {
  const countId = useId()
  const [state, setState] = useOptimistic({ isFollowing, followerCount })
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  if (denial) {
    return (
      <Denied reason={denial} id={`why-follow-${ideaId}`}>
        <Button
          variant="outline"
          size="sm"
          aria-disabled="true"
          aria-describedby={`why-follow-${ideaId}`}
        >
          <Icon name="bell" />
          Follow · {followerCount}
          <span className="sr-only">, {followers(followerCount)}</span>
        </Button>
      </Denied>
    )
  }

  const toggle = () => {
    const follow = !state.isFollowing
    setError(null)
    startTransition(async () => {
      setState({ isFollowing: follow, followerCount: state.followerCount + (follow ? 1 : -1) })
      const result = await setFollowing(ideaId, boardId ?? '', follow)
      setError(result.error)
    })
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        aria-pressed={state.isFollowing}
        aria-describedby={countId}
        onClick={toggle}
        className={cn(state.isFollowing && 'border-foreground/60 bg-muted text-foreground')}
      >
        <Icon name={state.isFollowing ? 'check' : 'bell'} />
        {state.isFollowing ? 'Following' : 'Follow'} · {state.followerCount}
      </Button>
      <span id={countId} className="sr-only">
        {followers(state.followerCount)}
      </span>
      {error ? (
        <span role="status" className="text-xs font-medium text-destructive">
          {error}
        </span>
      ) : null}
    </span>
  )
}

/** How many people the @ picker lists at once. */
const MENTION_OPTIONS_MAX = 8

/**
 * The `@query` the caret sits at the end of: an `@` at the start or after whitespace, followed by
 * at most 40 characters with no line break, second `@` or double space. Null otherwise.
 */
function mentionAt(body: string, caret: number): { start: number; query: string } | null {
  const before = body.slice(0, caret)
  const at = before.lastIndexOf('@')
  if (at < 0 || (at > 0 && !/\s/.test(before[at - 1] ?? ''))) return null
  const query = before.slice(at + 1)
  if (query.length > 40 || /[\n@]/.test(query) || /\s\s/.test(query)) return null
  return { start: at, query }
}

/**
 * The comment composer, with its `0 / 2000` counter and an @ picker over the organization's
 * members.
 *
 * The textarea is **controlled**, so the counter reads `body.length` and a refused comment survives
 * the reset React performs when an action resolves. Clearing it is therefore explicit, on
 * `state !== IDLE` — "an action has resolved" — with no error.
 *
 * Typing `@` offers members by name or email; choosing one writes `@Name` into the text and
 * remembers the address. Only people whose `@Name` is still in the text when it posts are sent as
 * `mentionEmails`, so deleting the token un-mentions them. The member list is read once, on the
 * first `@`, from `ideas/mention-candidates`.
 */
export function CommentBox({
  ideaId,
  boardId,
  denial,
}: {
  ideaId: string
  boardId: string | null
  denial: string | null
}) {
  const [state, post, posting] = useActionState(addComment, IDLE)
  const [body, setBody] = useState('')
  const [chosen, setChosen] = useState<readonly MentionCandidate[]>([])
  const [candidates, setCandidates] = useState<readonly MentionCandidate[] | null>(null)
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null)
  const [active, setActive] = useState(0)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const loading = useRef(false)
  const listId = useId()
  const optionId = (index: number) => `${listId}-${index}`

  useEffect(() => {
    if (state !== IDLE && state.error === null) {
      setBody('')
      setChosen([])
    }
  }, [state])

  useEffect(() => {
    if (mention === null || candidates !== null || loading.current) return
    loading.current = true
    fetch('/ideas/mention-candidates', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : []))
      .then((list: MentionCandidate[]) => setCandidates(list))
      // Mentioning is optional; a failed read leaves the composer a plain textarea.
      .catch(() => setCandidates([]))
  }, [mention, candidates])

  if (denial) {
    return (
      <p className="m-0 text-xs italic text-muted-foreground">
        {denial} — use View as&hellip; to comment as a member.
      </p>
    )
  }

  const query = mention?.query.toLowerCase() ?? ''
  const options =
    mention === null || candidates === null
      ? []
      : candidates
          .filter(
            (person) =>
              person.name.toLowerCase().includes(query) ||
              person.email.toLowerCase().includes(query),
          )
          .slice(0, MENTION_OPTIONS_MAX)
  const expanded = options.length > 0
  const mentionEmails = chosen
    .filter((person) => body.includes(`@${person.name}`))
    .map((person) => person.email)

  const track = (element: HTMLTextAreaElement) => {
    setMention(mentionAt(element.value, element.selectionStart))
    setActive(0)
  }

  const choose = (person: MentionCandidate) => {
    if (mention === null) return
    const end = mention.start + 1 + mention.query.length
    const token = `@${person.name} `
    const next = body.slice(0, mention.start) + token + body.slice(end)
    const caret = mention.start + token.length
    setBody(next)
    setChosen((list) => (list.some((p) => p.id === person.id) ? list : [...list, person]))
    setMention(null)
    requestAnimationFrame(() => textarea.current?.setSelectionRange(caret, caret))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!expanded) return
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActive((active + 1) % options.length)
        break
      case 'ArrowUp':
        event.preventDefault()
        setActive(active <= 0 ? options.length - 1 : active - 1)
        break
      case 'Enter':
      case 'Tab': {
        const person = options[active]
        if (person) {
          event.preventDefault()
          choose(person)
        }
        break
      }
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        setMention(null)
        break
    }
  }

  return (
    <form action={post} className="flex flex-col gap-2">
      <input type="hidden" name="ideaId" value={ideaId} />
      <input type="hidden" name="boardId" value={boardId ?? ''} />
      {mentionEmails.map((email) => (
        <input key={email} type="hidden" name="mentionEmails" value={email} />
      ))}
      <label htmlFor="comment" className="sr-only">
        Add a comment
      </label>
      <div className="relative">
        <textarea
          ref={textarea}
          id="comment"
          name="body"
          rows={2}
          maxLength={BODY_MAX_LENGTH}
          required
          placeholder="Add a comment… Type @ to mention someone"
          className="w-full"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded ? optionId(active) : undefined}
          value={body}
          onChange={(event) => {
            setBody(event.target.value)
            track(event.target)
          }}
          onSelect={(event) => {
            const next = mentionAt(event.currentTarget.value, event.currentTarget.selectionStart)
            if (next?.start !== mention?.start || next?.query !== mention?.query) {
              setMention(next)
              setActive(0)
            }
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setMention(null)}
        />
        <div
          id={listId}
          role="listbox"
          aria-label="People to mention"
          hidden={!expanded}
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md"
        >
          {options.map((person, index) => (
            // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/useFocusableInteractive: focus stays in the textarea, which carries every key (aria-activedescendant).
            <div
              key={person.id}
              id={optionId(index)}
              role="option"
              aria-selected={index === active}
              // Keeps focus in the textarea, so its blur does not close the list first.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(person)}
              onMouseEnter={() => setActive(index)}
              className={`flex cursor-pointer items-baseline gap-2 rounded-sm px-2 py-1.5 ${
                index === active ? 'bg-muted' : ''
              }`}
            >
              <span>{person.name}</span>
              <span className="text-xs text-muted-foreground">{person.email}</span>
            </div>
          ))}
        </div>
      </div>
      {state.error ? (
        <p className="m-0 text-xs font-medium text-destructive" role="status">
          {state.error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button size="sm" type="submit" disabled={posting}>
          {posting ? 'Posting…' : 'Comment'}
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground">
          {body.length} / {BODY_MAX_LENGTH}
        </span>
      </div>
    </form>
  )
}
