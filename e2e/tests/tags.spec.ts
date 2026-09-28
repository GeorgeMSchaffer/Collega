import { expect, type Page, test } from '@playwright/test'
import { SEEDED } from '../seeded-accounts'

/**
 * Settings → Tags (`SPEC/20-feature-ideas-and-engagement.md` Tags rules 11–15): an Org Admin adds a
 * tag in advance, recolours it and deletes it; a Site Admin reads every organization's tags without
 * a single write; Read Only is refused the screen.
 *
 * Each write is read back after a reload, so a drawer that only updated its own state fails here.
 */

/** Narrows the list to one tag: it pages at ten, and the seed alone has more tags than that. */
async function filterTo(page: Page, name: string): Promise<void> {
  await page.getByPlaceholder('Filter by tag…').fill(name)
  await expect(page.getByRole('button', { name: `View ${name}` })).toBeVisible({ timeout: 30_000 })
}

test.describe('an org admin manages tags', () => {
  test.use({ storageState: SEEDED.orgAdmin.file })

  test('adds a tag in advance, recolours it, and deletes it', async ({ page }) => {
    const name = `e2e-tag-${Date.now()}`

    await page.goto('/settings/tags')
    await expect(page.getByRole('heading', { level: 1, name: 'Tags' })).toBeVisible({
      timeout: 30_000,
    })

    // Create: the drawer opens with one palette swatch already chosen (rule 12).
    await page.getByRole('button', { name: 'Add New Tag' }).click()
    await expect(page).toHaveURL(/[?&]tag=new/, { timeout: 30_000 })
    const create = page.getByRole('complementary', { name: 'Add New Tag' })
    await expect(create.getByRole('radio', { checked: true })).toHaveCount(1)
    await create.getByRole('textbox', { name: 'Tag', exact: true }).fill(name)
    await create.getByRole('button', { name: 'Create tag' }).click()

    // A created tag opens in view mode, unused.
    const view = page.getByRole('complementary', { name })
    await expect(view).toBeVisible({ timeout: 30_000 })
    await expect(
      view.getByText('Not used yet. It will be offered when anyone tags an idea.'),
    ).toBeVisible()

    // Recolour through Custom, typed in lower case: the tag stores and shows it upper case.
    await view.getByRole('button', { name: 'Edit' }).click()
    await expect(page).toHaveURL(/[?&]mode=edit/, { timeout: 30_000 })
    const edit = page.getByRole('complementary', { name })
    await edit.getByRole('textbox', { name: 'Custom', exact: true }).fill('#1a2b3c')
    // Choosing Custom clears the swatch selection.
    await expect(edit.getByRole('radio', { checked: true })).toHaveCount(0)
    await edit.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).not.toHaveURL(/[?&]mode=edit/, { timeout: 30_000 })

    await page.reload()
    await expect(page.getByRole('complementary', { name }).getByText('#1A2B3C')).toBeVisible({
      timeout: 30_000,
    })

    // Recolour again, to a palette swatch this time.
    await page.getByRole('complementary', { name }).getByRole('button', { name: 'Edit' }).click()
    await page
      .getByRole('complementary', { name })
      .getByRole('radio', { name: /#3FB86B/ })
      .check()
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).not.toHaveURL(/[?&]mode=edit/, { timeout: 30_000 })
    await page.reload()
    await expect(page.getByRole('complementary', { name }).getByText('#3FB86B')).toBeVisible({
      timeout: 30_000,
    })

    // Delete from the row, with the confirmation's wording (rule 15).
    await page.goto('/settings/tags')
    await filterTo(page, name)
    await page.getByRole('button', { name: `Delete ${name}` }).click()
    const confirm = page.getByRole('alertdialog', { name: 'Delete this tag?' })
    await expect(confirm).toContainText(`“${name}” is removed from 0 ideas.`)
    await expect(confirm).toContainText('Anyone who types it again creates a new tag.')
    await confirm.getByRole('button', { name: 'Delete tag' }).click()
    await expect(confirm).toBeHidden({ timeout: 30_000 })

    await page.reload()
    await page.getByPlaceholder('Filter by tag…').fill(name)
    await expect(page.getByRole('button', { name: `View ${name}` })).toHaveCount(0)
  })

  test('a duplicate name is refused on the Tag field', async ({ page }) => {
    const name = `e2e-dup-${Date.now()}`
    await page.goto('/settings/tags?tag=new')
    const create = page.getByRole('complementary', { name: 'Add New Tag' })
    await create.getByRole('textbox', { name: 'Tag', exact: true }).fill(name)
    await create.getByRole('button', { name: 'Create tag' }).click()
    await expect(page.getByRole('complementary', { name })).toBeVisible({ timeout: 30_000 })

    // The same name in another case is the same tag (rule 6), so a second one is refused.
    await page.goto('/settings/tags?tag=new')
    const again = page.getByRole('complementary', { name: 'Add New Tag' })
    await again.getByRole('textbox', { name: 'Tag', exact: true }).fill(name.toUpperCase())
    await again.getByRole('button', { name: 'Create tag' }).click()
    await expect(again.getByText('A tag with this name already exists.')).toBeVisible({
      timeout: 30_000,
    })
    await expect(again.getByRole('textbox', { name: 'Tag', exact: true })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })
})

test.describe('a site admin reads tags', () => {
  test.use({ storageState: SEEDED.siteAdmin.file })

  test('sees every organization, with no write actions', async ({ page }) => {
    await page.goto('/settings/tags')
    await expect(page.getByRole('columnheader', { name: /Organization/ })).toBeVisible({
      timeout: 30_000,
    })

    const add = page.getByRole('button', { name: 'Add New Tag' })
    await expect(add).toHaveAttribute('aria-disabled', 'true')
    const reason = await add.getAttribute('aria-describedby')
    expect(reason).toBeTruthy()
    await expect(page.locator(`#${String(reason)}`)).not.toBeEmpty()

    // View is there on every row; Edit and Delete are on none.
    await expect(page.getByRole('button', { name: /^View / }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /^Edit / })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Delete / })).toHaveCount(0)
  })
})

test.describe('read only', () => {
  test.use({ storageState: SEEDED.readOnly.file })

  test('is refused the screen', async ({ page }) => {
    await page.goto('/settings/tags')
    await expect(page.getByRole('heading', { name: 'Administrators only' })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByRole('button', { name: 'Add New Tag' })).toHaveCount(0)
    await expect(page.getByRole('table', { name: 'Tags' })).toHaveCount(0)
  })
})
