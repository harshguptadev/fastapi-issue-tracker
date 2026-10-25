import { expect, test } from "@playwright/test"
import { createUser } from "./utils/privateApi"
import {
  randomEmail,
  randomIssueDescription,
  randomIssueTitle,
  randomPassword,
} from "./utils/random"
import { logInUser, logOutUser } from "./utils/user"

test("Issues page is accessible and shows correct title", async ({ page }) => {
  await page.goto("/issues")
  await expect(page.getByRole("heading", { name: "Issues" })).toBeVisible()
  await expect(page.getByText("Create and manage your issues")).toBeVisible()
})

test("Add Issue button is visible", async ({ page }) => {
  await page.goto("/issues")
  await expect(page.getByRole("button", { name: "Add Issue" })).toBeVisible()
})

test.describe("Issues management", () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  let email: string
  const password = randomPassword()

  test.beforeAll(async () => {
    email = randomEmail()
    await createUser({ email, password })
  })

  test.beforeEach(async ({ page }) => {
    await logInUser(page, email, password)
    await page.goto("/issues")
  })

  test("Create a new issue successfully", async ({ page }) => {
    const title = randomIssueTitle()
    const description = randomIssueDescription()

    await page.getByRole("button", { name: "Add Issue" }).click()
    await page.getByLabel("Title").fill(title)
    await page.getByLabel("Description").fill(description)
    await page.getByRole("button", { name: "Save" }).click()

    await expect(page.getByText("Issue created successfully")).toBeVisible()
    await expect(page.getByText(title)).toBeVisible()
  })

  test("Create issue with only required fields", async ({ page }) => {
    const title = randomIssueTitle()

    await page.getByRole("button", { name: "Add Issue" }).click()
    await page.getByLabel("Title").fill(title)
    await page.getByRole("button", { name: "Save" }).click()

    await expect(page.getByText("Issue created successfully")).toBeVisible()
    await expect(page.getByText(title)).toBeVisible()
  })

  test("Cancel issue creation", async ({ page }) => {
    await page.getByRole("button", { name: "Add Issue" }).click()
    await page.getByLabel("Title").fill("Test Issue")
    await page.getByRole("button", { name: "Cancel" }).click()

    await expect(page.getByRole("dialog")).not.toBeVisible()
  })

  test("Title is required", async ({ page }) => {
    await page.getByRole("button", { name: "Add Issue" }).click()
    await page.getByLabel("Title").fill("")
    await page.getByLabel("Title").blur()

    await expect(page.getByText("Title is required")).toBeVisible()
  })

  test.describe("Edit and Delete", () => {
    let issueTitle: string

    test.beforeEach(async ({ page }) => {
      issueTitle = randomIssueTitle()

      await page.getByRole("button", { name: "Add Issue" }).click()
      await page.getByLabel("Title").fill(issueTitle)
      await page.getByRole("button", { name: "Save" }).click()
      await expect(page.getByText("Issue created successfully")).toBeVisible()
      await expect(page.getByRole("dialog")).not.toBeVisible()
    })

    test("Edit an issue successfully", async ({ page }) => {
      const issueRow = page.getByRole("row").filter({ hasText: issueTitle })
      await issueRow.getByRole("button").last().click()
      await page.getByRole("menuitem", { name: "Edit Issue" }).click()

      const updatedTitle = randomIssueTitle()
      await page.getByLabel("Title").fill(updatedTitle)
      await page.getByRole("button", { name: "Save" }).click()

      await expect(page.getByText("Issue updated successfully")).toBeVisible()
      await expect(page.getByText(updatedTitle)).toBeVisible()
    })

    test("Delete an issue successfully", async ({ page }) => {
      const issueRow = page.getByRole("row").filter({ hasText: issueTitle })
      await issueRow.getByRole("button").last().click()
      await page.getByRole("menuitem", { name: "Delete Issue" }).click()

      await page.getByRole("button", { name: "Delete" }).click()

      await expect(
        page.getByText("The issue was deleted successfully"),
      ).toBeVisible()
      await expect(page.getByText(issueTitle)).not.toBeVisible()
    })
  })

  test.describe("Filters", () => {
    test("Filtering by status hides issues in other statuses", async ({
      page,
    }) => {
      const title = randomIssueTitle()
      await page.getByRole("button", { name: "Add Issue" }).click()
      await page.getByLabel("Title").fill(title)
      await page.getByRole("button", { name: "Save" }).click()
      await expect(page.getByText("Issue created successfully")).toBeVisible()

      await page.getByLabel("Filter by status").click()
      await page.getByRole("option", { name: "Done" }).click()
      await expect(page.getByText(title)).not.toBeVisible()

      await page.getByLabel("Filter by status").click()
      await page.getByRole("option", { name: "All statuses" }).click()
      await expect(page.getByText(title)).toBeVisible()
    })
  })

  test.describe("Comments", () => {
    test("Add a comment on an issue", async ({ page }) => {
      const title = randomIssueTitle()
      await page.getByRole("button", { name: "Add Issue" }).click()
      await page.getByLabel("Title").fill(title)
      await page.getByRole("button", { name: "Save" }).click()
      await expect(page.getByText("Issue created successfully")).toBeVisible()

      await page.getByText(title).click()
      await expect(
        page.getByRole("heading", { name: "Comments" }),
      ).toBeVisible()

      const commentText = `Looks good ${Math.random().toString(36).substring(7)}`
      await page.getByPlaceholder("Add a comment...").fill(commentText)
      await page.getByRole("button", { name: "Comment" }).click()

      await expect(page.getByText(commentText)).toBeVisible()
    })
  })
})

test.describe("Issue sharing", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("Owner can share an issue and the shared user can comment on it", async ({
    page,
  }) => {
    const ownerEmail = randomEmail()
    const ownerPassword = randomPassword()
    await createUser({ email: ownerEmail, password: ownerPassword })

    const sharedEmail = randomEmail()
    const sharedPassword = randomPassword()
    await createUser({ email: sharedEmail, password: sharedPassword })

    await logInUser(page, ownerEmail, ownerPassword)
    await page.goto("/issues")

    const title = randomIssueTitle()
    await page.getByRole("button", { name: "Add Issue" }).click()
    await page.getByLabel("Title").fill(title)
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByText("Issue created successfully")).toBeVisible()

    await page.getByText(title).click()
    await page.getByRole("button", { name: "Share" }).click()
    const shareDialog = page.getByRole("dialog")
    await shareDialog.getByLabel("Email").fill(sharedEmail)
    await shareDialog.getByRole("button", { name: "Share" }).click()
    await expect(page.getByText("Issue shared successfully")).toBeVisible()
    await expect(page.getByText(sharedEmail)).toBeVisible()

    const issueUrl = page.url()

    await shareDialog.getByRole("button", { name: "Close" }).click()
    await expect(shareDialog).not.toBeVisible()

    await logOutUser(page)
    await logInUser(page, sharedEmail, sharedPassword)
    await page.goto(issueUrl)

    await expect(page.getByRole("heading", { name: title })).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Share" }),
    ).not.toBeVisible()

    const commentText = `Thanks for sharing ${Math.random()
      .toString(36)
      .substring(7)}`
    await page.getByPlaceholder("Add a comment...").fill(commentText)
    await page.getByRole("button", { name: "Comment" }).click()
    await expect(page.getByText(commentText)).toBeVisible()
  })
})

test.describe("Issues empty state", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("Shows empty state message when no issues exist", async ({ page }) => {
    const email = randomEmail()
    const password = randomPassword()
    await createUser({ email, password })
    await logInUser(page, email, password)

    await page.goto("/issues")

    await expect(
      page.getByText("You don't have any issues yet"),
    ).toBeVisible()
    await expect(page.getByText("Add a new issue to get started")).toBeVisible()
  })
})
