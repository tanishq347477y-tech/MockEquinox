import { chromium } from "playwright";

const baseUrl = "http://127.0.0.1:3000/?qaAccount=owner#admin";
const executablePath = process.env.CHROMIUM_PATH || "/usr/bin/chromium";
const scenarios = [
  { viewport: { width: 1440, height: 900 }, label: "desktop" },
  { viewport: { width: 390, height: 844 }, label: "mobile" },
];
const panels = [
  { nav: "Source intake", heading: "Bring source material into review." },
  { nav: "Question bank", heading: "Create, revise, publish, archive." },
  { nav: "Exam catalogue", heading: "Build the exam hierarchy." },
  { nav: "User access", heading: "Manage account roles." },
];

const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
try {
  for (const scenario of scenarios) {
    const page = await browser.newPage({ viewport: scenario.viewport });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    for (const panel of panels) {
      await page.getByRole("button", { name: panel.nav, exact: true }).first().click();
      await page.getByRole("heading", { name: panel.heading, exact: true }).waitFor();
      console.log(`PASS ${scenario.label}: ${panel.nav} panel opened`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
