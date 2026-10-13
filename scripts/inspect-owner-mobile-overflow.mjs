import { chromium } from "playwright";

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto("http://127.0.0.1:3000/?qaAccount=owner&qaOwnerSection=intake#admin", { waitUntil: "networkidle" });
  const result = await page.evaluate(() => {
    const viewport = window.innerWidth;
    const offenders = [...document.querySelectorAll("body *")]
      .map(element => ({ tag: element.tagName, text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80), right: Math.round(element.getBoundingClientRect().right), left: Math.round(element.getBoundingClientRect().left), className: typeof element.className === "string" ? element.className.slice(0, 100) : "" }))
      .filter(item => item.right > viewport + 1 || item.left < -1)
      .slice(0, 20);
    return { viewport, scrollWidth: document.documentElement.scrollWidth, offenders };
  });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
