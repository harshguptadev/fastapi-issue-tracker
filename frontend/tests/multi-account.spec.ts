import { expect, test } from "@playwright/test"

import { createUser } from "./utils/privateApi"
import { randomEmail, randomIssueTitle, randomPassword } from "./utils/random"
import { logInUser } from "./utils/user"

test.describe("Multi-account switching", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("Switching accounts isolates private issues", async ({ page }) => {
    const passwordA = randomPassword()
    const passwordB = randomPassword()
    const emailA = randomEmail()
    const emailB = randomEmail()
    const privateTitle = randomIssueTitle()

    await createUser({ email: emailA, password: passwordA })
    await createUser({ email: emailB, password: passwordB })

    await logInUser(page, emailA, passwordA)

    await page.goto("/issues")
    await page.getByRole("button", { name: "Add Issue" }).click()
    await page.getByLabel("Title").fill(privateTitle)
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByText("Issue created successfully")).toBeVisible()
    await expect(page.getByText(privateTitle)).toBeVisible()

    await page.goto("/settings")
    await page.getByRole("tab", { name: "Accounts" }).click()
    await page.getByRole("button", { name: "Add account" }).click()

    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Email").fill(emailB)
    await dialog.getByPlaceholder("Password").fill(passwordB)
    await dialog.getByRole("button", { name: "Add account" }).click()

    await expect(
      page.getByText("Account added. You can switch to it anytime"),
    ).toBeVisible()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByText(emailB)).toBeVisible()

    const accountBRow = page.locator("div.rounded-lg.border").filter({
      hasText: emailB,
    })
    await accountBRow.getByRole("button", { name: "Switch" }).click()
    await page.waitForURL("/")

    await page.goto("/issues")
    await expect(page.getByText(privateTitle)).not.toBeVisible()

    await page.goto("/settings")
    await page.getByRole("tab", { name: "Accounts" }).click()

    const accountARow = page.locator("div.rounded-lg.border").filter({
      hasText: emailA,
    })
    await accountARow.getByRole("button", { name: "Switch" }).click()
    await page.waitForURL("/")

    await page.goto("/issues")
    await expect(page.getByText(privateTitle)).toBeVisible()
  })
})
