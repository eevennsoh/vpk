import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1600, height: 1100 }, ignoreHTTPSErrors: true });

async function addAgent(page: Page, surface: "Board" | "List" | "Work item", name: "Claude (Recommended)" | "Cursor") {
	if (surface === "Work item") {
		const item = page.getByRole("region", { name: "Work item full screen view" });
		await item.getByRole("group", { name: "Agents field" }).getByRole("button", { name: /^\d+ agents?$/u }).click();
		await page.getByRole("dialog", { name: "Add agent" }).getByRole("button", { name, exact: true }).click();
	} else {
		const area = surface === "List" ? page.getByRole("region", { name: "Payments SDK v2 migration work items list" }) : page.locator('[data-issue-key="PAY-118"][data-board-column-title]');
		const trigger = area.getByRole("button", { name: "Add agent to PAY-118", exact: true });
		if (surface === "Board") {
			await trigger.focus();
			await trigger.press("Enter");
		} else await trigger.click();
		await page.getByRole("dialog", { name: "Agents" }).getByRole("button", { name, exact: true }).click();
	}
}

for (const surface of ["Board", "List", "Work item"] as const) {
	test(`adding an agent plays the Rovo logo cycle in ${surface}`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "no-preference" });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("button", { name: `Select ${surface}`, exact: true }).click();
		const launcher = page.getByRole("button", { name: "Open Rovo chat", exact: true });
		await expect(launcher).toBeVisible();
		await expect(launcher.locator("svg linearGradient")).toHaveCount(0);
		await addAgent(page, surface, "Claude (Recommended)");
		await expect(page.getByRole("button", { name: "Claude added", exact: true })).toBeVisible();
		await expect(launcher.locator("svg linearGradient")).toHaveCount(2);
		const movingFacet = launcher.locator("svg g[mask] > g").first();
		const initialTransform = await movingFacet.getAttribute("style");
		await expect.poll(() => movingFacet.getAttribute("style")).not.toBe(initialTransform);
		await expect(launcher.locator("svg linearGradient")).toHaveCount(0, { timeout: 6000 });
	});
}

test("another agent addition restarts an in-progress Rovo cycle", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List", exact: true }).click();
	const launcher = page.getByRole("button", { name: "Open Rovo chat", exact: true });
	await addAgent(page, "List", "Claude (Recommended)");
	await expect(launcher.locator("svg linearGradient")).toHaveCount(2);
	const firstCycle = await launcher.locator("svg linearGradient").first().getAttribute("id");
	await addAgent(page, "List", "Cursor");
	await expect(page.getByRole("button", { name: "Cursor added", exact: true })).toBeVisible();
	await expect.poll(() => launcher.locator("svg linearGradient").first().getAttribute("id")).not.toBe(firstCycle);
	await expect(launcher.locator("svg linearGradient")).toHaveCount(0, { timeout: 6000 });
});

test("agent arrival keeps the Rovo logo still with reduced motion", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List", exact: true }).click();
	await addAgent(page, "List", "Claude (Recommended)");
	await expect(page.getByRole("button", { name: "Claude added", exact: true })).toBeVisible();
	const launcher = page.getByRole("button", { name: "Open Rovo chat", exact: true });
	await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
	await expect(launcher.locator("svg linearGradient")).toHaveCount(0);
	await expect(launcher.locator("svg")).toBeVisible();
});
