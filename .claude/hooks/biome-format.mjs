// PostToolUse hook: format and safe-fix the file just edited, so `pnpm check` doesn't fail on style.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8'));
const filePath = input.tool_input?.file_path;
if (!filePath || !/\.tsx?$/.test(filePath)) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? input.cwd;
const BIOME = 'node_modules/@biomejs/biome/bin/biome';

// The checkout the file lives in — a worktree has its own biome.json, and its `files.includes`
// only matches paths relative to it.
let root = dirname(filePath);
while (!existsSync(join(root, 'biome.json')) && dirname(root) !== root) root = dirname(root);
if (!existsSync(join(root, 'biome.json'))) root = projectDir;

// biome.json's `files.includes` decides what is in scope; anything outside it is skipped quietly.
spawnSync(
  process.execPath,
  [
    existsSync(join(root, BIOME)) ? join(root, BIOME) : join(projectDir, BIOME),
    'check',
    '--write',
    '--no-errors-on-unmatched',
    '--files-ignore-unknown=true',
    filePath,
  ],
  { cwd: root, stdio: 'ignore' },
);
