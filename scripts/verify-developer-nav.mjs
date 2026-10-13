import { chromium } from "playwright";

const executablePath = process.env.CHROMIUM_PATH || "/usr/bin/chromium";
const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });

try {
  const signedOut = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await signedOut.goto("http://127.0.0.1:3000/?qaAccount=signed-out", { waitUntil: "networkidle" });
  if (await signedOut.getByRole("button", { name: "Developer" }).count()) throw new Error("Developer navigation appeared for signed-out state");
  console.log("PASS signed-out state: Developer navigation hidden");
  await signedOut.close();

  const learner = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await learner.goto("http://127.0.0.1:3000/?qaAccount=learner", { waitUntil: "networkidle" });
  if (await learner.getByRole("button", { name: "Developer" }).count()) throw new Error("Developer navigation appeared for learner state");
  console.log("PASS learner state: Developer navigation hidden");
  await learner.close();

} finally {
  await browser.close();
}
