import { expect, test, type Page } from "@playwright/test";

const JIRA_TEAM_EU26_URL = (
	process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"
) + "/jira-team-eu26";

async function expandUnlink(page: Page): Promise<void> {
	const expand = page.getByRole("button", { name: "Expand Unlink sessions column" });
	if (await expand.isVisible()) {
		await expand.click();
	}
	await expect(page.getByRole("button", { name: "Collapse Unlink sessions column" })).toBeVisible();
}

async function collapseUnlink(page: Page): Promise<void> {
	const collapse = page.getByRole("button", { name: "Collapse Unlink sessions column" });
	if (await collapse.isVisible()) {
		await collapse.click();
	}
	await expect(page.getByRole("button", { name: "Expand Unlink sessions column" })).toBeVisible();
}

async function openBoard(page: Page): Promise<void> {
	await page.goto(JIRA_TEAM_EU26_URL, { waitUntil: "domcontentloaded" });
	await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible({
		timeout: 15_000,
	});
	await expandUnlink(page);
	await expect(page.locator("[data-agent-session-column]")).toBeVisible();
}

async function measureCollapsedExpandHitArea(page: Page) {
	return page.evaluate(() => {
		const well = document.querySelector("[data-agent-session-column-surface]");
		const control = document.querySelector("[data-agent-session-column-expand-control]");
		if (!(well instanceof HTMLElement) || !(control instanceof HTMLElement)) {
			return null;
		}
		const wellRect = well.getBoundingClientRect();
		const controlRect = control.getBoundingClientRect();
		const sampleY = controlRect.top + controlRect.height / 2;
		const leftHit = document.elementFromPoint(wellRect.left - 8, sampleY)
			?.closest("[data-agent-session-column-expand-control]");
		return {
			contained: controlRect.left >= wellRect.left - 0.5
				&& controlRect.right <= wellRect.right + 0.5,
			overflowsStart: controlRect.left < wellRect.left - 0.5,
			leftHitsExpand: Boolean(leftHit),
			controlWidth: controlRect.width,
			wellWidth: wellRect.width,
		};
	});
}

test("Agent Sessions stays rounded and frozen while the status pane scrolls underneath", async ({ page }) => {
	await openBoard(page);
	const column = page.getByLabel(/^Unlink sessions,/u);
	const surface = page.locator("[data-agent-session-column-surface]");
	const wrap = page.locator('[data-board-agent-session-drop-zone="untracked"]');
	const scrollport = page.locator("[data-jira-kanban-scrollport]");
	const statusColumn = page.locator('[data-jira-kanban-column="To do"] > .group\\/board-column');
	const frozenLeft = (await column.boundingBox())?.x;

	await expect(surface).toHaveCSS(
		"border-radius",
		await statusColumn.evaluate((element) => getComputedStyle(element).borderRadius),
	);
	await expect(surface).toHaveCSS("box-shadow", "none");
	await expect(surface).not.toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
	await expect(surface).toHaveCSS("margin-top", "0px");
	await expect(surface).toHaveCSS("margin-bottom", "0px");
	await expect(wrap).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
	await expect(wrap).toHaveCSS("box-shadow", "none");
	const restSurface = await surface.boundingBox();
	const restColumn = await column.boundingBox();
	await scrollport.evaluate((element) => {
		element.scrollTo({ behavior: "instant", left: 400 });
	});
	await expect.poll(() => scrollport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
	expect((await column.boundingBox())?.x).toBe(frozenLeft);
	await expect(surface).not.toHaveCSS("box-shadow", "none");
	await expect(surface).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
	await expect(wrap).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
	await expect(wrap).toHaveCSS("box-shadow", "none");
	await expect(surface).toHaveCSS("margin-top", "-8px");
	await expect(surface).toHaveCSS("margin-bottom", "-8px");
	const underlapSurface = await surface.boundingBox();
	const underlapColumn = await column.boundingBox();
	expect(underlapSurface?.height ?? 0).toBeGreaterThan(restSurface?.height ?? 0);
	expect(underlapColumn?.height).toBe(restColumn?.height);

	await scrollport.evaluate((element) => {
		element.scrollTo({ behavior: "instant", left: 0 });
	});
	await expect(surface).not.toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
	await expect(surface).toHaveCSS("margin-top", "0px");
	await expect(surface).toHaveCSS("margin-bottom", "0px");
	await expect.poll(async () => {
		const shadow = await surface.evaluate((element) => getComputedStyle(element).boxShadow);
		return shadow === "none" || /rgba\([^)]*,\s*0(?:\.0+)?\)/.test(shadow);
	}).toBe(true);

	await collapseUnlink(page);
	await expect(surface).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
	await expect(surface).toHaveCSS("box-shadow", "none");
	await expect.poll(async () => {
		const restHit = await measureCollapsedExpandHitArea(page);
		return restHit !== null
			&& restHit.overflowsStart
			&& restHit.leftHitsExpand
			&& restHit.controlWidth > restHit.wellWidth;
	}).toBe(true);
	const collapsedRestSurface = await surface.boundingBox();
	await scrollport.evaluate((element) => {
		element.scrollTo({ behavior: "instant", left: 400 });
	});
	await expect(surface).not.toHaveCSS("box-shadow", "none");
	await expect(surface).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
	await expect(wrap).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
	expect((await surface.boundingBox())?.height ?? 0).toBeGreaterThan(collapsedRestSurface?.height ?? 0);
	await expect.poll(async () => {
		const underlapHit = await measureCollapsedExpandHitArea(page);
		return underlapHit !== null
			&& underlapHit.contained
			&& !underlapHit.leftHitsExpand
			&& underlapHit.controlWidth < underlapHit.wellWidth;
	}).toBe(true);

	await scrollport.evaluate((element) => {
		element.scrollTo({ behavior: "instant", left: 0 });
	});
	await expandUnlink(page);
	await expect(surface).not.toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
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
