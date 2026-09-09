# Collega — how to build with this design system

Collega is a **React component library on Tailwind CSS v4 + shadcn/ui**. Build screens from the
components below plus Tailwind utility classes. Do not write bespoke CSS, and do not invent a
parallel class vocabulary — the utilities and the semantic colour names below are the whole
styling surface.

## Setup

**There is no provider or wrapper component.** No theme context, no root element to nest under —
every component is plain and renders correctly on its own. Link `styles.css` and everything
resolves: it imports the theme tokens, the self-hosted fonts, and the compiled component CSS.

Type is **Geist** (`font-sans`) and **Geist Mono** (`font-mono`), shipped as real font files. Never
add a Google Fonts or CDN link.

## The styling idiom

Tailwind utility classes over **semantic colour names**, never raw palette values. Write
`bg-primary`, not `bg-[#527292]`; `text-muted-foreground`, not `text-gray-500`. Tailwind's own
numbered palette (`blue-500`, `slate-200`) is not part of this system.

The semantic scale — each is available as `bg-*`, `text-*` and `border-*`:

| Purpose | Names |
|---|---|
| Page and text | `background`, `foreground` |
| Surfaces | `card` / `card-foreground`, `popover` / `popover-foreground` |
| Emphasis | `primary` / `primary-foreground`, `secondary` / `secondary-foreground` |
| Recessive | `muted` / `muted-foreground`, `accent` / `accent-foreground` |
| Meaning | `destructive` / `destructive-foreground`, `warning`, `success`, `teal` |
| Lines and focus | `border`, `input`, `ring` |
| Navigation | `sidebar`, `sidebar-foreground`, `sidebar-primary`, `sidebar-accent`, `sidebar-border` |

Opacity modifiers are idiomatic here: `bg-muted/40`, `border-destructive/50`.

Category colours (status dots, idea categories) are CSS variables rather than utilities, passed as
values: `var(--sky)`, `var(--teal)`, `var(--green)`, `var(--orange)`, `var(--purple)`,
`var(--pink)`, `var(--brown)`, and `var(--sug)` for AI suggestions.

**Corner radius is deliberately small** — `--radius` is `0.3rem`. Use `rounded-md` (the default),
`rounded-sm`, `rounded-lg`; only avatars and meters are `rounded-full`. Do not round further.

Three rules that are load-bearing:

- **An action a role may not take is shown, disabled, with the reason beside it — never hidden.**
  Use `Denied` wrapping a control that carries `aria-disabled="true"` and `aria-describedby`
  pointing at the reason. Never plain `disabled`: it leaves the tab order, which makes the reason
  unreachable.
- **Never encode meaning in colour alone.** Status, priority and impact are always spelled out in
  words next to any colour marker.
- **`Field` owns the label binding.** `htmlFor` is required, and `Field` sets `aria-describedby`
  on the control itself. Pass exactly one child control whose `id` matches.

One gotcha: the base layer styles `input[type=text|password|search|file]`, `textarea` and
`select`. An `Input` with any other type (`email`, `url`, `number`) renders with no border or
padding — use the default `text` type for an email field.

## The components

**Actions** `Button` (variants `default` `secondary` `outline` `ghost` `destructive` `link`; sizes
`sm` `default` `lg` `icon`), `FileButton`, `Denied`.
**Forms** `Field`, `Label`, `Input`, `Textarea`, `Select` — each control takes `invalid`.
**Surfaces** `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `Separator`.
**Status** `Badge` (`default` `secondary` `outline` `success` `warning` `destructive`), `Marker`,
`Tag`, `Dot`, `Alert` (`default` `destructive` `note`), `Meter` (`ok` `warn` `over`).
**States** `EmptyState`, `ErrorState`, `Skeleton`, `SkeletonRows`, `SkeletonRegion`.
**Primitives** `Avatar`, `Kbd`, `Code`, `CodeChip`.
`cn` is the class-merging helper if you need it.

## Where the truth lives

Read these before styling — they beat any summary:

- `styles.css` — the entry point and its import order
- `tokens/` — every token value, including the category colours
- each component's `.d.ts` for its real props, and its `.prompt.md` for usage

## A build snippet

```jsx
<Card className="max-w-lg">
  <CardHeader>
    <CardTitle>Assist budget</CardTitle>
    <CardDescription>Tokens spent against today’s deployment cap.</CardDescription>
  </CardHeader>
  <CardContent>
    <div className="mb-2 flex items-center gap-2">
      <span className="text-sm font-medium">Northwind</span>
      <Badge variant="warning">Near cap</Badge>
      <span className="ml-auto text-sm font-semibold tabular-nums">88%</span>
    </div>
    <Meter pct={88} variant="warn" />
    <p className="m-0 mt-3 text-xs text-muted-foreground">
      The window rolls over at midnight UTC.
    </p>
  </CardContent>
</Card>
```
