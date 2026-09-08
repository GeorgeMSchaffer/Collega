---
name: internal-comms
description: A set of resources to help me write all kinds of internal communications, using the formats that my company likes to use. Claude should use this skill whenever asked to write some sort of internal communications (status reports, leadership updates, 3P updates, company newsletters, FAQs, incident reports, project updates, etc.).
license: Complete terms in LICENSE.txt
---

## When to use this skill
To write internal communications, use this skill for:
- 3P updates (Progress, Plans, Problems)
- Company newsletters
- FAQ responses
- Status reports
- Leadership updates
- Project updates
- Incident reports

## How to use this skill

To write any internal communication:

1. **Identify the communication type** from the request.
2. **Read the matching guideline file** from `examples/`:
    - `examples/3p-updates.md` — Progress/Plans/Problems. **The default for any status or
      leadership update**, including release notes written for a decision-maker rather than a
      changelog reader.
    - `examples/company-newsletter.md` — company-wide newsletters
    - `examples/faq-answers.md` — answering frequently asked questions
    - `examples/general-comms.md` — announcements, decision records, incident reports, and anything
      else that doesn't match the above
3. **Follow that file's instructions** for structure, tone, and what to gather.

If the request matches no guideline, ask about the desired format before writing.

### If a guideline file is missing

**Say so in your reply, and name the file.** Do not silently substitute your own conventions — the
whole point of this skill is that the output matches house style, and an update written from
generic defaults while claiming to follow house style is worse than one that admits it didn't.

Between 2026-08-16 and 2026-09-07 this skill shipped with **no** `examples/` directory at all, while
`SKILL.md` named four files inside it. Every invocation in that window silently produced Claude's
defaults. That is the failure this section exists to prevent.

### Before writing

Gather the facts from the source, not from a summary. Counting from the repository, the dashboard,
or the ticket system beats quoting a tracker — trackers go stale, and a leadership update built on a
stale one is wrong in exactly the places that matter. Say in the piece where the figures came from.

### Delivering it

An internal comm has an audience, so it isn't finished sitting in a terminal or a local file.
Publish it — as an artifact, or through whatever document tool the team actually reads — and hand
over the link. Keep the same link when revising rather than publishing a second copy.

## Status of these guidelines

`examples/` was authored on **2026-09-07** and is **provisional**: it is sound general practice, not
verified company convention. The original files were referenced by this skill but never committed
(the skill was added in `8456a42` with `SKILL.md` alone).

Replace them with the real conventions when those surface, and delete the provisional notices at the
top of each file when you do.

## Keywords
3P updates, company newsletter, company comms, weekly update, faqs, common questions, updates, internal comms, release notes, leadership update, incident report
