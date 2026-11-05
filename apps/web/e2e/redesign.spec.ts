import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";

// The flows the 2026-11 redesign added, run against the real API like the smoke test.

const fixture = (path: string) =>
  new URL(`../../../fixtures/${path}`, import.meta.url).pathname;

const stat = (page: Page, label: string) =>
  page.getByRole("group", { name: label, exact: true }).locator("p");

test("a list with errors: verdict, grouped issues, issue list download, export locked", async ({
  page,
}) => {
  await page.goto("/");
  // Choosing a file starts the check by itself.
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles(fixture("input/all-rules.csv"));
  await expect(
    page.getByText("13 errors to fix before converting"),
  ).toBeVisible();
  await expect(stat(page, "Errors")).toHaveText("13");
  await expect(stat(page, "Warnings")).toHaveText("6");
  // Without a block, the report says which checks did not run.
  await expect(
    page.getByText("Without block details, these checks did not run"),
  ).toBeVisible();
  // Issues name the guest and offer a fix where a setting is the cause.
  await page.getByRole("searchbox", { name: "Search issues" }).fill("rossi");
  await expect(
    page.getByText(
      "shares with line 99, but there is no line 99. Fix the line number.",
    ),
  ).toBeVisible();
  await page.getByRole("searchbox", { name: "Search issues" }).fill("");
  await page.getByText("By check", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Sharer points at a missing line/ }),
  ).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save issue list (CSV)" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("all-rules-issues.csv");
  const csv = await readFile(await download.path(), "utf8");
  expect(csv).toContain('12,Error,"Rossi, Marco",Shares with (line),99,');

  await expect(page.getByText("Fix 13 errors to convert.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download" })).toBeDisabled();
});

test("columns: map an ignored column and validate again", async ({ page }) => {
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles(fixture("input/messy-headers.csv"));
  await expect(
    page.getByRole("status").filter({ hasText: "Validated:" }),
  ).toBeVisible();
  const roomsBefore = await stat(page, "Rooms").textContent();

  await page.getByRole("tab", { name: /Columns/ }).click();
  // "Roommate Line" is not a known header; reading it as the sharer column links the sharers.
  await page.getByLabel("Column Roommate Line").selectOption("sharesWithLine");
  await expect(
    page.getByText("Your settings changed since this report."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Validate again" }).click();
  await expect(
    page.getByText("Your settings changed since this report."),
  ).toBeHidden();
  await expect(page.getByText("Set by you")).toBeVisible();
  const roomsAfter = await stat(page, "Rooms").textContent();
  expect(Number(roomsAfter)).toBeLessThan(Number(roomsBefore));
});

test("block: occupancy per room type, and the block saved as a file", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Load sample" }).click();
  await expect(stat(page, "Room nights")).toHaveText("9");
  await page.getByText("Block details (optional)").click();
  await expect(page.getByLabel("KING")).toHaveValue("3");
  await page.getByLabel("KING").fill("1");
  await page.getByRole("button", { name: "Validate again" }).click();
  // Hiro Tanaka's KING room holds 3 people: R013 now fires.
  await expect(
    page.getByText(/3 people share this KING room, but it holds at most 1/),
  ).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save block file" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("TECH26.json");
  const saved = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(saved.maxOccupancy).toEqual({ KING: 1, QQ: 4 });
});

test("nights and guests tabs show the block window and the rooms", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Load sample" }).click();
  await expect(stat(page, "Room nights")).toHaveText("9");
  await page.getByRole("tab", { name: /Guests/ }).click();
  await expect(page.getByText("Marchetti, Elena")).toBeVisible();
  await page.getByRole("tab", { name: /Nights/ }).click();
  const grid = page.getByRole("table", { name: /Rooms needed per night/ });
  await expect(grid.locator("tfoot td")).toHaveText(["2", "3", "3", "1", "9"]);
  await expect(page.getByText("Block night", { exact: true })).toBeVisible();
});

test("compare: sample pair, change brief and handoff to Validate", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/compare");
  await page.getByRole("button", { name: "Load sample pair" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Compared: 3 added, 2 removed, 4 changed." }),
  ).toBeVisible();
  await expect(stat(page, "Room-night change")).toHaveText("+4");
  await expect(page.getByText("KING +5")).toBeVisible();
  await page.getByRole("button", { name: /^Removed/ }).click();
  await expect(page.getByText("Kowalski, Dana")).toBeVisible();
  await expect(page.getByText("Pereira, Quinn")).toBeHidden();

  await page.getByRole("button", { name: "Copy update for the hotel" }).click();
  const note = await page.evaluate(() => navigator.clipboard.readText());
  expect(note).toContain("Room nights 28 → 32 (+4).");

  // From Validate, the current list becomes the earlier one on Compare.
  await page.goto("/");
  await page.getByRole("button", { name: "Load sample" }).click();
  await expect(stat(page, "Room nights")).toHaveText("9");
  await page
    .getByRole("button", { name: "Compare with a newer version" })
    .click();
  await expect(page).toHaveURL(/\/compare$/);
  await expect(page.getByText("Chosen: we1.csv")).toBeVisible();
});

test("formats, guide and a missing page", async ({ page }) => {
  await page.goto("/formats");
  await expect(
    page.getByRole("heading", { name: "Export formats", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Maestro PMS (CSV)", level: 2 }),
  ).toBeVisible();
  await expect(page.getByText("A7", { exact: true })).toBeVisible();

  await page.goto("/guide");
  await expect(
    page.getByRole("heading", { name: "Every check" }),
  ).toBeVisible();
  await expect(page.locator("#R013")).toContainText(
    "Too many people in a room",
  );
  await expect(
    page.getByRole("link", { name: "Template (CSV)" }),
  ).toHaveAttribute("href", "/samples/rooming-list-template.csv");

  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "No room by that number" }),
  ).toBeVisible();
});
