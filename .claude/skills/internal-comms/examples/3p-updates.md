# 3P updates — Progress, Plans, Problems

> **Provisional.** These conventions were written on 2026-09-07 to replace four guideline files
> `SKILL.md` referenced but that were never committed. They are sound general practice, **not
> verified house style.** Replace this file with the real convention when you have it, and delete
> this notice when you do.

## When to use

The default for any recurring update to people who are **not in the work**: leadership updates,
project updates, status reports, release notes aimed at a decision-maker rather than a changelog
reader.

Use it when the reader's question is *"where does this stand and what do I need to do about it?"*
Do not use it for a pure changelog — a reader who wants a list of changes wants Added / Changed /
Fixed, not narrative.

## Structure

Three sections, always in this order. The order is the point: what happened, what happens next, what
could go wrong. A reader who stops after the first section still has something true.

### Progress — what actually shipped
Completed work only. Something is not progress because effort went into it; it is progress because
it is done, or because a decision was made and now constrains later work. State cancellations here
too — a cancelled workstream is a real outcome and readers need it.

### Plans — what happens next, and in what order
Name the critical path and say what is blocked on what. If there is a gate — a condition that must
be true before the next thing can start — name it explicitly and say who holds it.

### Problems — what is at risk
The section people skip writing and never skip reading. Each item gets:

- **What it is**, in one sentence a non-participant can follow.
- **Standing** — accepted, open, fixed, being watched. An accepted risk is not a failure; say so.
- **What to watch** — the signal that tells the reader it is getting worse.

A problem with no "what to watch" is a complaint. Rank them: most consequential first.

## Tone

- **Count, don't quote.** Derive figures from the source — the repository, the dashboard, the
  ticket system — not from a status file that may itself be stale. Say where they came from.
- **Say what is unverified.** "Implemented but not fully verified" is more useful than "done", and
  keeps trust when it later reopens.
- **No vanity metrics.** A number earns its place only if a decision changes on it. Lines of code
  written is not progress; lines of code *remaining* might be.
- **Name the trade-off, not the blame.** "Chosen deliberately with the trade-off on the table" tells
  a reader more than either a defence or an apology.
- **Plain sentences.** No hedging stacks ("it seems like it may possibly"), no throat-clearing, no
  restating the reader's question back at them.

## Anti-patterns

| Don't | Do |
|---|---|
| "Great progress this sprint!" | Say what shipped. |
| Burying a cancellation in a bullet | Give it a row and a date. |
| A risk section that lists only solved risks | Lead with the unsolved one. |
| Figures pulled from last month's tracker | Count them fresh, and say so. |
| Framing an accepted risk as a problem | Mark it accepted and say who accepted it. |

## Worked example

`SPEC/`-adjacent, real: the Collega conversion report (2026-09-06) written for engineering
leadership. Its shape:

- **Three headline facts up front**, each a decision or a risk rather than an achievement — nothing
  deployed; 60,209 lines mid-rewrite; 447 test cases standing behind it.
- **Progress** — two closed sprints, one cancelled outright, and the conversion's eight waves as a
  dependency ladder, because the wave order carries information the reader needs.
- **Plans** — one critical path named, one gate named, and the first deployment placed after it.
- **Problems** — four, ranked. The top one is an *accepted* risk, explicitly chosen, with the
  precedent that makes it credible.

The figures were counted from the working tree rather than read from the project tracker —
which turned out to be two waves stale.
