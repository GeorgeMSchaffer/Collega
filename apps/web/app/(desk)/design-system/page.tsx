import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EffortBar,
  Field,
  FieldRow,
  Input,
  Meta,
  Select,
  TAG_PALETTE,
  TagChip,
  Textarea,
  THEME_NAMES,
  tagChipColors,
} from '@collega/design-system'
import { PageHeader } from '@/components/common/page-header'
import { Topbar } from '@/components/nav/topbar'
import { getBoardOverviews } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { ColorPickerDemo } from './color-picker-demo'
import { ListKitDemo } from './list-kit-demo'

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
  ['suggest', 'Suggested'],
  ['suggest-tint', 'Suggested tint'],
  ['suggest-line', 'Suggested line'],
  ['metric', 'Metric'],
  ['field', 'Field'],
  ['border', 'Border'],
] as const

/** The colours the chip rule is held to: the palette, the RGB corners and two mid-greys. */
const CHIP_CASES = [
  ...TAG_PALETTE,
  '#000000',
  '#FFFFFF',
  '#FF0000',
  '#00FF00',
  '#0000FF',
  '#FFFF00',
  '#00FFFF',
  '#FF00FF',
  '#808080',
  '#777777',
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

export default async function Page() {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  // Real boards rather than invented rows: the kit is shown on the data slice 101 will give it.
  const boards = await getBoardOverviews()

  return (
    <>
      <Topbar title={<b>Design system</b>} actions={<Badge variant="warning">Wave E0</Badge>} />
      <main className="flex max-w-5xl flex-col gap-6 p-6">
        <PageHeader
          title="Design system"
          description="The theme and every primitive the design system exports, so a change to the palette or a variant is visible without booting a feature screen. Switch the theme in the top bar to check all five."
        />

        <Card>
          <CardHeader>
            <CardTitle>Palette</CardTitle>
            <CardDescription>
              Semantic tokens from the active theme&rsquo;s block in{' '}
              <code className="font-mono text-xs">globals.css</code>; the values are comp R&rsquo;s.
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
              Comp R&rsquo;s density: 34px fields on the theme&rsquo;s field ground, 12px labels
              above them. Short related fields share a row &mdash; three, or two &mdash; and stack
              below 900px. The base layer styles a bare{' '}
              <code className="font-mono text-xs">&lt;input&gt;</code> too.
            </CardDescription>
          </CardHeader>
          <CardContent className="max-w-2xl">
            <Field htmlFor="ds-title" label="Title" required hint="Up to 200 characters.">
              <Input id="ds-title" required placeholder="Idea title" />
            </Field>
            <Field htmlFor="ds-problem" label="Problem" error="Problem is required.">
              <Textarea id="ds-problem" rows={3} aria-invalid />
            </Field>
            <FieldRow cols={3}>
              <Field htmlFor="ds-impact" label="Business impact">
                <Select id="ds-impact" defaultValue="">
                  <option value="">Choose…</option>
                  <option>High</option>
                </Select>
              </Field>
              <Field htmlFor="ds-type" label="Idea type">
                <Select id="ds-type" defaultValue="">
                  <option value="">Choose…</option>
                  <option>Improvement</option>
                </Select>
              </Field>
              <Field htmlFor="ds-priority" label="Priority">
                <Select id="ds-priority" defaultValue="Medium">
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </Select>
              </Field>
            </FieldRow>
            <FieldRow cols={2}>
              <Field htmlFor="ds-start" label="Target start">
                <Input id="ds-start" type="date" />
              </Field>
              <Field htmlFor="ds-end" label="Target end">
                <Input id="ds-end" type="date" />
              </Field>
            </FieldRow>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Effort and metadata</CardTitle>
            <CardDescription>
              The effort bar in the theme&rsquo;s metric colour, always with its words; metadata in
              the theme&rsquo;s mono face.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-6">
              <EffortBar effort="Low" />
              <EffortBar effort="Medium" />
              <EffortBar effort="High" />
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <Meta caps>State</Meta>
              <Meta caps>Window</Meta>
              <Meta>12 issues</Meta>
              <Meta>Sep 15 – Sep 28</Meta>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tag chips and the colour picker</CardTitle>
            <CardDescription>
              A chip&rsquo;s text colour is computed per theme to clear 4.5:1 against its own
              ground, for any colour. The table gives each theme&rsquo;s ratio and the share of tag
              colour left in the text.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-1.5">
              {CHIP_CASES.map((color) => (
                <TagChip key={color} color={color}>
                  {color}
                </TagChip>
              ))}
            </div>
            <ColorPickerDemo />
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Colour</th>
                    {THEME_NAMES.map((theme) => (
                      <th key={theme} scope="col" className="capitalize">
                        {theme}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CHIP_CASES.map((color) => (
                    <tr key={color}>
                      <th scope="row" className="px-3 text-left font-mono text-xs font-medium">
                        {color}
                      </th>
                      {THEME_NAMES.map((theme) => {
                        const { ratio, textShare } = tagChipColors(color, theme)
                        return (
                          <td key={theme} className="font-mono text-xs">
                            {ratio.toFixed(2)} · {textShare}%
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <ListKitDemo boards={boards} />
      </main>
    </>
  )
}
