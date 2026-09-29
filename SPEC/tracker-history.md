# Tracker history

Finished work moved out of [`SPEC/implementation-agent-tracker.md`](implementation-agent-tracker.md),
verbatim. The tracker holds what is active and next; this file indexes how finished work got
there. Older narrative history is in `SPEC/archive/implementation-agent-tracker-archive.md`.

## Reading and rotating this history

Open only the file you need. Each holds moved text verbatim, in the order it was moved.

- A newly finished Current Status row goes at the end of the table in the newest rows file; a
  newly finished narrative goes under the "Narratives" heading of the newest narratives file.
- A file stays at or under 40,000 bytes. When an addition would pass that, start a new file named
  `SPEC/tracker-history/<YYYY-MM-DD>-rows-part-<N>.md` (or `-narratives-part-<N>.md`) for the date of
  its first entry and the next free part number,
  repeat the table header or the heading, and add a line to the index below.

## Index

Newest first.

| File | Holds |
|---|---|
| [`2026-09-28-narratives.md`](tracker-history/2026-09-28-narratives.md) | "Narratives": Sprint 5 through Sprint 7.5, and the 2026-09-12 Application QA pass. **Newest narratives file** |
| [`2026-09-28-rows-part-2.md`](tracker-history/2026-09-28-rows-part-2.md) | "Current Status rows, moved", continued: e2e harness and Local DB, then slices 093–118. **Newest rows file**, and nearly full: the next row starts a new file |
| [`2026-09-28-rows-part-1.md`](tracker-history/2026-09-28-rows-part-1.md) | "Current Status rows, moved": the 2026-09-13 re-derivation notes, then MVP epics, Sprint 9 and the conversion, Deployment, Authentication hardening, Schema drift, Branch inventory, Issues & Delivery, and the other rows moved 2026-09-28 |
