# Golden replay

Read `README.md` before running the capture/replay harness. It runs on Node's type stripping with
no build step or runtime dependencies.

The replay is a regression signal, not a gate or the specification. The recorded corpus and
`inventory.json` are frozen and cannot be re-recorded. For each difference, choose to fix it,
accept and record it, or deliberately do better; consult the canonical contract in `SPEC/` rather
than treating a diff as a defect.
