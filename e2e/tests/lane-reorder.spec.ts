import { expect, type Page, test } from '@playwright/test'
import { SEEDED } from '../seeded-accounts'

/**
 * Reordering a board's lanes from its own page (slice 130), through a real browser and the real
 * API: the arrow saves immediately, the saved order survives a reload, focus stays on the arrow that
 * was pressed, and a Read Only reader is not offered the controls at all.
 *
 * The unit suite covers the rules with a faked save; what only a browser can show is that the lane
 * node moving in the DOM does not take keyboard focus with it.
 */
const SEEDED_BOARD = 'Ideas'

async function openSeededBoard(page: Page): Promise<void> {
  await page.goto(`/boards?q=${encodeURIComponent(SEEDED_BOARD)}`)
  const board = page
    .locator('a[href^="/boards/"]')
    .filter({ hasText: new RegExp(`^${SEEDED_BOARD}$`) })
  await expect(board).toBeVisible({ timeout: 30_000 })
  await board.click()
  await expect(page).toHaveURL(/\/boards\/[0-9a-f-]+$/i, { timeout: 30_000 })
}

/** The lanes left to right, read from the move-left arrows each header carries. */
async function laneOrder(page: Page): Promise<string[]> {
  return page
    .getByRole('button', { name: /^Move the .+ lane left$/ })
    .evaluateAll((buttons) =>
      buttons.map((button) =>
        (button.getAttribute('aria-label') ?? '').replace(/^Move the (.+) lane left$/, '$1'),
      ),
    )
}

test.describe('an org admin reorders lanes', () => {
  test.use({ storageState: SEEDED.orgAdmin.file })

  test('an arrow saves at once, keeps focus, and the order survives a reload', async ({ page }) => {
    await openSeededBoard(page)
    const before = await laneOrder(page)
    expect(before.length).toBeGreaterThanOrEqual(3)
    const [first, second, third, ...rest] = before as [string, string, string, ...string[]]

    const right = page.getByRole('button', { name: `Move the ${second} lane right` })
    await right.focus()
    await right.click()

    await expect.poll(() => laneOrder(page)).toEqual([first, third, second, ...rest])
    await expect(page.getByRole('status')).toHaveText(
      `${second} moved to position 3 of ${before.length}`,
    )
    await expect(page.getByRole('button', { name: `Move the ${second} lane right` })).toBeFocused()

    await page.reload()
    await expect.poll(() => laneOrder(page)).toEqual([first, third, second, ...rest])

    // Put it back, so a later spec on this board finds the lanes as seeded.
    const left = page.getByRole('button', { name: `Move the ${second} lane left` })
    await left.focus()
    await left.click()
    await expect.poll(() => laneOrder(page)).toEqual(before)
    await expect(page.getByRole('button', { name: `Move the ${second} lane left` })).toBeFocused()
  })

  test('the first lane has no left move and the last no right move', async ({ page }) => {
    await openSeededBoard(page)
    const lanes = await laneOrder(page)
    await expect(
      page.getByRole('button', { name: `Move the ${lanes[0]} lane left` }),
    ).toHaveAttribute('aria-disabled', 'true')
    await expect(
      page.getByRole('button', { name: `Move the ${lanes.at(-1)} lane right` }),
    ).toHaveAttribute('aria-disabled', 'true')
  })
})

test.describe('a read only reader', () => {
  test.use({ storageState: SEEDED.readOnly.file })

  test('is not offered lane reordering', async ({ page }) => {
    await openSeededBoard(page)
    await expect(page.getByRole('region').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /^Move the .+ lane (left|right)$/ })).toHaveCount(
      0,
    )
  })
})
