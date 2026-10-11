import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("compact record drawer keeps the graph visible behind it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 552, height: 572 });
  await page.goto("/app?mode=demo");
  await page
    .getByLabel(
      "Decision: Change authentication token handling. Press Enter to view record.",
      { exact: true },
    )
    .dblclick();
  await expect(
    page.getByRole("dialog", { name: "Contextual panel" }),
  ).toBeVisible();
  await expect(page.locator("#main")).toHaveCSS("visibility", "visible");
  await expect(page.locator(".graph-node").first()).toHaveCSS(
    "visibility",
    "visible",
  );
  await expect(page.locator("#main")).toHaveAttribute("inert", "");
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: "test-results/drawer-background-fixed.png" });
  await page
    .getByRole("button", { name: "Dismiss contextual panel" })
    .click({ position: { x: 20, y: 100 } });
  await expect(
    page.getByRole("dialog", { name: "Contextual panel" }),
  ).toHaveCount(0);
  await expect(page.locator("#main")).not.toHaveAttribute("inert", "");
  expect(
    await page.locator("body").evaluate((body) => body.style.overflow),
  ).toBe("");
});
test("graph selection stays on the clicked record across panel updates", async ({
  page,
}) => {
  await page.goto("/app?mode=demo");
  const selections = [
    ["Component", "Authentication"],
    ["Decision", "Change authentication token handling"],
    ["Dependency", "Token library"],
    ["Bug", "API returned 401 after token changes"],
    ["Fix", "Align token validation"],
    ["Evidence", "Validation checklist"],
    ["Component", "API middleware"],
  ];
  for (const [kind, title] of selections) {
    const node = page.getByLabel(
      `${kind}: ${title}. Press Enter to view record.`,
      { exact: true },
    );
    await node.dblclick();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    const selectedUrl = page.url();
    // Allow delayed URL updates and selection effects to expose a stale-selection loop.
    for (let sample = 0; sample < 3; sample++) {
      await page.waitForTimeout(200);
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      expect(page.url()).toBe(selectedUrl);
      await expect(node).toHaveClass(/selected/);
      await expect(page.locator(".react-flow__node.selected")).toHaveCount(1);
    }
  }
  await page.getByRole("button", { name: "Close contextual panel" }).click();
  await page
    .getByLabel(
      "Decision: Change authentication token handling. Press Enter to view record.",
      { exact: true },
    )
    .press("Enter");
  await expect(
    page.getByRole("heading", {
      name: "Change authentication token handling",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/graph-selection-fixed.png",
    fullPage: true,
  });
});
test("desktop demo: graph, evidence, CRUD, relationships, persistence and reset", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your codebase remembers why." }),
  ).toBeVisible();
  await expect(page.locator(".welcome-copy")).toHaveCSS("opacity", "1");
  await expect(page.locator(".memory-preview")).toHaveCSS("opacity", "1");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: "test-results/welcome-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Explore demo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Follow the reasoning." }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Interactive project memory graph" }),
  ).toBeVisible();
  await expect(page.locator(".graph-node").first()).toBeVisible();
  await page.screenshot({
    path: "test-results/workspace-desktop.png",
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page
    .getByRole("link", { name: "Debug assistant", exact: true })
    .click();
  await page.getByRole("button", { name: "Trace the connection" }).click();
  await expect(
    page.getByText("LOCAL DEMO · SCRIPTED EXPLANATION").first(),
  ).toBeVisible();
  await expect(
    page.getByText(/Connected records show a plausible route/).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Validation checklist" })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Validation checklist", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Memory", exact: true }).click();
  await page.getByRole("button", { name: "Add memory", exact: true }).click();
  await page
    .getByLabel("Record type", { exact: true })
    .selectOption("Component");
  await page.getByLabel("Name", { exact: true }).fill("Browser test component");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Persistence from the browser");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Browser test component", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Browser test component", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit selected record" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Edited test component");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Edited test component", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Connect records", exact: true })
    .click();
  await page
    .getByLabel("Source record")
    .selectOption({ label: "Component · Edited test component" });
  await page
    .getByLabel("Relationship", { exact: true })
    .selectOption("DEPENDS_ON");
  await page
    .getByLabel("Target record")
    .selectOption({ label: "Dependency · Token library" });
  await page
    .getByRole("button", { name: "Create relationship", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Delete depends on relationship" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete selected record" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Edited test component", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete selected record" }).click();
  await page
    .getByRole("button", { name: "Confirm deletion", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Edited test component", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm deletion", exact: true })
    .click();
  await page.getByRole("link", { name: "Memory", exact: true }).click();
  await page.getByRole("button", { name: "Add memory", exact: true }).click();
  await page.getByLabel("Record type", { exact: true }).selectOption("Reason");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByText("Enter a reason")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "All records", exact: false }).click();
  await page
    .getByRole("searchbox", { name: "Search memory" })
    .fill("no-such-record");
  await expect(
    page.getByRole("heading", { name: "No records here yet." }),
  ).toBeVisible();
  const denied = await page.request.get("/api/projects");
  expect(denied.status()).toBe(401);
});
test("mobile layout, navigation, keyboard drawer and reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Explore demo", exact: true }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: "test-results/welcome-mobile.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Explore demo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Follow the reasoning." }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Interactive project memory graph" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/workspace-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Show contextual panel" }).click();
  await expect(
    page.getByRole("dialog", { name: "Contextual panel" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Contextual panel" }),
  ).toHaveCount(0);
  await page
    .getByLabel("Component: Authentication. Press Enter to view record.", {
      exact: true,
    })
    .dblclick();
  await expect(
    page.getByRole("heading", { name: "Authentication", exact: true }),
  ).toBeVisible();
  const mobileSelectionUrl = page.url();
  await page.waitForTimeout(600);
  await expect(
    page.getByRole("heading", { name: "Authentication", exact: true }),
  ).toBeVisible();
  expect(page.url()).toBe(mobileSelectionUrl);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("link", { name: "Debug assistant", exact: true })
    .click();
  await page.getByRole("button", { name: "Trace the connection" }).click();
  await expect(
    page.getByText("LOCAL DEMO · SCRIPTED EXPLANATION").first(),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: "test-results/answer-mobile.png",
    fullPage: true,
  });
});

test("compact graph separates selection, dragging and opening details", async ({ page }) => {
  await page.setViewportSize({ width: 602, height: 572 });
  await page.goto("/app?mode=demo");
  const node = page.getByLabel("Decision: Change authentication token handling. Press Enter to view record.", { exact: true });
  await node.click();
  await expect(node).toHaveClass(/selected/);
  await expect(page.getByRole("dialog", { name: "Contextual panel" })).toHaveCount(0);
  await page.evaluate(() => {
    const state = { frames: 0, disrupted: false };
    (window as unknown as { dragCheck: typeof state }).dragCheck = state;
    const sample = () => {
      const main = document.querySelector("#main");
      const graph = document.querySelector(".react-flow__viewport");
      state.frames++;
      if (!main || !graph || getComputedStyle(main).visibility !== "visible" || document.querySelector(".context-backdrop")) state.disrupted = true;
      if (state.frames < 180) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  const before = await node.getAttribute("style");
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 65, box!.y + box!.height / 2 + 45, { steps: 25 });
  await page.mouse.up();
  await expect(node).not.toHaveAttribute("style", before!);
  await expect(page.getByRole("dialog", { name: "Contextual panel" })).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { dragCheck: { disrupted: boolean } }).dragCheck.disrupted)).toBe(false);
  await node.dblclick();
  await expect(page.getByRole("dialog", { name: "Contextual panel" })).toBeVisible();
  await page.keyboard.press("Escape");
  await node.press("Enter");
  await expect(page.getByRole("dialog", { name: "Contextual panel" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open selected record", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Contextual panel" })).toBeVisible();
});
