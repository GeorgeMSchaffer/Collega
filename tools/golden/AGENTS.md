# tools/golden

The Wave A capture/replay harness. `README.md` here is the operating manual — commands, the corpus,
how capture and replay work. Read it before running anything.

**One thing in that README is superseded.** It describes the corpus as the conversion's oracle, and
on 2026-09-11 `SPEC/decisions.md` decided it is not:

- The replay is a **signal, not a gate**. A failing or unrunnable replay does not block a merge, a
  cutover, or a slice. `pnpm check` is the gate.
- The corpus is a **regression detector, not the specification**. The .NET app it recorded was never
  finished, so byte-fidelity to it was never the goal.
- Every difference gets one of three answers: fix it, accept and record it, or deliberately do
  better. A difference is a question, not automatically a defect.
- Deleting the .NET solution in slice **F6** is no longer chained to "once F1 replays clean".

Re-capture only while the .NET API still exists, and only if it changes. Once cutover deletes the
solution the recording cannot be made again.

The harness runs on Node's own type stripping — no build step, no runtime dependencies. Keep it
that way.
