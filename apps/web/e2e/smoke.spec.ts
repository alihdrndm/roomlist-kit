import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";

const expected = new URL(
  "../../../fixtures/expected/we1.maestro.csv",
  import.meta.url,
);

/** The number a tile shows, matched exactly (so 19 does not pass for 9). */
const tileValue = (page: Page, label: string) =>
  page.getByRole("group", { name: label }).locator("p");

test("WE1: load sample, validate, convert to Maestro and download the golden file", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Load sample" }).click();
  await expect(page.getByText("Chosen: we1.csv")).toBeVisible();

  await page.getByRole("button", { name: "Validate" }).click();
  await expect(tileValue(page, "Room nights")).toHaveText("9");
  await expect(tileValue(page, "Errors")).toHaveText("0");

  await page.getByLabel("Format").selectOption({ label: "Maestro PMS (CSV)" });
  await page.getByLabel("Building code").fill("MAIN");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("rooming-list-maestro.csv");
  const path = await download.path();
  const [actual, golden] = await Promise.all([
    readFile(path),
    readFile(expected),
  ]);
  expect(actual.equals(golden)).toBe(true);
});
