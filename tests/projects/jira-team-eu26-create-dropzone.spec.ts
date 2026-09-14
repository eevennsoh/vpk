import { expect, test, type Locator, type Page } from "@playwright/test";

const origin = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const project = process.env.PLAYWRIGHT_JIRA_PROJECT ?? "jira-team-eu26";

async function openBoard(page: Page) {
	await page.setViewportSize({ width: 1440, height: 1100 });
	await page.goto(`${origin}/preview/projects/${project}`);
	const options = page.getByRole("button", { name: "Unlink sessions column options" });
	await options.click();
	await expect(page.getByRole("menuitem", { name: "Expand", exact: true })).toBeVisible();
	const pin = page.getByRole("menuitem", { name: "Pin", exact: true });
	if (await pin.isVisible()) {
		await pin.click();
		await options.click();
	}
	await page.getByRole("menuitem", { name: "Expand", exact: true }).click();
	await expect(page.locator("[data-agent-session-column-expansion]"))
		.toHaveAttribute("data-agent-session-column-expansion", "expanded");
	await expect(page.getByRole("button", { name: "Unpin Unlink sessions column" })).toBeVisible();
	await expect(page.locator("[data-agent-session-column]")).toHaveCSS("width", "280px");
	await page.getByRole("heading", { name: "Jira Design", exact: true }).hover();
	await expect(page.locator('[data-slot="hover-card-content"]')).toHaveCount(0);
	const source = page.locator("[data-agent-session-column]").getByTestId("agent-session-row-lw-scope-thread");
	await expect(source).toBeVisible();
	return source;
}

async function startDrag(page: Page, source: Locator) {
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
	await expect(page.locator('[data-board-agent-session-drop-zone="create"]')).toHaveCount(4);
}

async function readList(list: Locator) {
	return list.evaluate((element) => ({
		height: element.clientHeight,
		scrollTop: element.scrollTop,
		lastBottom: element.lastElementChild!.getBoundingClientRect().bottom,
	}));
}

for (const reducedMotion of ["reduce", "no-preference"] as const) {
	test(`create target only fills spare space in proximity (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		const source = await openBoard(page);
		const sourceId = await source.getAttribute("data-testid");
		const column = page.locator('[data-jira-kanban-column="To do"]');
		const list = column.locator("[data-jira-kanban-card-list]");
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
		await page.mouse.move(compactBox.x + compactBox.width / 2, compactBox.y - 80, { steps: 12 });
		await expect.poll(async () => (await well.boundingBox())!.height).toBeGreaterThan(200);
		await expect.poll(async () => (await well.boundingBox())!.y).toBeLessThan(before.lastBottom + 20);
		expect(await readList(list)).toEqual(before);
		await expect.poll(() => wells.evaluateAll((elements) => elements.slice(1).map((element) => (
			Math.round(element.getBoundingClientRect().height)
		)))).toEqual([24, 24, 24]);
		await page.mouse.move(900, 100, { steps: 8 });
		await expect.poll(async () => Math.round((await well.boundingBox())!.height)).toBe(24);
		await page.mouse.move(compactBox.x + compactBox.width / 2, compactBox.y - 80, { steps: 12 });
		await expect.poll(async () => (await well.boundingBox())!.height).toBeGreaterThan(200);

		// The target also follows a viewport change while the pointer is held.
		const initialHeight = (await well.boundingBox())!.height;
		await page.setViewportSize({ width: 1440, height: 1200 });
		await expect.poll(async () => (await well.boundingBox())!.height).toBeGreaterThan(initialHeight + 90);
		const box = (await well.boundingBox())!;
		// Aim below the stationary cards, independent of the magnetic offset.
		await page.mouse.move(box.x + box.width / 2, before.lastBottom + 35, { steps: 12 });
		await expect(well).toHaveAttribute("data-armed", "true");
		await page.screenshot({ path: `output/agent-browser/reactive-dropzone-${reducedMotion}.png` });
		await page.mouse.up();
		await expect(list.locator('[data-issue-key]')).toHaveCount(initialCount + 1);
		await expect(page.locator("[data-agent-session-column]").getByTestId(sourceId!)).toHaveCount(0);
	});
}

test("empty columns fill downward and cancellation restores the resting button", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	const source = await openBoard(page);
	const column = page.locator('[data-jira-kanban-column="To do"]');
	const destination = page.locator('[data-jira-kanban-column="In progress"]');
	for (let index = 0; index < 4; index++) {
		const card = column.locator("article[draggable=true]").first();
		await card.dragTo(destination, { targetPosition: { x: 140, y: 20 } });
	}
	await expect(column.locator("[data-issue-key]")).toHaveCount(0);
	const button = column.getByRole("button", { name: "Create in To do" });
	const before = await button.boundingBox();
	await startDrag(page, source);
	const well = column.locator('[data-board-agent-session-drop-zone="create"]');
	await page.mouse.move(900, 100, { steps: 8 });
	await expect.poll(async () => Math.round((await well.boundingBox())!.height)).toBe(24);
	const compactBox = (await well.boundingBox())!;
	await page.mouse.move(compactBox.x + compactBox.width / 2, compactBox.y + 80, { steps: 8 });
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
