import { expect, test, type Locator, type Page } from "@playwright/test";

const origin = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const project = process.env.PLAYWRIGHT_JIRA_PROJECT ?? "jira-team-eu26";

async function openBoard(page: Page) {
	await page.setViewportSize({ width: 1440, height: 1100 });
	await page.goto(`${origin}/preview/projects/${project}`);
	await expect(page.getByRole("heading", { name: "Jira Design", exact: true })).toBeVisible();
	await expect(page.locator("[data-agent-session-column-expansion]")).toBeVisible();
	const expand = page.getByRole("button", { name: "Expand Unlink sessions column" });
	if (await expand.isVisible()) {
		await expand.click();
	} else if (!await page.getByRole("button", { name: "Collapse Unlink sessions column" }).isVisible()) {
		const options = page.getByRole("button", { name: "Unlink sessions column options" });
		await options.click();
		const pin = page.getByRole("menuitem", { name: "Pin", exact: true });
		if (await pin.isVisible()) {
			await pin.click();
			await options.click();
		}
		await page.getByRole("menuitem", { name: "Expand", exact: true }).click();
	}
	await expect(page.locator("[data-agent-session-column-expansion]"))
		.toHaveAttribute("data-agent-session-column-expansion", "expanded");
	await expect(page.locator("[data-agent-session-column]")).toHaveCSS("width", "280px");
	await page.getByRole("heading", { name: "Jira Design", exact: true }).hover();
	await expect(page.locator('[data-slot="hover-card-content"]')).toHaveCount(0);
	const source = page.locator("[data-agent-session-column]").getByTestId("agent-session-row-lw-scope-thread");
	await expect(source).toBeVisible();
	return source;
}

async function startDrag(page: Page, source: Locator, createTargetCount = 4) {
	await source.scrollIntoViewIfNeeded();
	await expect.poll(() => source.evaluate((element) => (
		Math.abs(element.getBoundingClientRect().width - (element as HTMLElement).offsetWidth)
	))).toBeLessThan(0.5);
	const box = await source.boundingBox();
	expect(box).not.toBeNull();
	if (!box) throw new Error("Session has no geometry");
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 20, { steps: 5 });
	await expect(page.locator('[data-board-agent-session-drop-zone="create"]')).toHaveCount(createTargetCount);
}

async function readList(list: Locator) {
	return list.evaluate((element) => ({
		height: element.clientHeight,
		scrollTop: element.scrollTop,
		lastBottom: element.lastElementChild!.getBoundingClientRect().bottom,
	}));
}

async function readCreateInset(column: Locator, button: Locator) {
	const [buttonRect, columnRect] = await Promise.all([
		button.boundingBox(),
		column.boundingBox(),
	]);
	expect(buttonRect).not.toBeNull();
	expect(columnRect).not.toBeNull();
	return {
		left: buttonRect!.x - columnRect!.x,
		right: columnRect!.x + columnRect!.width - buttonRect!.x - buttonRect!.width,
		width: buttonRect!.width,
	};
}

for (const reducedMotion of ["reduce", "no-preference"] as const) {
	test(`create target only fills spare space in proximity (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		const source = await openBoard(page);
		const sourceId = await source.getAttribute("data-testid");
		const column = page.locator('[data-jira-kanban-column="To do"]');
		const list = column.locator("[data-jira-kanban-card-list]");
		await expect.poll(() => list.evaluate((element) => element.getAnimations({ subtree: true })
			.filter((animation) => animation.playState === "running" && animation.effect?.getTiming().iterations !== Infinity).length))
			.toBe(0);
		const before = await readList(list);
		const initialCount = await list.locator('[data-issue-key]').count();
		await startDrag(page, source);
		const well = column.locator('[data-board-agent-session-drop-zone="create"]');
		await page.mouse.move(900, 100, { steps: 8 });
		const wells = page.locator('[data-board-agent-session-drop-zone="create"]');
		await expect.poll(() => wells.evaluateAll((elements) => elements.map((element) => (
			Math.round(element.getBoundingClientRect().height)
		)))).toEqual([24, 24, 24, 24]);
		await page.screenshot({ path: `output/agent-browser/compact-dropzones-${reducedMotion}.png` });
		const compactBox = (await well.boundingBox())!;
		const approachY = (before.lastBottom + compactBox.y) / 2;
		expect(compactBox.y - approachY).toBeGreaterThan(120);
		// A neighboring column and the last card's occupied footer are not
		// part of the create target, even at the same vertical position.
		await page.mouse.move(compactBox.x - 40, approachY, { steps: 8 });
		await expect.poll(async () => Math.round((await well.boundingBox())!.height)).toBe(24);
		await page.mouse.move(compactBox.x + compactBox.width / 2, before.lastBottom - 40, { steps: 8 });
		await expect.poll(async () => Math.round((await well.boundingBox())!.height)).toBe(24);
		await page.mouse.move(compactBox.x + compactBox.width / 2, approachY, { steps: 12 });
		await expect.poll(async () => (await well.boundingBox())!.height).toBeGreaterThan(200);
		await expect.poll(async () => (await well.boundingBox())!.y).toBeLessThan(approachY);
		const expandedBox = (await well.boundingBox())!;
		expect(expandedBox.y).toBeGreaterThanOrEqual(before.lastBottom);
		expect(expandedBox.x).toBeCloseTo(compactBox.x, 0);
		expect(Math.abs(expandedBox.y + expandedBox.height - compactBox.y - compactBox.height)).toBeLessThanOrEqual(10.5);
		const during = await readList(list);
		expect({ height: during.height, scrollTop: during.scrollTop })
			.toEqual({ height: before.height, scrollTop: before.scrollTop });
		await expect.poll(() => wells.evaluateAll((elements) => elements.slice(1).map((element) => (
			Math.round(element.getBoundingClientRect().height)
		)))).toEqual([24, 24, 24]);
		await page.mouse.move(900, 100, { steps: 8 });
		await expect.poll(async () => Math.round((await well.boundingBox())!.height)).toBe(24);
		await page.mouse.move(compactBox.x + compactBox.width / 2, approachY, { steps: 12 });
		await expect.poll(async () => (await well.boundingBox())!.height).toBeGreaterThan(200);

		// The target also follows a viewport change while the pointer is held.
		const initialHeight = (await well.boundingBox())!.height;
		await page.setViewportSize({ width: 1440, height: 1200 });
		await expect.poll(async () => (await well.boundingBox())!.height).toBeGreaterThan(initialHeight + 90);
		const box = (await well.boundingBox())!;
		// Aim below the stationary cards, independent of the magnetic offset.
		await page.mouse.move(box.x + box.width / 2, Math.max(before.lastBottom + 35, box.y + 35), { steps: 12 });
		await expect(well).toHaveAttribute("data-armed", "true");
		await page.screenshot({ path: `output/agent-browser/reactive-dropzone-${reducedMotion}.png` });
		await page.mouse.up();
		await expect(list.locator('[data-issue-key]')).toHaveCount(initialCount + 1);
		await expect(page.locator("[data-agent-session-column]").getByTestId(sourceId!)).toHaveCount(0);
	});
}

test("empty columns keep the populated create action inset", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1100 });
	await page.goto(`${origin}/preview/projects/${project}`);
	const column = page.locator('[data-jira-kanban-column="To do"]');
	const button = column.getByRole("button", { name: "Create in To do" });
	await expect(column.locator("[data-issue-key]")).toHaveCount(4);
	const populated = await readCreateInset(column, button);

	await page.getByRole("button", { name: "Needs input: 1 agent" }).click();
	const expand = page.getByRole("button", { name: "Expand To do column" });
	if (await expand.isVisible()) {
		await expand.focus();
		await page.keyboard.press("Enter");
	}
	await expect(column.locator("[data-issue-key]")).toHaveCount(0);
	await expect(button).toBeVisible();
	await expect.poll(async () => (await column.boundingBox())!.width).toBe(280);

	expect(await readCreateInset(column, button)).toEqual(populated);
});

test("empty columns fill downward and cancellation restores the resting button", async ({ page }) => {
	test.setTimeout(60_000);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.clock.install();
	await openBoard(page);
	await page.clock.runFor(45_000);
	await page.getByRole("button", { name: "Needs input: 1 agent" }).click();
	const source = page.locator("[data-agent-session-column]").getByTestId("agent-session-row-lw-sync-release-gate");
	await page.getByRole("button", { name: "Expand To do column" }).focus();
	await page.keyboard.press("Enter");
	const column = page.locator('[data-jira-kanban-column="To do"]');
	await expect(column.locator("[data-issue-key]")).toHaveCount(0);
	const button = column.getByRole("button", { name: "Create in To do" });
	const before = await button.boundingBox();
	await startDrag(page, source, 2);
	const well = column.locator('[data-board-agent-session-drop-zone="create"]');
	await page.mouse.move(900, 100, { steps: 8 });
	await expect.poll(async () => Math.round((await well.boundingBox())!.height)).toBe(24);
	const compactBox = (await well.boundingBox())!;
	await page.mouse.move(compactBox.x + compactBox.width / 2, compactBox.y + 360, { steps: 8 });
	await expect.poll(async () => (await well.boundingBox())!.height).toBeGreaterThan(700);
	const box = (await well.boundingBox())!;
	expect(Math.abs(box.y - before!.y)).toBeLessThan(2);
	await page.mouse.move(box.x + box.width / 2, box.y + 100, { steps: 8 });
	await expect(well).toHaveAttribute("data-armed", "true");
	await page.mouse.move(900, 100, { steps: 8 });
	await page.mouse.up();
	await expect(well).toHaveCount(0);
	await expect(button).toBeVisible();
	// Bringing the source back into view can scroll the board horizontally.
	const after = (await button.boundingBox())!;
	expect({ height: after.height, width: after.width, y: after.y })
		.toEqual({ height: before!.height, width: before!.width, y: before!.y });
	await expect(source).toBeVisible();
});

test("overflowing cards retain their scroll viewport during a create drag", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	const source = await openBoard(page);
	const column = page.locator('[data-jira-kanban-column="In review"]');
	const list = column.locator("[data-jira-kanban-card-list]");
	await list.evaluate((element) => { element.scrollTop = 100; });
	const before = await readList(list);
	await startDrag(page, source);
	const well = column.locator('[data-board-agent-session-drop-zone="create"]');
	expect((await well.boundingBox())!.height).toBeLessThanOrEqual(64);
	expect(await readList(list)).toEqual(before);
	await page.mouse.move(900, 100, { steps: 8 });
	await page.mouse.up();
	await expect(well).toHaveCount(0);
	expect(await readList(list)).toEqual(before);
});

test("spare-space target starts below the last card's agent footer", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.clock.install();
	await openBoard(page);
	await page.clock.runFor(45_000);
	await page.getByRole("button", { name: "Needs input: 1 agent" }).click();
	const source = page.locator("[data-agent-session-column]").getByTestId("agent-session-row-lw-sync-release-gate");
	const column = page.locator('[data-jira-kanban-column="In review"]');
	const list = column.locator("[data-jira-kanban-card-list]");
	await expect(list.locator("[data-issue-key]")).toHaveCount(1);
	const footer = list.locator('[data-slot="jira-issue-agent-row"]');
	await expect(footer).toBeVisible();
	const before = await readList(list);
	await startDrag(page, source, 1);
	const well = column.locator('[data-board-agent-session-drop-zone="create"]');
	await page.mouse.move(900, 100, { steps: 8 });
	const compactBox = (await well.boundingBox())!;
	const centerX = compactBox.x + compactBox.width / 2;
	await page.mouse.move(centerX, before.lastBottom - 24, { steps: 8 });
	await expect.poll(async () => Math.round((await well.boundingBox())!.height)).toBe(24);
	await page.mouse.move(centerX, before.lastBottom + 32, { steps: 8 });
	await expect.poll(async () => (await well.boundingBox())!.height).toBeGreaterThan(500);
	const box = (await well.boundingBox())!;
	expect(box.y).toBeGreaterThanOrEqual(before.lastBottom);
	expect(box.y + box.height).toBeCloseTo(compactBox.y + compactBox.height, 0);
	expect(await readList(list)).toEqual(before);
	await page.screenshot({ path: "output/agent-browser/dropzone-below-agent-footer.png" });
	await page.mouse.move(900, 100, { steps: 8 });
	await page.mouse.up();
});

for (const reducedMotion of ["reduce", "no-preference"] as const) {
	test(`full-column target keeps proximity and bounded magnetic lean near the bottom (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		const source = await openBoard(page);
		const column = page.locator('[data-jira-kanban-column="In review"]');
		const list = column.locator("[data-jira-kanban-card-list]");
		const before = await readList(list);
		await startDrag(page, source);
		const well = column.locator('[data-board-agent-session-drop-zone="create"]');
		await page.mouse.move(900, 100, { steps: 8 });
		await expect.poll(async () => Math.round((await well.boundingBox())!.height)).toBe(24);
		const compactBox = (await well.boundingBox())!;
		const bottom = compactBox.y + compactBox.height;
		const centerX = compactBox.x + compactBox.width / 2;
		const sensor = column.locator("[data-create-work-item-proximity]");
		const sensorBox = (await sensor.boundingBox())!;
		await page.mouse.move(centerX, compactBox.y - 97, { steps: 8 });
		await expect.poll(async () => Math.round((await well.boundingBox())!.height)).toBe(24);
		// The nearby pointer still attracts and opens the well before entering it.
		await page.mouse.move(centerX, bottom - 64 - 12, { steps: 8 });
		await expect(well).toHaveAttribute("data-proximity", "near");
		await expect.poll(async () => Math.round((await well.boundingBox())!.height)).toBe(64);
		if (reducedMotion === "no-preference") {
			await expect.poll(async () => (await well.boundingBox())!.y).toBeLessThan(bottom - 64 - 5);
		}
		expect(Math.abs((await well.boundingBox())!.y - (bottom - 64))).toBeLessThanOrEqual(10.5);
		// Enter the fixed 64px footprint before the chrome has expanded.
		await page.mouse.move(centerX, bottom - 50, { steps: 8 });
		await expect.poll(async () => Math.round((await well.boundingBox())!.height)).toBe(64);
		for (const y of [bottom - 60, bottom - 12, bottom - 40]) {
			await page.mouse.move(centerX, y, { steps: 4 });
			await expect(well).toHaveAttribute("data-armed", "true");
			const box = (await well.boundingBox())!;
			expect(box.x).toBeCloseTo(compactBox.x, 0);
			expect(Math.abs(box.y - (bottom - 64))).toBeLessThanOrEqual(10.5);
			expect(box.height).toBeCloseTo(64, 0);
			expect(await sensor.boundingBox()).toEqual(sensorBox);
		}
		expect(await readList(list)).toEqual(before);
		await page.screenshot({ path: `output/agent-browser/anchored-full-dropzone-${reducedMotion}.png` });
		await page.mouse.move(900, 100, { steps: 8 });
		await expect.poll(async () => Math.round((await well.boundingBox())!.height)).toBe(24);
		await page.mouse.up();
		expect(await readList(list)).toEqual(before);
	});
}
