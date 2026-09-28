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

for (const width of [1024, 1440]) {
	test(`short session columns leave scrolled Jira content visible and clickable below them at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 1100 });
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.goto(JIRA_TEAM_EU26_URL, { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible();
		if (width === 1440) await page.getByRole("button", { name: "Expand sidebar" }).click();
		await expandUnlink(page);
		const column = page.locator("[data-agent-session-column]");
		await column.hover();
		// Dismiss sessions through their menu without filtering the Jira cards.
		while (await column.locator('[data-testid^="agent-session-row-"]').count() > 2) {
			const more = column.getByRole("button", { name: /^More actions for/u }).first();
			await more.focus();
			await more.press("Enter");
			await page.getByRole("menuitem", { name: "Dismiss", exact: true }).click();
		}
		const surface = page.locator("[data-agent-session-column-surface]");
		const board = page.locator("[data-jira-kanban-scrollport]");
		const columnBox = await column.boundingBox();
		const boardBox = await board.boundingBox();
		expect(columnBox).not.toBeNull();
		expect(boardBox).not.toBeNull();
		if (!columnBox || !boardBox) return;
		expect(boardBox.y + boardBox.height - columnBox.y - columnBox.height).toBeGreaterThan(100);
		expect(boardBox.x).toBeLessThanOrEqual(columnBox.x);
		const frozenLeft = columnBox.x;
		await board.evaluate((element) => { element.scrollLeft = 400; });
		await expect(surface).not.toHaveCSS("box-shadow", "none");
		expect((await column.boundingBox())?.x).toBe(frozenLeft);
		const hit = await page.evaluate(() => {
			const panel = document.querySelector("[data-agent-session-column-surface]")!.getBoundingClientRect();
			const x = panel.left + panel.width / 2;
			const y = panel.bottom + 60;
			const target = document.elementFromPoint(x, y);
			return {
				x,
				y,
				column: target?.closest("[data-jira-kanban-column]")?.getAttribute("data-jira-kanban-column"),
				card: target?.closest("[data-issue-key]")?.getAttribute("data-issue-key"),
			};
		});
		expect(hit.column, JSON.stringify(hit)).toBeTruthy();
		expect(hit.card).toBeTruthy();
		const scrollLeft = await board.evaluate((element) => element.scrollLeft);
		await page.mouse.move(hit.x, hit.y);
		await page.mouse.wheel(-80, 0);
		await expect.poll(() => board.evaluate((element) => element.scrollLeft)).toBeLessThan(scrollLeft);
		await page.getByRole("heading", { name: "Jira Design" }).hover();
		await page.screenshot({ path: `output/agent-browser/short-session-underlap-${width}.png` });
	});
}

test("board spacing follows session resizing and collapse without clipping the scrollport", async ({ page }) => {
	await page.setViewportSize({ width: 1024, height: 900 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await openBoard(page);
	await page.getByRole("button", { name: "Settings", exact: true }).click();
	await page.getByRole("menuitemcheckbox", { name: "Dragging", exact: true }).click();
	await page.getByRole("button", { name: "Settings", exact: true }).click();
	const column = page.locator("[data-agent-session-column]");
	const handle = page.getByRole("separator", { name: "Resize Unlink sessions column" });
	for (const key of ["End", "Home"]) {
		await handle.press(key);
		await expect(column).toHaveCSS("width", key === "End" ? "560px" : "280px");
		await expect.poll(() => page.evaluate(() => {
			const panel = document.querySelector("[data-agent-session-column-surface]")!.getBoundingClientRect();
			const status = document.querySelector('[data-jira-kanban-column="To do"] > div')!.getBoundingClientRect();
			const board = document.querySelector("[data-jira-kanban-scrollport]")!.getBoundingClientRect();
			return { gap: status.left - panel.right, boardCoversPanel: board.left <= panel.left };
		})).toEqual({ gap: 16, boardCoversPanel: true });
	}
	await collapseUnlink(page);
	await expect(column).toHaveCSS("width", "32px");
});

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

test("the Jira shell stays anchored with visible left chrome while the board scrolls", async ({ page }) => {
	await page.setViewportSize({ width: 1155, height: 768 });
	await openBoard(page);
	const shell = page.locator('[data-slot="sidebar-wrapper"]');
	const create = page.getByRole("button", { name: "Create", exact: true });
	const initialNavTop = (await create.boundingBox())?.y;
	if (initialNavTop === undefined) throw new Error("Expected the top navigation Create button");
	for (const name of ["Expand sidebar", "Open Jira"]) {
		const control = page.getByRole("button", { name, exact: true });
		const receivesPointer = await control.evaluate((element) => {
			const rect = element.getBoundingClientRect();
			const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
			return element.contains(hit);
		});
		expect(receivesPointer, `${name} must paint above the sticky header`).toBe(true);
	}

	// Offscreen chrome can enlarge the shell's scroll extent. It must not make
	// the shell itself a scroll owner, even when a focus scroll targets it.
	const forcedScroll = await shell.evaluate((element) => {
		const root = element as HTMLElement;
		const previousPosition = root.style.position;
		root.style.position = "relative";
		const offscreenChrome = document.createElement("div");
		offscreenChrome.style.cssText = "position:absolute;left:200vw;top:200vh;width:1px;height:1px;pointer-events:none";
		root.append(offscreenChrome);
		root.scrollTo({ left: 96, top: 56, behavior: "instant" });
		const createButton = Array.from(root.querySelectorAll("button"))
			.find((button) => button.textContent?.trim() === "Create");
		const result = {
			offscreenX: offscreenChrome.getBoundingClientRect().left > root.getBoundingClientRect().right,
			offscreenY: offscreenChrome.getBoundingClientRect().top > root.getBoundingClientRect().bottom,
			scrollLeft: root.scrollLeft,
			scrollTop: root.scrollTop,
			navTop: createButton?.getBoundingClientRect().top,
		};
		offscreenChrome.remove();
		root.style.position = previousPosition;
		root.scrollTo({ left: 0, top: 0, behavior: "instant" });
		return result;
	});
	expect(forcedScroll.offscreenX).toBe(true);
	expect(forcedScroll.offscreenY).toBe(true);
	expect(forcedScroll.scrollLeft).toBe(0);
	expect(forcedScroll.scrollTop).toBe(0);
	expect(forcedScroll.navTop).toBeCloseTo(initialNavTop, 0);

	const board = page.locator("[data-jira-kanban-scrollport]");
	const boardScroll = await board.evaluate((element) => {
		element.scrollLeft = element.scrollWidth;
		return element.scrollLeft;
	});
	expect(boardScroll).toBeGreaterThan(0);
	expect(await shell.evaluate((element) => ({ left: element.scrollLeft, top: element.scrollTop })))
		.toEqual({ left: 0, top: 0 });
	expect((await create.boundingBox())?.y).toBeCloseTo(initialNavTop, 0);
});
