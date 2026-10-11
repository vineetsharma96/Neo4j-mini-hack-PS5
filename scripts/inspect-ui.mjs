import { chromium } from "@playwright/test";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("pageerror", (e) => console.log("UI error:", e.message));
await page.goto("http://127.0.0.1:3000/app?mode=demo&tab=graph");
await page
  .locator(".graph-node")
  .first()
  .waitFor({ state: "attached", timeout: 15000 });
console.log(
  await page.evaluate(() => ({
    nodes: document.querySelectorAll(".graph-node").length,
    node: document.querySelector(".react-flow__node")?.getAttribute("style"),
    viewport: document
      .querySelector(".react-flow__viewport")
      ?.getAttribute("style"),
  })),
);
await page.screenshot({
  path: "test-results/graph-inspection.png",
  fullPage: true,
});
await browser.close();
