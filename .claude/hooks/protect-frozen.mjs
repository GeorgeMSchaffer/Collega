// PreToolUse hook: edits to files that AGENTS.md declares frozen or read-only need a human yes.
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

const FROZEN = [
  [/(^|\/)\.env(\.|$)(?!example$)/, 'holds secrets'],
  [/(^|\/)pnpm-lock\.yaml$/, 'is written by pnpm install, not by hand'],
  [/^tools\/golden\//, 'is the frozen golden corpus — it cannot be re-recorded'],
  [/^packages\/infrastructure\/prisma\/schema\.prisma$/, 'is the Prisma schema, frozen at S0.2'],
  [/^SPEC\/30-Contracts\.md$/, 'is read, not edited, by API slices'],
];

const input = JSON.parse(readFileSync(0, 'utf8'));
const filePath = input.tool_input?.file_path;
if (!filePath) process.exit(0);

const rel = relative(input.cwd ?? process.cwd(), filePath).replaceAll('\\', '/');
const hit = FROZEN.find(([pattern]) => pattern.test(rel));
if (!hit) process.exit(0);

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: `${rel} ${hit[1]} (AGENTS.md). Confirm this edit is intended.`,
    },
  }),
);
