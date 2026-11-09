# driver.js 1.8 — the traps

Every item here was verified by reading `node_modules/driver.js/dist/driver.js.mjs`
and `driver.css`, not the docs, and every one of them bites during a real
implementation. When something behaves oddly, read the dist file — it is
minified but searchable, and it settles questions the docs don't cover.

```bash
npm install driver.js
```

```js
const { driver } = await import("driver.js");   // client-only; it touches document
import "driver.js/dist/driver.css";
```

## 1. Your hooks REPLACE the default behaviour

Supplying `onNextClick` / `onPrevClick` / `onCloseClick` does **not** add a
callback alongside driver's own advance — it takes its place. In the dist, the
popover's click handler is literally `return config.onNextClick?.()`.

So the moment you supply one, you own the movement:

```js
onNextClick: () => {
  // ... your logic ...
  driverObj.moveNext();       // required — nothing else will
},
```

Forget this and the buttons go visually dead: the popover stays, nothing moves,
no error.

## 2. There are two destroy paths and they behave differently

- The **public** `driverObj.destroy()` internally calls `destroy(false)`, which
  **skips `onDestroyStarted`** and tears down immediately.
- The **X button and Escape** call `destroy(true)`, which fires
  `onDestroyStarted` and then **returns without tearing anything down**.

So if you define `onDestroyStarted` (e.g. to record that the user quit), it
must call `driverObj.destroy()` itself or the tour never closes. And your own
programmatic teardown won't trigger that hook at all — which is convenient,
because it means tearing down to change pages can't be mistaken for the user
quitting.

## 3. The final button is the SAME element, with a class added

On the last step driver runs:

```js
t.doneButton && r.nextButton.classList.add(`driver-popover-done-btn`)
```

So the Done/Finish button **is** the next button — it keeps
`.driver-popover-next-btn` and merely gains `.driver-popover-done-btn`.

Two consequences:

- Styling `.driver-popover-next-btn` already covers it. You do **not** need a
  separate rule, and adding one risks a subtle bug: appending
  `.driver-popover-done-btn` to a comma-separated dark-mode selector without
  repeating the dark scope leaks that styling into light mode, visible only on
  the very last step of the tour.
- Use `.driver-popover-done-btn` only when you deliberately want the final
  button to look *different* from Next.

`onDoneClick` takes precedence over `onNextClick` on the last step *if* you
define it; if you don't, `onNextClick` fires there too.

## 4. Disabled buttons need BOTH halves cleared

driver.js disables a button by setting the DOM `disabled` **property** *and*
adding `.driver-popover-btn-disabled`. A disabled `<button>` dispatches no
click event at all, so removing only the class produces a button that looks
enabled and does nothing.

This matters for multi-page tours: driver disables Back whenever it is on index
0 of the array it was given, but that array is only the current page's steps —
so on every page after the first, "step 0" is the middle of the tour. To let
people walk backwards:

```js
onPopoverRender: (popover, { state }) => {
  if ((state.activeIndex ?? 0) === 0 && pageIndex > 0) {
    popover.previousButton.disabled = false;                      // both
    popover.previousButton.classList.remove("driver-popover-btn-disabled");
  }
}
```

**Only do this if you also supply `onPrevClick`.** driver's internal handler is
`() => moveTo(index - 1)`, and `moveTo(-1)` finds no step and calls destroy —
so an enabled Back button on step 0 with no hook of your own *ends the tour*,
and with `onDestroyStarted` defined it records that as a skip. Re-enabling the
button and handling the click are one change, not two.

## 5. The arrow is a border triangle — colour all four sides

`.driver-popover-arrow` is `border: 5px solid #fff` with three sides made
transparent. **Which** side is visible depends on placement, so a single
`border-color` override either does nothing or paints a solid square:

```css
.my-tour.driver-popover .driver-popover-arrow-side-top    { border-top-color:    var(--surface); }
.my-tour.driver-popover .driver-popover-arrow-side-bottom { border-bottom-color: var(--surface); }
.my-tour.driver-popover .driver-popover-arrow-side-left   { border-left-color:   var(--surface); }
.my-tour.driver-popover .driver-popover-arrow-side-right  { border-right-color:  var(--surface); }
```

Miss this and the arrow stays white against a dark popover. Leave the border
*width* alone — driver positions the arrow against that constant.

## 6. Specificity ties with `.driver-fade`

`.driver-popover` starts with `all: unset`, so state every property you want,
including `font-family`.

More subtly: when `animate: true`, driver adds `.driver-fade` to `<body>` and
its `.driver-fade .driver-popover` rule is `(0,2,0)` — the **same** specificity
as your `.driver-popover.my-tour`. Which animation wins then depends on
stylesheet order, and driver.css usually loads last. Restate at `(0,3,0)`:

```css
.driver-fade .driver-popover.my-tour { animation: my-pop-in 280ms ease; }
```

## 7. z-index: put custom overlays between the two layers

- overlay SVG: `z-index: 10000` (set inline by the JS)
- popover: `z-index: 1000000000` (in driver.css)

A guiding hand or custom highlight belongs at **10001** — above the dimming,
below the popover, so it can never cover the text being read.

## Useful config

```js
driver({
  animate: true, smoothScroll: true,
  overlayColor: "#150c22", overlayOpacity: 0.62,
  stagePadding: 8, stageRadius: 14, popoverOffset: 14,
  disableActiveInteraction: true,   // clicking the highlight would navigate away
  allowClose: true, allowKeyboardControl: true,
  popoverClass: "my-tour",
  showProgress: false,              // driver counts within the array it was
                                    // given — wrong for multi-page; render your
                                    // own global counter in onPopoverRender
  nextBtnText: "Next", prevBtnText: "Back", doneBtnText: "Finish",
  waitForElement: 3000,             // per-step wait for a late target
})
```

`onPopoverRender(popover, { state, config })` gives you the popover's DOM
(`wrapper`, `title`, `description`, `footer`, `previousButton`, `nextButton`,
`closeButton`) — the hook for injecting a global progress label or a
"Skip tour" link.

## Useful API

`drive(i)` `moveNext()` `movePrevious()` `moveTo(i)` `destroy()` `refresh()`
`isFirstStep()` `isLastStep()` `getActiveIndex()` `getActiveElement()`
`hasNextStep()` `hasPreviousStep()`
