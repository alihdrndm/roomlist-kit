// Renders docs/media/social-preview.html to the 1280×640 PNG that GitHub shows
// when the repo link is shared. Uses the Playwright Chromium the e2e tests use.
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const html = fileURLToPath(
  new URL("../docs/media/social-preview.html", import.meta.url),
);
const png = fileURLToPath(
  new URL("../docs/media/social-preview.png", import.meta.url),
);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 640 } });
await page.goto(pathToFileURL(html).href);
await page.screenshot({ path: png });
await browser.close();
console.log(`Wrote ${png}`);
