# tools/golden

The capture/replay harness. `README.md` here is the operating manual — commands, the corpus, how
replay works. Read it before running anything.

- The replay is a **signal, not a gate**. A failing or unrunnable replay does not block a merge, a
  cutover, or a slice. `pnpm check` is the gate (`SPEC/decisions.md` 2026-09-11).
- The corpus is a **regression detector, not the specification**.
- Every difference gets one of three answers: fix it, accept and record it, or deliberately do
  better. A difference is a question, not automatically a defect.
- The recorded corpus and `inventory.json` are frozen; the recording cannot be made again.

The harness runs on Node's own type stripping — no build step, no runtime dependencies. Keep it
that way.
