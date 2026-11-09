import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({
  executablePath: "C:\\Users\\Lecoo\\AppData\\Local\\ms-playwright\\chromium-1243\\chrome-win64\\chrome.exe",
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto("file:///" + path.join(here, "index.html").replace(/\\/g, "/"));
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);
const frames = await page.$$(".frame");
for (let i = 0; i < frames.length; i++) {
  await frames[i].screenshot({ path: path.join(here, `sf${i + 1}.png`) });
  console.log(`sf${i + 1}.png done`);
}
await browser.close();
