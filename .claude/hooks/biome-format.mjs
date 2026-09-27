// PostToolUse hook: format and safe-fix the file just edited, so `pnpm check` doesn't fail on style.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8'));
const filePath = input.tool_input?.file_path;
if (!filePath || !/\.tsx?$/.test(filePath)) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd;
// biome.json's `files.includes` decides what is in scope; anything outside it is skipped quietly.
spawnSync(
  process.execPath,
  [
    join(root, 'node_modules/@biomejs/biome/bin/biome'),
    'check',
    '--write',
    '--no-errors-on-unmatched',
    '--files-ignore-unknown=true',
    filePath,
  ],
  { cwd: root, stdio: 'ignore' },
);
