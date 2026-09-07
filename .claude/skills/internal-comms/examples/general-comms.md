# General internal comms

> **Provisional.** Written 2026-09-07 to replace a guideline file `SKILL.md` referenced but that was
> never committed. Sound general practice, **not verified house style.** Replace when you have the
> real convention.

## When to use

The fallback for anything that is not a 3P update, a newsletter, or an FAQ: announcements, decision
records, incident reports, migration notices, deprecation warnings, "here is a thing that changed
and how it affects you".

If the piece is recurring and status-shaped, use `3p-updates.md` instead.

## The one rule that matters

**Lead with the consequence for the reader, not the history of the work.**

Most internal comms open with how we got here and bury what changes. Invert it. The first sentence
says what is different and for whom; the background goes after, for the readers who need it.

> Not: "Following several weeks of investigation into our authentication layer, the team evaluated
> a number of approaches and has now concluded…"
>
> But: "Sessions now expire after 12 hours instead of 30 days. You will sign in more often. Here is
> why we changed it."

## Structure

Short pieces need no headings. Longer ones take four moves, in order:

1. **What changed** — one paragraph, no preamble.
2. **Who it affects, and how** — be specific about which teams, which systems, which day.
3. **What you need to do** — an action, a date, or an explicit "nothing".
4. **Why** — the reasoning, for readers who want it. Last, not first.

## Incident reports

Same shape, with two additions that are not optional:

- **Timeline in absolute times with a zone.** "This morning" is unusable a week later.
- **What we learned, separated from what we changed.** A fix is not a lesson, and a lesson with no
  fix is worth writing down anyway.

Write incidents without blame and without euphemism. "The cache served a stale pass and the gate
enforced nothing for two commits" is a better sentence than either "an issue occurred" or "someone
forgot to".

## Tone

- Active voice. Name the actor when there is one, including when it is us.
- Dates absolute, never relative — "6 September", not "last Friday".
- Say the uncomfortable part plainly and early. A reader who finds it in paragraph nine trusts the
  first eight less.
- No apology padding. One sentence of regret is credible; three is a performance.
- If something is genuinely undecided, say it is undecided and name who decides.

## Anti-patterns

| Don't | Do |
|---|---|
| "We wanted to reach out to let you know…" | Say the thing. |
| Relative dates | Absolute dates, with a year if it could be ambiguous. |
| Passive voice hiding the actor | Name who did what. |
| Burying the action item at the bottom | Put it in the first three lines. |
| "Minor change" as a framing device | Let the reader judge the size. |
