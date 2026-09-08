#!/usr/bin/env bash
# Compile the design-sync stylesheet: Tailwind over the design system's
# theme, its components, the authored previews and apps/web, plus the
# safelist in tailwind-entry.css. Output is what cfg.cssEntry points at.
#
# Run from the repo root. Requires .ds-sync/node_modules (staged by the
# design-sync skill: npm i @tailwindcss/cli@4.3.3 inside .ds-sync).
set -euo pipefail
cd "$(dirname "$0")/.."
out=packages/design-system/dist/collega.css
mkdir -p "$(dirname "$out")"
node .ds-sync/node_modules/@tailwindcss/cli/dist/index.mjs \
  --input .design-sync/tailwind-entry.css \
  --output "$out" \
  --optimize
echo "wrote $out ($(wc -c < "$out") bytes)"
