/**
 * Builds `SPEC/mockups/comp-r-home-dashboard-built.html`: Home drawn with the real
 * `@collega/design-system` components and compiled with its `globals.css`, so the comp wears the
 * app's theme instead of a hand-copied stylesheet.
 *
 *   pnpm --filter @collega/design-system build   # once, so dist/ exists
 *   node SPEC/mockups/_build/build_r_home.mjs
 *
 * No dependency of its own: react, react-dom and the design system resolve from
 * packages/design-system, Tailwind from apps/web (`@tailwindcss/postcss` -> `@tailwindcss/node`).
 * The panel/row/tile markup mirrors `apps/web/components/home/home-parts.tsx` and
 * `app/(desk)/home/page.tsx`; those live in apps/web, which this script cannot bundle, so change
 * them together. The data is illustrative. Output is deterministic for unchanged sources.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const DS = join(ROOT, 'packages/design-system')
const OUT = join(ROOT, 'SPEC/mockups/comp-r-home-dashboard-built.html')

const fromDs = createRequire(join(DS, 'package.json'))
const fromWeb = createRequire(join(ROOT, 'apps/web/package.json'))
const React = fromDs('react')
const { renderToStaticMarkup } = fromDs('react-dom/server')
const tailwindNode = createRequire(fromWeb.resolve('@tailwindcss/postcss'))('@tailwindcss/node')
const ui = await import(pathToFileURL(join(DS, 'dist/index.js')).href)
const { Badge, Card, CardContent, Dot, Kbd, Marker, Meta, Meter, THEME_NAMES, buttonVariants, cn } =
  ui

const h = React.createElement

// ---------- Home's pieces, as apps/web/components/home/home-parts.tsx draws them ----------

const Panel = ({ id, heading, standfirst, action, children }) =>
  h(
    'section',
    { 'aria-labelledby': id, className: 'flex min-w-0 flex-col gap-2.5' },
    h(
      'div',
      { className: 'flex items-start gap-2.5' },
      h(
        'div',
        { className: 'min-w-0 flex-1' },
        h(
          'h2',
          { id, className: 'm-0 flex items-center gap-2 text-[17px] leading-snug font-semibold' },
          heading,
        ),
        standfirst
          ? h('p', { className: 'm-0 mt-0.5 max-w-prose text-sm text-muted-foreground' }, standfirst)
          : null,
      ),
      action,
    ),
    children,
  )

const Count = ({ n }) =>
  h('span', { className: 'font-mono text-xs font-medium text-muted-foreground' }, n)

const Rows = ({ children, footer }) =>
  h(
    'div',
    { className: 'overflow-hidden rounded-lg border bg-card' },
    h('ul', { className: 'm-0 list-none p-0' }, children),
    footer ? h('div', { className: 'border-t bg-muted/40 px-4 py-2 text-sm' }, footer) : null,
  )

const Row = ({ children }) =>
  h(
    'li',
    {
      className:
        'flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-t px-3 py-2.5 first:border-t-0 hover:bg-muted/40 sm:px-4',
    },
    children,
  )

const RowTitle = ({ title, sub, bold }) =>
  h(
    'span',
    { className: 'min-w-0 flex-[1_1_240px]' },
    h(
      'a',
      {
        href: '#',
        className: cn(
          'text-foreground no-underline hover:underline',
          bold ? 'font-bold' : 'font-semibold',
        ),
      },
      title,
    ),
    sub ? h('span', { className: 'block text-xs text-muted-foreground' }, sub) : null,
  )

const StatusMarker = ({ name, color }) => h(Marker, null, h(Dot, { color }), name)

const PRIORITY = { Critical: 'var(--destructive)', High: 'var(--orange)', Medium: 'var(--sky)' }
const PriorityMarker = ({ priority }) =>
  h(Marker, null, h(Dot, { color: PRIORITY[priority] }), priority)

const Tile = ({ label, value, detail, definition, alert, untracked }) =>
  h(
    'li',
    null,
    h(
      Card,
      { className: cn('h-full', untracked && 'border-dashed bg-transparent shadow-none') },
      h(
        CardContent,
        { className: 'flex h-full flex-col gap-0.5' },
        h(Meta, { caps: true }, label),
        h(
          'span',
          {
            className:
              'self-start font-heading text-[26px] leading-tight font-semibold tabular-nums sm:text-3xl',
          },
          value,
        ),
        h(
          'span',
          {
            className: cn('text-sm', alert ? 'font-semibold text-destructive' : 'text-muted-foreground'),
          },
          detail,
        ),
        h('p', { className: 'm-0 mt-1.5 text-xs text-muted-foreground' }, definition),
      ),
    ),
  )

const SmallButton = ({ children }) =>
  h('a', { href: '#', className: buttonVariants({ variant: 'outline', size: 'sm' }) }, children)

// ---------- Illustrative data ----------

const S = {
  New: 'var(--sky)',
  Review: 'var(--orange)',
  Progress: 'var(--primary)',
  Client: 'var(--violet, #7c3aed)',
  Done: 'var(--success)',
}

const ATTENTION = [
  ['Warranty claims stall at triage', 'Opportunities · Process', 'In Review', S.Review, 'Critical', '9d'],
  ['Field units lose pairing after update', 'Ideas · Defect', 'New / Pending', S.New, 'Critical', '6d'],
  ['Parts lookup is too slow on tablets', 'Opportunities · Improvement', 'In Progress', S.Progress, 'High', '4d'],
]
const UNREAD = [
  ['Remote fault diagnostics for field units', 'Priya Nair', 'mentioned you in a comment on', null, 'Opportunities', '12m'],
  ['Customer-visible repair status', 'Sam Okafor', 'moved', 'Client Review', 'Opportunities', '2h'],
  ['Torque audit on every tenth unit', 'Lena Fischer', 'commented on', null, 'Ideas', '5h'],
  ['Offline service manuals on the tablet', 'Priya Nair', 'edited', null, 'Opportunities', '1d'],
]
const ASSIGNED = [
  ['Warranty claims stall at triage', 'Opportunities', 'In Review', S.Review, 'Critical'],
  ['Parts lookup is too slow on tablets', 'Opportunities', 'In Progress', S.Progress, 'High'],
  ['Torque audit on every tenth unit', 'Ideas', 'Complete', S.Done, 'Medium'],
]
const VOTED = [
  ['Customer-visible repair status', 'Opportunities', 'Client Review', S.Client, 9, true],
  ['Remote fault diagnostics for field units', 'Opportunities', 'In Review', S.Review, 7, true],
  ['Offline service manuals on the tablet', 'Opportunities', 'New / Pending', S.New, 4, false],
]
const BOARDS = [
  ['Opportunities', 'Customer-facing ideas that could grow revenue.', [6, 5, 4, 2, 3], 20],
  ['Ideas', 'Anything the floor wants looked at.', [9, 4, 3, 1, 4], 21],
]
const LANES = [
  ['New / Pending', S.New],
  ['In Review', S.Review],
  ['In Progress', S.Progress],
  ['Client Review', S.Client],
  ['Complete', S.Done],
]

// ---------- The page ----------

const attention = h(
  Panel,
  {
    id: 'home-attention',
    heading: 'Needs your attention',
    standfirst:
      'Critical and high-priority ideas still on a board, oldest first — the longer one waits, the more it needs a decision.',
  },
  h(
    Rows,
    { footer: h('a', { href: '#' }, 'View all 7') },
    ATTENTION.map(([t, sub, status, color, prio, age]) =>
      h(
        Row,
        { key: t },
        h(RowTitle, { title: t, sub }),
        h(
          'span',
          { className: 'flex flex-wrap items-center gap-3' },
          h(StatusMarker, { name: status, color }),
          h(PriorityMarker, { priority: prio }),
          h('span', { className: 'min-w-[34px] text-right font-mono text-xs text-muted-foreground' }, age),
        ),
      ),
    ),
  ),
)

const boards = h(
  Panel,
  {
    id: 'home-boards',
    heading: 'Your boards',
    standfirst: 'Ideas on each board by lane, left to right in lane order.',
    action: h(SmallButton, null, 'Manage boards'),
  },
  h(
    'div',
    { className: 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3' },
    BOARDS.map(([name, desc, counts, total]) =>
      h(
        Card,
        { key: name, className: 'flex flex-col gap-2.5 px-4 py-3.5' },
        h(
          'h3',
          { className: 'm-0 text-base font-semibold' },
          h('a', { href: '#', className: 'text-foreground no-underline hover:underline' }, name),
        ),
        h('p', { className: 'm-0 line-clamp-2 text-sm text-muted-foreground' }, desc),
        h(
          'div',
          {
            className: 'flex h-2 overflow-hidden rounded-full bg-muted',
            role: 'img',
            'aria-label': `${name} ideas by lane`,
          },
          counts.map((n, i) =>
            h('span', { key: LANES[i][0], style: { flex: n, background: LANES[i][1] } }),
          ),
        ),
        h(
          'div',
          { className: 'flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground' },
          counts.map((n, i) =>
            h(
              'span',
              { key: LANES[i][0], className: 'inline-flex items-center gap-1' },
              h(Dot, { color: LANES[i][1] }),
              `${LANES[i][0]} ${n}`,
            ),
          ),
        ),
        h(
          'div',
          {
            className:
              'mt-auto flex justify-between gap-2 border-t pt-2 text-xs text-muted-foreground tabular-nums',
          },
          h('span', null, `${total} ideas`),
          h('span', null, '6 tags'),
        ),
      ),
    ),
  ),
)

const activity = h(
  Panel,
  {
    id: 'home-activity',
    heading: 'Recent activity',
    standfirst: 'What changed on boards you can see, newest first.',
  },
  h(
    'p',
    { className: 'm-0 rounded-lg border border-dashed px-4 py-3.5 text-sm text-muted-foreground' },
    'Not available yet. Moves, comments and edits will be listed here once the activity feed is switched on.',
  ),
)

// New panel: mirrors UnreadRow in app/(desk)/home/page.tsx.
const unread = h(
  Panel,
  {
    id: 'home-unread',
    heading: ['Unread notifications ', h(Count, { key: 'n', n: 7 })],
    standfirst: 'Mentions and activity on ideas you follow, newest first.',
  },
  h(
    Rows,
    { footer: h('a', { href: '#' }, 'Open inbox') },
    UNREAD.map(([t, who, verb, to, board, when]) =>
      h(
        Row,
        { key: t },
        h(RowTitle, {
          title: t,
          bold: true,
          sub: [
            who,
            ' ',
            verb,
            ' this',
            to ? [' to ', h('b', { key: 'b', className: 'font-semibold' }, to)] : '',
            ` · ${board}`,
          ],
        }),
        h('time', { className: 'text-xs text-muted-foreground' }, when),
      ),
    ),
  ),
)

const assigned = h(
  Panel,
  {
    id: 'home-assigned',
    heading: ['Assigned to me ', h(Count, { key: 'n', n: 3 })],
    standfirst: 'Highest priority first.',
  },
  h(
    Rows,
    { footer: h('a', { href: '#' }, 'View all 3') },
    ASSIGNED.map(([t, sub, status, color, prio]) =>
      h(
        Row,
        { key: t },
        h(RowTitle, { title: t, sub }),
        h(
          'span',
          { className: 'flex flex-wrap items-center gap-3' },
          h(StatusMarker, { name: status, color }),
          h(PriorityMarker, { priority: prio }),
        ),
      ),
    ),
  ),
)

const sprint = h(
  Panel,
  { id: 'home-sprint', heading: 'Current sprint' },
  h(
    Card,
    { className: 'flex flex-col gap-2.5 px-4 py-3.5' },
    h(
      'div',
      { className: 'flex flex-wrap items-baseline justify-between gap-2' },
      h('b', { className: 'font-heading text-base' }, 'Sprint 14'),
      h(Badge, { variant: 'success' }, 'Active'),
    ),
    h('span', { className: 'font-mono text-xs text-muted-foreground' }, '22 Sep – 5 Oct'),
    h('p', { className: 'm-0 text-sm' }, 'Ship the repair-status portal to the first three customers.'),
    h(Meter, { pct: 55 }),
    h(
      'div',
      { className: 'flex flex-wrap justify-between gap-1 text-sm' },
      h('span', null, h('b', null, '6'), ' of 11 issues done'),
      h('a', { href: '#', className: 'text-muted-foreground' }, '14 in the backlog'),
    ),
    h('div', null, h(SmallButton, null, 'Open sprint board')),
  ),
)

const voted = h(
  Panel,
  { id: 'home-voted', heading: 'Most upvoted', standfirst: 'Ideas on a board with the most upvotes.' },
  h(
    Rows,
    null,
    VOTED.map(([t, sub, status, color, votes, mine]) =>
      h(
        Row,
        { key: t },
        h(RowTitle, { title: t, sub }),
        h(
          'span',
          { className: 'flex flex-wrap items-center gap-3' },
          h(StatusMarker, { name: status, color }),
          h(
            'span',
            {
              className: cn(
                'inline-flex min-w-[42px] items-center gap-0.5 rounded-full py-0 pr-2 pl-1 text-xs font-semibold',
                mine ? 'bg-primary/15 text-foreground' : 'bg-muted text-foreground',
              ),
              title: mine ? 'You upvoted this' : 'Upvotes',
            },
            '▲',
            votes,
          ),
        ),
      ),
    ),
  ),
)

const tiles = [
  ['Assigned to me', '3', '1 critical', 'Every idea with your name in Assigned, whatever its status.', true],
  ['Critical & high', '7', 'still on a board', 'Critical or high-priority ideas not yet complete.', false],
  ['You created', '12', 'ideas', 'Ideas you submitted, whatever their status.', false],
]

const page = h(
  'div',
  { className: 'mx-auto flex max-w-[1400px] flex-col gap-5 p-4 min-[900px]:p-6' },
  h(
    'header',
    null,
    h('h1', { className: 'm-0 font-heading text-3xl font-semibold' }, 'Good to see you, Alex.'),
    h(
      'p',
      { className: 'm-0 mt-1 max-w-prose text-muted-foreground' },
      'Here’s what needs you today. Acme Robotics has 41 ideas across 2 boards and 1 delivery issue — press ',
      h(Kbd, null, 'Ctrl K'),
      ' to jump straight to any of them.',
    ),
  ),
  h(
    'ul',
    {
      'aria-label': 'Your numbers',
      className:
        'm-0 grid list-none grid-cols-1 gap-3 p-0 min-[380px]:grid-cols-2 min-[1100px]:grid-cols-4',
    },
    tiles.map(([label, value, detail, definition, alert]) =>
      h(Tile, { key: label, label, value, detail, definition, alert }),
    ),
    h(Tile, {
      key: 'untracked',
      label: 'Not tracked yet',
      value: '—',
      detail: 'Open ideas · Awaiting review · Completed 30d',
      definition: 'Needs status categories and status-change times.',
      untracked: true,
    }),
  ),
  h(
    'div',
    { className: 'grid items-start gap-6 min-[1100px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' },
    h('div', { className: 'flex min-w-0 flex-col gap-6' }, attention, boards, activity),
    h('div', { className: 'flex min-w-0 flex-col gap-6' }, unread, assigned, sprint, voted),
  ),
)

const body = renderToStaticMarkup(page)

// ---------- Compile the design system's stylesheet for exactly the classes used ----------

const candidates = new Set()
for (const [, value] of body.matchAll(/class="([^"]*)"/g)) {
  for (const token of value.split(/\s+/)) if (token) candidates.add(token)
}
const cssPath = join(DS, 'src/globals.css')
const compiled = await tailwindNode.compile(readFileSync(cssPath, 'utf8'), {
  base: dirname(cssPath),
  onDependency() {},
})
const css = compiled.build([...candidates].sort())

const html = `<!doctype html>
<html lang="en" data-theme="graphite">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Collega · Home (built from the design system)</title>
<style>${css}</style>
</head>
<body class="bg-background text-foreground">
<!-- Generated by SPEC/mockups/_build/build_r_home.mjs from @collega/design-system. Do not edit. -->
<div class="border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">Comp R · Home, drawn with the real design-system components. Illustrative data. Theme: <select id="theme" aria-label="Theme"></select></div>
${body}
<script>
const themes = ${JSON.stringify(THEME_NAMES)};
const pick = document.getElementById('theme');
for (const t of themes) pick.add(new Option(t, t, false, t === 'graphite'));
pick.onchange = () => { document.documentElement.dataset.theme = pick.value };
</script>
</body>
</html>
`
writeFileSync(OUT, html)
console.log(`wrote ${OUT} (${html.length} bytes, ${candidates.size} classes)`)
