import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@collega/design-system'

/**
 * Wave E0's verification surface: it renders the theme and every primitive the design system
 * currently exports, so a change to the palette or a variant is visible without booting a
 * feature screen. Deliberately not the desk shell — E2 owns that layout, E3 the ideas list.
 */

const SWATCHES = [
  ['background', 'Canvas'],
  ['card', 'Surface'],
  ['primary', 'Primary'],
  ['secondary', 'Secondary'],
  ['muted', 'Muted'],
  ['accent', 'Accent'],
  ['destructive', 'Destructive'],
  ['border', 'Border'],
] as const

const CATEGORY_DOTS = [
  'sky',
  'teal',
  'green',
  'orange',
  'orange-deep',
  'pink',
  'purple',
  'purple-deep',
] as const

export default function Page() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1>Collega</h1>
          <Badge variant="warning">Wave E0</Badge>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          The TypeScript client boots. This page renders the comp Q theme and the design-system
          primitives; feature screens arrive in E1–E6, and real data once Wave D gives them an API
          to call.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Palette</CardTitle>
          <CardDescription>
            Semantic tokens from <code className="font-mono text-xs">globals.css</code>, carried
            over from <code className="font-mono text-xs">SPEC/mockups/_build/q.css</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {SWATCHES.map(([token, label]) => (
            <div key={token} className="flex w-28 flex-col gap-1.5">
              <div
                className="h-12 rounded-md border border-border"
                style={{ background: `var(--${token})` }}
              />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Buttons</CardTitle>
          <CardDescription>
            Comp Q&apos;s <code className="font-mono text-xs">.btn</code>, as real variants.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button>Create idea</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Delete</Button>
          <Button variant="link">Link</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Badges and category dots</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="success">Shipped</Badge>
            <Badge variant="warning">In review</Badge>
            <Badge variant="destructive">Blocked</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {CATEGORY_DOTS.map((dot) => (
              <span key={dot} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2.5 rounded-full" style={{ background: `var(--${dot})` }} />
                {dot}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Form controls</CardTitle>
          <CardDescription>
            Styled by the base layer, so a bare{' '}
            <code className="font-mono text-xs">&lt;input&gt;</code> already matches shadcn without
            a wrapper component.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:max-w-md">
          <input type="text" placeholder="Idea title" />
          <textarea rows={3} placeholder="Describe the problem this solves" />
          <select defaultValue="">
            <option value="" disabled>
              Business impact
            </option>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </CardContent>
      </Card>
    </main>
  )
}
