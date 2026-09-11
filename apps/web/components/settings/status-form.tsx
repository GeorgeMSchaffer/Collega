'use client'

import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
} from '@collega/design-system'
import { useActionState, useState } from 'react'
import { type CreateCatalogItemState, createStatus } from '@/lib/server/catalog-actions'

const IDLE: CreateCatalogItemState = { error: null, name: '' }

/** `STATUS_NAME_MAX_LENGTH`, mirrored — `apps/web` may not import the domain package. */
const NAME_MAX = 100

/**
 * The shape the API accepts, and the only shape it accepts: `/^#[0-9a-fA-F]{6}$/`, checked at the
 * request boundary since 2026-09-10 (`statuses.controller.ts`, `HEX_COLOR`). Three-digit shorthand,
 * a bare `fff`, a CSS colour name and `var(--sky)` are all refused.
 */
const HEX = '#[0-9a-fA-F]{6}'

/** `#64748B`, the colour the API gives a status created without one. */
const DEFAULT_COLOR = '#64748b'

/**
 * "Add status", as comp P's `s-statuses` draws it: a short create form in a card beside the list it
 * adds to, rather than a drawer. The list stays visible for reference — names are unique within an
 * organization, so the thing you need while typing one is the ones already there — and there is no
 * overlay to trap focus in.
 *
 * ## The colour field
 *
 * Two controls over one value, which is why this component holds state at all. The hex box is what
 * comp P shows and is the only way to type a brand colour exactly; the swatch is how anyone else
 * picks one. `<input type="color">` always yields `#rrggbb`, so it cannot produce a value the API
 * refuses — and the hex box carries the same rule as a `pattern`, so a typo is caught by the
 * browser's own constraint validation before a request is made rather than coming back as a 400.
 *
 * That is a courtesy, not a gate: the API validates the shape itself and this form posts whatever
 * survives, so a refusal still renders above the fields.
 */
export function StatusForm() {
  const [state, submit, pending] = useActionState(createStatus, IDLE)
  const [color, setColor] = useState(DEFAULT_COLOR)

  return (
    <Card className="h-fit" id="add-status">
      <CardHeader>
        <CardTitle>Add status</CardTitle>
      </CardHeader>
      <CardContent>
        {state.error ? (
          <Alert variant="destructive" className="mb-4">
            <span>{state.error}</span>
          </Alert>
        ) : null}

        <form action={submit}>
          <Field
            htmlFor="status-name"
            label="Name"
            hint="Shown as a lane header on every board. New statuses are added at the end of the order."
          >
            <Input
              id="status-name"
              name="name"
              required
              maxLength={NAME_MAX}
              defaultValue={state.name}
            />
          </Field>

          <Field
            htmlFor="status-color"
            label="Colour"
            hint="Six-digit hex. Colour is decoration — the status name always shows beside it."
          >
            <span className="flex gap-2">
              <Input
                id="status-color"
                name="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                pattern={HEX}
                maxLength={7}
                className="flex-1"
              />
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                aria-label="Pick colour visually"
                className="h-9 w-11 flex-none p-0.5"
              />
            </span>
          </Field>

          <Button type="submit" className="w-full justify-center" disabled={pending}>
            {pending ? 'Adding…' : 'Add status'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
