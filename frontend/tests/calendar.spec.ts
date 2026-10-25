import { expect, test } from "@playwright/test"

import { createUser } from "./utils/privateApi"
import { randomEmail, randomIssueTitle, randomPassword } from "./utils/random"
import { logInUser } from "./utils/user"

function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatDueDate(dueDate: string): string {
  return new Date(`${dueDate}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

test.describe("Calendar workflow", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("Create issue with due date, open from calendar, and view details", async ({
    page,
  }) => {
    const email = randomEmail()
    const password = randomPassword()
    const title = randomIssueTitle()
    const dueDate = toISODate(new Date())

    await createUser({ email, password })
    await logInUser(page, email, password)

    await page.goto("/issues")
    await page.getByRole("button", { name: "Add Issue" }).click()
    await page.getByLabel("Title").fill(title)
    await page.getByLabel("Due date").fill(dueDate)
    await page.getByRole("button", { name: "Save" }).click()

    await expect(page.getByText("Issue created successfully")).toBeVisible()
    await expect(page.getByRole("dialog")).not.toBeVisible()

    await page.goto("/calendar")
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible()

    const calendarIssueLink = page.getByRole("link", { name: title })
    await expect(calendarIssueLink).toBeVisible()
    await calendarIssueLink.click()

    await expect(page).toHaveURL(/\/issues\/[^/]+$/)
    await expect(page.getByRole("heading", { name: title })).toBeVisible()
    await expect(page.getByText("No due date")).not.toBeVisible()
    await expect(page.getByText(formatDueDate(dueDate))).toBeVisible()
  })
})
