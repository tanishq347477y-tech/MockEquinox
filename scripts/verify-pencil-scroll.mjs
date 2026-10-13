import { chromium } from "playwright";

const executablePath = process.env.CHROMIUM_PATH || "/usr/bin/chromium";
const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });
  const startOffset = await page.locator(".landing-pencil-stroke").evaluate(element => Number.parseFloat(getComputedStyle(element).strokeDashoffset));
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(180);
  await page.screenshot({ path: "/home/ubuntu/screenshots/mocke-pencil-bottom-desktop.png", fullPage: false });
  const end = await page.locator(".landing-pencil-stroke").evaluate(element => ({ offset: Number.parseFloat(getComputedStyle(element).strokeDashoffset), standReached: document.querySelector(".landing-pen-stand")?.classList.contains("is-reached") }));
  if (!(startOffset > 0.7) || !(end.offset < 0.1) || !end.standReached) throw new Error(`Unexpected scroll pencil state: ${JSON.stringify({ startOffset, end })}`);
  console.log(`PASS desktop scroll: stroke ${startOffset.toFixed(2)} → ${end.offset.toFixed(2)}, pen stand reached`);
  await page.close();

  const reduced = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await reduced.goto("http://127.0.0.1:3000/?motion=reduce", { waitUntil: "networkidle" });
  await reduced.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await reduced.waitForTimeout(80);
  await reduced.screenshot({ path: "/home/ubuntu/screenshots/mocke-pencil-bottom-mobile-reduced.png", fullPage: false });
  const staticState = await reduced.locator(".landing-pencil-stroke").evaluate(element => ({ offset: Number.parseFloat(getComputedStyle(element).strokeDashoffset), standReached: document.querySelector(".landing-pen-stand")?.classList.contains("is-reached") }));
  if (!(staticState.offset < 0.1) || !staticState.standReached) throw new Error(`Unexpected reduced-motion pencil state: ${JSON.stringify(staticState)}`);
  console.log(`PASS mobile reduced motion: stroke ${staticState.offset.toFixed(2)}, pen stand visible`);
  await reduced.close();
} finally {
  await browser.close();
}
