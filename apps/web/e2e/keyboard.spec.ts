import { expect, type Locator, type Page, test } from "@playwright/test";

/** Presses Tab until `target` has focus, as a keyboard user would; fails after 60 presses. */
async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let presses = 0; presses < 60; presses++) {
    if (
      await target.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error("The element was never reached with Tab.");
}

test("WE1: the validate and convert flow on / works with the keyboard only", async ({
  page,
}) => {
  await page.goto("/");

  // The first Tab reaches the skip link.
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();

  await tabTo(page, page.getByRole("button", { name: "Load sample" }));
  await page.keyboard.press("Enter");
  await expect(page.getByText("Chosen: we1.csv")).toBeVisible();

  // <details> opens with Enter on its summary.
  await tabTo(page, page.getByText("Block details (optional)"));
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Block code")).toBeVisible();

  await tabTo(page, page.getByRole("button", { name: "Validate" }));
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("group", { name: "Room nights" }).locator("p"),
  ).toHaveText("9");
  await expect(
    page.getByRole("status").filter({ hasText: "Validated: 0 errors" }),
  ).toBeVisible();

  const errorsFilter = page.getByRole("button", {
    name: "Errors",
    exact: true,
  });
  await tabTo(page, errorsFilter);
  await page.keyboard.press("Space");
  await expect(errorsFilter).toHaveAttribute("aria-pressed", "true");

  // A focused native select picks an option by typing its first letters.
  const format = page.getByLabel("Format");
  await tabTo(page, format);
  await page.keyboard.type("Maestro");
  await expect(format).toHaveValue("maestro-csv");
  await tabTo(page, page.getByLabel("Building code"));
  await page.keyboard.type("MAIN");

  const downloadPromise = page.waitForEvent("download");
  await tabTo(page, page.getByRole("button", { name: "Download" }));
  await page.keyboard.press("Enter");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("rooming-list-maestro.csv");
  await expect(
    page.getByRole("status").filter({ hasText: "Downloaded" }),
  ).toBeVisible();
});
