import { expect, test, type Page } from "@playwright/test";

const JIRA_TEAM_EU26_URL = (
	process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"
) + "/jira-team-eu26";

async function openBoard(page: Page): Promise<void> {
	await page.goto(JIRA_TEAM_EU26_URL, { waitUntil: "domcontentloaded" });
	await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible({
		timeout: 15_000,
	});
	const expand = page.getByRole("button", { name: "Expand Unlink sessions column" });
	if (await expand.isVisible()) {
		await expand.click();
	}
	await expect(page.locator("[data-agent-session-column]")).toBeVisible();
}

test("Agent Sessions stays rounded and frozen while the status pane scrolls underneath", async ({ page }) => {
	await openBoard(page);
	const column = page.getByLabel(/^Unlink sessions,/u);
	const surface = page.locator("[data-agent-session-column-surface]");
	const scrollport = page.locator("[data-jira-kanban-scrollport]");
	const statusColumn = page.locator('[data-jira-kanban-column="To do"] > .group\\/board-column');
	const frozenLeft = (await column.boundingBox())?.x;

	await expect(surface).toHaveCSS(
		"border-radius",
		await statusColumn.evaluate((element) => getComputedStyle(element).borderRadius),
	);
	await expect(surface).toHaveCSS("box-shadow", "none");
	await expect(surface).toHaveCSS("transition-duration", "0.15s, 0.15s");
	await scrollport.evaluate((element) => {
		element.scrollTo({ behavior: "instant", left: 400 });
	});
	await expect.poll(() => scrollport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
	expect((await column.boundingBox())?.x).toBe(frozenLeft);
	await expect(surface).not.toHaveCSS("box-shadow", "none");

	await scrollport.evaluate((element) => {
		element.scrollTo({ behavior: "instant", left: 0 });
	});
	await expect(surface).toHaveCSS("box-shadow", "none");
});

test("the underlap shadow changes without a tween when reduced motion is requested", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await openBoard(page);
	const surface = page.locator("[data-agent-session-column-surface]");
	const scrollport = page.locator("[data-jira-kanban-scrollport]");
	await expect.poll(() => surface.evaluate((element) => (
		Number.parseFloat(getComputedStyle(element).transitionDuration)
	))).toBeLessThanOrEqual(0.001);

	await scrollport.evaluate((element) => {
		element.scrollTo({ behavior: "instant", left: 400 });
	});
	await expect(surface).not.toHaveCSS("box-shadow", "none");
});

test("Background color paints the board grey and keeps Agent Sessions white", async ({ page }) => {
	await openBoard(page);
	const board = page.locator("[data-jira-team-eu26-board-surface]");
	const surface = page.locator("[data-agent-session-column-surface]");
	const initialBoardColor = await board.evaluate((element) => getComputedStyle(element).backgroundColor);
	const agentSurfaceColor = await surface.evaluate((element) => getComputedStyle(element).backgroundColor);
	expect(initialBoardColor).toBe(agentSurfaceColor);

	await page.getByRole("button", { name: "Settings" }).click();
	await page.getByRole("menuitemcheckbox", { name: "Background color" }).click();
	await expect.poll(() => board.evaluate((element) => getComputedStyle(element).backgroundColor))
		.not.toBe(agentSurfaceColor);
	await expect.poll(() => surface.evaluate((element) => getComputedStyle(element).backgroundColor))
		.toBe(agentSurfaceColor);
});
