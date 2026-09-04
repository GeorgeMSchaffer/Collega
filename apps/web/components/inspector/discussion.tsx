"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
  AvatarFallback,
  Button,
  DeniedAction,
  ForRoles,
  Label,
  Separator,
  Textarea,
} from "@collega/design-system";
import * as React from "react";

import { CorpusNote } from "@/components/desk/notices";
import { useWrite } from "@/components/inspector/use-write";
import { REFUSALS } from "@/components/inspector/refusals";
import { useApi, pathWasSubstituted } from "@/lib/api";
import { daysAgo, initialsOf } from "@/lib/format";
import type { IdeaComment, Member, Paged, UpvoteResult } from "@/lib/types";

/**
 * The engagement half of the inspector: the upvote control, the discussion, and the composer.
 *
 * **Two endpoints, two different holes, and they are not the same hole.**
 * `GET /ideas/{ideaId}/comments` was recorded against exactly one idea, so for every other
 * idea the mock answers with that idea's thread. Rendering it would attribute two people's
 * words to the wrong idea, which is worse than showing nothing, so the thread is drawn only
 * when the recording is of *this* idea and the recorded comment count stands in otherwise.
 * `POST /ideas/{ideaId}/upvote/toggle` has the same shape of hole with a subtler cost: its
 * recording always answers `hasUpvoted: true` with a fixed count, so adopting its numbers
 * would show another idea's tally and would make un-voting look broken. The optimistic value
 * is kept instead, and the substitution is named on screen.
 *
 * Refusals here are real product behaviour and are the point of walking the roles: a Read Only
 * account votes and comments (`comments.create.readonly` is a recorded 201), and a Site Admin
 * can do neither, because a vote and a comment are a member's acts.
 */

const COMMENT_MAX = 2000;

function Vote({
  ideaId,
  count,
  mine,
  onChange,
}: {
  ideaId: string;
  count: number;
  mine: boolean;
  onChange: (next: { count: number; mine: boolean }) => void;
}) {
  const toggle = useWrite<UpvoteResult>(`/ideas/${ideaId}/upvote/toggle`);
  const [substituted, setSubstituted] = React.useState(false);

  const press = async () => {
    const before = { count, mine };
    const optimistic = { count: mine ? count - 1 : count + 1, mine: !mine };
    onChange(optimistic);

    const result = await toggle.run();
    if (!result) {
      onChange(before);
      return;
    }
    // Only an exact recording is this idea's own tally; anything else is another idea's.
    if (result.exact && result.data) {
      onChange({ count: result.data.upvoteCount, mine: result.data.hasUpvoted });
    } else {
      setSubstituted(true);
    }
  };

  const label = `Upvote this idea — ${count} ${count === 1 ? "vote" : "votes"}`;

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <ForRoles roles={["OrgAdmin", "User", "ReadOnly"]}>
          <Button
            type="button"
            variant={mine ? "default" : "outline"}
            size="sm"
            aria-pressed={mine}
            aria-label={label}
            onClick={() => void press()}
          >
            <span aria-hidden="true">▲</span>
            <span className="tabular-nums">{count}</span>
            {/* The pressed state is not left to the fill: the word is there too. */}
            <span className="text-xs font-normal">{mine ? "Voted" : "Vote"}</span>
          </Button>
        </ForRoles>
        <ForRoles roles={["SiteAdmin"]}>
          {/* 20-feature-ideas-and-engagement.md, Upvotes 1: a static count for a Site Admin,
              who is not a member of the organization and votes through View As. */}
          <DeniedAction reason={REFUSALS.siteAdminVote}>
            {(denied) => (
              <Button type="button" variant="outline" size="sm" aria-label={label} {...denied}>
                <span aria-hidden="true">▲</span>
                <span className="tabular-nums">{count}</span>
                <span className="text-xs font-normal">Vote</span>
              </Button>
            )}
          </DeniedAction>
        </ForRoles>
      </div>

      {toggle.error ? (
        <Alert variant={toggle.error.isRefusal ? "warning" : "destructive"} className="mt-2">
          <AlertTitle>{toggle.error.problem?.title ?? "The vote was not recorded"}</AlertTitle>
          <AlertDescription>
            {toggle.error.problem?.detail ?? "Nothing changed; the count above is unchanged."}
          </AlertDescription>
        </Alert>
      ) : null}

      {substituted ? (
        <CorpusNote className="mt-2">
          the toggle endpoint was recorded against one other idea, and its recording always
          answers with that idea&rsquo;s tally. The count above is this idea&rsquo;s recorded
          count with your vote applied, not a number the API returned.
        </CorpusNote>
      ) : null}
    </div>
  );
}

function CommentRow({ comment, members }: { comment: IdeaComment; members: readonly Member[] }) {
  const author = members.find((member) => member.userId === comment.authorUserId);
  const name = author ? `${author.firstName} ${author.lastName}` : "Unknown user";

  return (
    <li className="flex gap-3">
      <Avatar className="mt-0.5">
        <AvatarFallback>{initialsOf(author?.firstName ?? null, author?.lastName ?? null)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm">
          <span className="font-medium">{name}</span>{" "}
          <span className="text-xs text-muted-foreground">{daysAgo(comment.createdAtUtc)}</span>
        </p>
        {/* Plain text with line breaks preserved — MVP bodies are never rich content. */}
        <p className="m-0 mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{comment.body}</p>
      </div>
    </li>
  );
}

function Composer({ ideaId }: { ideaId: string }) {
  const [body, setBody] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const post = useWrite<{ commentId: string }>(`/ideas/${ideaId}/comments`);
  const fieldId = React.useId();

  const trimmed = body.trim();
  const tooLong = body.length > COMMENT_MAX;
  const error = touched && trimmed.length === 0 ? "A comment cannot be empty." : tooLong ? `Comments are limited to ${COMMENT_MAX} characters.` : null;

  const submit = async () => {
    // The button carries `disabled` while a post is in flight; the Ctrl+Enter path does not go
    // through the button, so the guard lives here, where both routes meet.
    if (post.state === "running") return;
    setTouched(true);
    // Client-side, and deliberately: the corpus holds the recorded 400 for an empty body under
    // the `invalid` case kind, which the mock only serves when it is asked for by name. Posting
    // an empty comment here would come back 201 and teach the wrong lesson.
    if (trimmed.length === 0 || tooLong) return;
    const result = await post.run({ body: { body: trimmed } });
    if (result) {
      setBody("");
      setTouched(false);
    }
  };

  return (
    <form
      className="mt-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Label htmlFor={fieldId}>Add a comment</Label>
      <Textarea
        id={fieldId}
        value={body}
        rows={3}
        aria-invalid={error !== null || undefined}
        aria-describedby={error ? `${fieldId}-error` : `${fieldId}-hint`}
        placeholder="Plain text, line breaks allowed."
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          // A textarea has to keep Enter for the line breaks the spec allows, so the
          // keyboard submit is the conventional modifier chord and the hint below says so.
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void submit();
          }
        }}
      />
      <div className="mt-1 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {error ? (
            <p id={`${fieldId}-error`} className="m-0 text-xs text-destructive">
              {error}
            </p>
          ) : (
            <p id={`${fieldId}-hint`} className="m-0 text-xs text-muted-foreground">
              Ctrl or ⌘ with Enter posts it.
            </p>
          )}
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {body.length} / {COMMENT_MAX}
        </span>
      </div>

      <Button type="submit" size="sm" className="mt-2" disabled={post.state === "running"}>
        {post.state === "running" ? "Posting…" : "Post comment"}
      </Button>

      {post.error ? (
        <Alert variant={post.error.isRefusal ? "warning" : "destructive"} className="mt-2">
          <AlertTitle>{post.error.problem?.title ?? "The comment was not posted"}</AlertTitle>
          <AlertDescription>{post.error.problem?.detail ?? "Nothing was saved. Retrying is safe."}</AlertDescription>
        </Alert>
      ) : null}

      {post.state === "done" ? (
        <CorpusNote className="mt-2">
          the API accepted the comment
          {post.outcome?.data?.commentId ? ` as ${post.outcome.data.commentId}` : ""}. A recording is not a
          database, so the thread above is unchanged — the round trip is real, the persistence is not.
        </CorpusNote>
      ) : null}
    </form>
  );
}

export function Discussion({
  ideaId,
  commentCount,
  upvoteCount,
  hasUpvoted,
  members,
}: {
  ideaId: string;
  commentCount: number;
  upvoteCount: number;
  hasUpvoted: boolean;
  members: readonly Member[];
}) {
  const [votes, setVotes] = React.useState({ count: upvoteCount, mine: hasUpvoted });
  const comments = useApi<Paged<IdeaComment>>(`/ideas/${ideaId}/comments`);

  const isThisIdea = comments.state === "ready" && !pathWasSubstituted(comments.mock);
  const items = isThisIdea ? (comments.data?.items ?? []) : [];

  return (
    <section aria-labelledby={`discussion-${ideaId}`}>
      <Separator className="mb-4" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id={`discussion-${ideaId}`} className="m-0 text-sm font-semibold">
          Discussion
          <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">{commentCount}</span>
        </h3>
        <Vote ideaId={ideaId} count={votes.count} mine={votes.mine} onChange={setVotes} />
      </div>

      {comments.state === "error" ? (
        comments.error?.isRefusal ? (
          <Alert variant="warning" className="mt-3">
            <AlertTitle>{comments.error.problem?.title ?? "The discussion is not readable"}</AlertTitle>
            <AlertDescription>{comments.error.problem?.detail}</AlertDescription>
          </Alert>
        ) : (
          <CorpusNote className="mt-3">
            the discussion could not be read: {comments.error?.message}
          </CorpusNote>
        )
      ) : null}

      {isThisIdea && items.length > 0 ? (
        <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
          {items.map((comment) => (
            <CommentRow key={comment.commentId} comment={comment} members={members} />
          ))}
        </ul>
      ) : null}

      {isThisIdea && items.length === 0 ? (
        <p className="m-0 mt-3 text-sm text-muted-foreground">No comments yet.</p>
      ) : null}

      {comments.state === "ready" && !isThisIdea ? (
        <CorpusNote className="mt-3">
          the discussion endpoint was recorded against one idea only, and this is not it. The
          capture says this idea carries {commentCount} {commentCount === 1 ? "comment" : "comments"};
          showing the recorded thread here would put another idea&rsquo;s words under this title, so it
          is left out.
        </CorpusNote>
      ) : null}

      {isThisIdea && items.length !== commentCount ? (
        <CorpusNote className="mt-3">
          the thread above holds {items.length} {items.length === 1 ? "comment" : "comments"} and the
          list row counts {commentCount}. Both are real recordings, captured at different points in the
          same run — the capture added comments after it read the list.
        </CorpusNote>
      ) : null}

      <ForRoles roles={["OrgAdmin", "User", "ReadOnly"]}>
        <Composer ideaId={ideaId} />
      </ForRoles>
      <ForRoles roles={["SiteAdmin"]}>
        <div className="mt-4">
          <DeniedAction reason={REFUSALS.siteAdminComment}>
            {(denied) => (
              <Button type="button" size="sm" {...denied}>
                Add a comment
              </Button>
            )}
          </DeniedAction>
        </div>
      </ForRoles>
    </section>
  );
}
