import { chromium } from "playwright";

const baseUrl = "http://127.0.0.1:3000";
const executablePath = process.env.CHROMIUM_PATH || "/usr/bin/chromium";
const scenarios = [
  { viewport: { width: 1440, height: 900 }, label: "desktop" },
  { viewport: { width: 390, height: 844 }, label: "mobile" },
];
const checks = [
  { label: "hero account", action: page => page.getByRole("button", { name: /^Create an account/ }).first().click(), expected: "#login" },
  { label: "exam library", action: page => page.getByRole("button", { name: /Explore the exam library/ }).click(), expected: "#exams" },
  { label: "pricing", action: page => page.getByRole("button", { name: /See mock packs/ }).click(), expected: "#pricing" },
  { label: "final study start", action: page => page.getByRole("button", { name: /^Create an account/ }).last().click(), expected: "#login" },
];

const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
try {
  for (const scenario of scenarios) {
    for (const check of checks) {
      const page = await browser.newPage({ viewport: scenario.viewport });
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await check.action(page);
      await page.waitForFunction(expected => window.location.hash === expected, check.expected);
      const actual = await page.evaluate(() => window.location.hash);
      if (actual !== check.expected) throw new Error(`${scenario.label} ${check.label}: expected ${check.expected}, received ${actual}`);
      console.log(`PASS ${scenario.label}: ${check.label} → ${actual}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
