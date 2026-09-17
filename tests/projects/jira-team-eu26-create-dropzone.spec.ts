import { expect, test, type Locator, type Page } from "@playwright/test";

const origin = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const project = process.env.PLAYWRIGHT_JIRA_PROJECT ?? "jira-team-eu26";

test("empty columns never show an inline create border during a session drag", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.setViewportSize({ width: 1440, height: 1100 });
	await page.goto(`${origin}/${project}`);
	await expect(page.getByRole("heading", { name: "Jira Design", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Filter board by Codex" }).click();
	const column = page.locator('[data-jira-kanban-column="To do"]');
	const expand = page.getByRole("button", { name: "Expand To do column" });
	if (await expand.isVisible()) {
		await expand.focus();
		await page.keyboard.press("Enter");
	}
	await expect(column.locator("[data-issue-key]")).toHaveCount(0);
	const source = page.locator('[data-agent-session-column] [data-testid^="agent-session-row-"]').first();
	await source.hover();
	const sourceBox = (await source.boundingBox())!;
	await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + 12);
	await page.mouse.down();
	await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 20, sourceBox.y + 32, { steps: 5 });
	await expect(column.locator('[data-board-agent-session-drop-zone="create"]')).toHaveCount(1);
	const slot = column.locator('[data-board-agent-session-drop-zone="card-gap"]');
	await expect(slot).toHaveCount(1);
	const slotBox = (await slot.boundingBox())!;
	await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + 80);
	await expect(column.locator("[data-insertion-line], [data-board-insertion-marker]")).toHaveCount(0);
	await expect(column.locator('[data-board-agent-session-drop-zone="create"]')).toHaveCount(1);
	await page.mouse.move(900, 100);
	await page.mouse.up();
	await expect(column.locator("[data-issue-key]")).toHaveCount(0);
});

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
	// Settle native entrance animations before measuring geometry under the virtual clock.
	await page.locator("[data-jira-dropzone-well]").evaluateAll(async (roots) => {
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		for (const root of roots) {
			for (const animation of root.getAnimations()) {
				if (Number.isFinite(animation.effect?.getTiming().iterations ?? 1)) animation.finish();
			}
		}
	});
	await expect(page.locator('button[aria-label^="Create in "]')).toHaveCount(createTargetCount);
	await expect(page.locator("[data-board-work-item-create]:not([inert])")).toHaveCount(0);
	await expect(page.getByRole("button", { name: /^Create in / })).toHaveCount(0);
	const wells = page.locator('[data-board-agent-session-drop-zone="create"]');
	await expect(wells).toHaveText(Array(createTargetCount).fill("Drop to create work item"));
	if (!await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)) {
		const strokes = wells.locator("[data-jira-dropzone-ants-stroke] rect");
		await expect(strokes).toHaveCount(createTargetCount);
		await expect(strokes.first()).toHaveCSS("animation-name", "jira-dropzone-ants");
		await expect(strokes.first()).toHaveClass(/(?:^|\s)stroke-border(?:\s|$)/u);
	}
}

async function readList(list: Locator) {
	return list.evaluate((element) => {
		const cards = element.querySelectorAll("[data-issue-key]");
		return {
			height: element.clientHeight,
			scrollTop: element.scrollTop,
			lastBottom: cards[cards.length - 1]?.getBoundingClientRect().bottom ?? element.getBoundingClientRect().top,
		};
	});
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

test("compact create adds a named issue in its own column without capturing sessions", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.clock.install();
	await openBoard(page);
	await page.clock.runFor(45_000);
	const column = page.locator('[data-jira-kanban-column="In review"]');
	const list = column.locator("[data-jira-kanban-card-list]");
	const initialCount = await list.locator("[data-issue-key]").count();
	const sessions = page.locator("[data-agent-session-column]");
	const sessionCount = await sessions.locator('[data-testid^="agent-session-row-"]').count();
	await column.hover();
	await column.getByRole("button", { name: "Create in In review" }).click();
	const form = page.getByRole("dialog", { name: "Create in In review", exact: true });
	await form.getByRole("textbox", { name: "Name this work item" }).fill("Manual review follow-up");
	await form.getByRole("button", { name: "Create work item", exact: true }).click();
	await expect(form).toHaveCount(0);
	await expect(list.locator("[data-issue-key]")).toHaveCount(initialCount + 1);
	const created = list.locator("[data-issue-key]").filter({ hasText: "Manual review follow-up" });
	await expect(created).toHaveCount(1);
	await expect(created.locator('[data-slot="jira-issue-agent-row"]')).toHaveCount(0);
	await expect(sessions.locator('[data-testid^="agent-session-row-"]')).toHaveCount(sessionCount);
	await expect(page.locator('[data-board-agent-session-drop-zone="create"]')).toHaveCount(0);
});

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
		)))).toEqual([32, 32, 32, 32]);
		await expect.poll(() => list.evaluate((element) => element.getAnimations({ subtree: true })
			.filter((animation) => animation.playState === "running" && animation.effect?.getTiming().iterations !== Infinity).length))
			.toBe(0);
		const occupiedAfterDrag = await readList(list);
		await page.screenshot({ path: `output/agent-browser/compact-dropzones-${reducedMotion}.png` });
		const compactBox = (await well.boundingBox())!;
		const approachY = (occupiedAfterDrag.lastBottom + compactBox.y) / 2;
		expect(compactBox.y - approachY).toBeGreaterThan(120);
		// A neighboring column and the last card's occupied footer are not
		// part of the create target, even at the same vertical position.
		await page.mouse.move(compactBox.x - 40, approachY, { steps: 8 });
		await expect.poll(async () => Math.round((await well.boundingBox())!.height)).toBe(32);
		await page.mouse.move(compactBox.x + compactBox.width / 2, before.lastBottom - 40, { steps: 8 });
		await expect.poll(async () => Math.round((await well.boundingBox())!.height)).toBe(32);
		await page.mouse.move(compactBox.x + compactBox.width / 2, approachY, { steps: 12 });
		await expect.poll(async () => (await well.boundingBox())!.height).toBeGreaterThan(200);
		await expect.poll(async () => (await well.boundingBox())!.y).toBeLessThan(approachY);
		const expandedBox = (await well.boundingBox())!;
		expect(expandedBox.y).toBeGreaterThanOrEqual(occupiedAfterDrag.lastBottom);
		expect(expandedBox.x).toBeCloseTo(compactBox.x, 0);
		expect(Math.abs(expandedBox.y + expandedBox.height - compactBox.y - compactBox.height)).toBeLessThanOrEqual(10.5);
		const during = await readList(list);
		expect({ height: during.height, scrollTop: during.scrollTop })
			.toEqual({ height: before.height, scrollTop: before.scrollTop });
		await expect.poll(() => wells.evaluateAll((elements) => elements.slice(1).map((element) => (
			Math.round(element.getBoundingClientRect().height)
		)))).toEqual([32, 32, 32]);
		await page.mouse.move(900, 100, { steps: 8 });
		await expect.poll(async () => Math.round((await well.boundingBox())!.height)).toBe(32);
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

test("compact create actions follow the cards and move to the top when empty", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1100 });
	await page.goto(`${origin}/preview/projects/${project}`);
	const column = page.locator('[data-jira-kanban-column="To do"]');
	const button = column.getByRole("button", { name: "Create in To do" });
	await expect(column.locator("[data-issue-key]")).toHaveCount(4);
	const populated = await readCreateInset(column, button);
	const lastCardBox = (await column.locator("[data-issue-key]").last().boundingBox())!;
	expect(populated.width).toBe(lastCardBox.width);
	const populatedButtonBox = (await button.boundingBox())!;
	expect(populatedButtonBox.height).toBe(24);
	expect(populatedButtonBox.x).toBe(lastCardBox.x);
	expect(populatedButtonBox.y - lastCardBox.y - lastCardBox.height).toBeGreaterThanOrEqual(4);
	expect(populatedButtonBox.y - lastCardBox.y - lastCardBox.height).toBeLessThanOrEqual(12);

	await page.getByRole("button", { name: "Needs input: 1 agent" }).click();
	const expand = page.getByRole("button", { name: "Expand To do column" });
	if (await expand.isVisible()) {
		await expand.focus();
		await page.keyboard.press("Enter");
	}
	await expect(column.locator("[data-issue-key]")).toHaveCount(0);
	await page.getByRole("heading", { name: "Jira Design", exact: true }).hover();
	await page.locator(":focus").evaluateAll((elements) => {
		for (const element of elements) (element as HTMLElement).blur();
	});
	await expect(button).toHaveCSS("opacity", "0");
	await expect(button).toHaveCSS("pointer-events", "none");
	await column.locator("[data-jira-kanban-card-list]").hover();
	await expect(button).toHaveCSS("opacity", "1");
	await expect(button).toHaveCSS("pointer-events", "auto");
	await expect(column.locator("[data-board-insertion-marker]")).toHaveCount(0);
	await expect.poll(async () => {
		const listBox = (await column.locator("[data-jira-kanban-card-list]").boundingBox())!;
		const buttonBox = (await button.boundingBox())!;
		return buttonBox.y - listBox.y;
	}).toBeLessThanOrEqual(12);
	await page.getByRole("heading", { name: "Jira Design", exact: true }).hover();
	await expect(button).toHaveCSS("opacity", "0");
	await column.getByRole("button", { name: "Collapse To do column" }).focus();
	await page.keyboard.press("Tab");
	await expect(button).toBeFocused();
	await expect(button).toHaveCSS("opacity", "1");
	await expect.poll(async () => (await column.boundingBox())!.width).toBe(280);

	expect(await readCreateInset(column, button)).toEqual(populated);
});

for (const reducedMotion of ["reduce", "no-preference"] as const) {
	test(`empty columns fill upward with magnetic feedback (${reducedMotion})`, async ({ page }) => {
		test.setTimeout(60_000);
		await page.emulateMedia({ reducedMotion });
		let source: Locator;
		if (reducedMotion === "reduce") {
			await page.clock.install();
			await openBoard(page);
			await page.clock.runFor(45_000);
			await page.getByRole("button", { name: "Needs input: 1 agent" }).click();
			source = page.locator("[data-agent-session-column]").getByTestId("agent-session-row-lw-sync-release-gate");
		} else {
			// Use a real filter and native animation time for the magnetic check.
			await openBoard(page);
			await page.getByRole("button", { name: "Filter board by Codex" }).click();
			const firstSource = page.locator('[data-agent-session-column] [data-testid^="agent-session-row-"]').first();
			const sourceId = await firstSource.getAttribute("data-testid");
			if (!sourceId) throw new Error("Filtered session has no identity");
			source = page.getByTestId(sourceId);
		}
		const expand = page.getByRole("button", { name: "Expand To do column" });
		if (await expand.isVisible()) {
			await expand.focus();
			await page.keyboard.press("Enter");
		}
		const column = page.locator('[data-jira-kanban-column="To do"]');
		await expect(column.locator("[data-issue-key]")).toHaveCount(0);
		const button = column.getByRole("button", { name: "Create in To do" });
		const before = await button.boundingBox();
		await source.hover();
		const targetCount = await page.locator("[data-jira-kanban-card-list]").count();
		await startDrag(page, source, targetCount);
		const well = column.locator('[data-board-agent-session-drop-zone="create"]');
		await page.mouse.move(900, 100, { steps: 8 });
		await expect.poll(async () => Math.round((await well.boundingBox())!.height)).toBe(32);
		const compactBox = (await well.boundingBox())!;
		const columnBox = (await column.boundingBox())!;
		expect(columnBox.y + columnBox.height - compactBox.y - compactBox.height).toBeLessThanOrEqual(12);
		await page.mouse.move(compactBox.x + compactBox.width / 2, compactBox.y - 360, { steps: 8 });
		await expect.poll(async () => (await well.boundingBox())!.height).toBeGreaterThan(700);
		const box = (await well.boundingBox())!;
		expect(Math.abs(box.y + box.height - compactBox.y - compactBox.height)).toBeLessThanOrEqual(10.5);
		await expect.poll(async () => {
			const contentTop = await column.locator("[data-jira-kanban-card-list]").evaluate((element) => (
				element.getBoundingClientRect().top + Number.parseFloat(getComputedStyle(element).paddingTop || "0")
			));
			const translateY = await well.evaluate((element) => {
				const transform = getComputedStyle(element.parentElement!).transform;
				return transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
			});
			return Math.abs((await well.boundingBox())!.y - translateY - contentTop);
		}).toBeLessThanOrEqual(1);
		await page.mouse.move(compactBox.x + compactBox.width * 0.75, box.y + 100, { steps: 8 });
		if (reducedMotion === "no-preference") {
			await expect.poll(async () => (await well.boundingBox())!.x - compactBox.x).toBeGreaterThan(1);
		}
		expect(Math.abs((await well.boundingBox())!.x - compactBox.x)).toBeLessThanOrEqual(10.5);
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
}

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
	await expect.poll(async () => Math.round((await well.boundingBox())!.height)).toBe(32);
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
		await expect.poll(async () => Math.round((await well.boundingBox())!.height)).toBe(32);
		const compactBox = (await well.boundingBox())!;
		const bottom = compactBox.y + compactBox.height;
		const centerX = compactBox.x + compactBox.width / 2;
		const sensor = column.locator("[data-create-work-item-proximity]");
		const sensorBox = (await sensor.boundingBox())!;
		await page.mouse.move(centerX, compactBox.y - 97, { steps: 8 });
		await expect.poll(async () => Math.round((await well.boundingBox())!.height)).toBe(32);
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
		await expect.poll(async () => Math.round((await well.boundingBox())!.height)).toBe(32);
		await page.mouse.up();
		expect(await readList(list)).toEqual(before);
	});
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`bottom dashed targets animate in and out (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.setViewportSize({ width: 1440, height: 1100 });
		await page.goto(`${origin}/${project}`);
		await expect(page.getByRole("heading", { name: "Jira Design", exact: true })).toBeVisible();
		const source = page.getByTestId("agent-session-row-lw-scope-thread");
		await source.scrollIntoViewIfNeeded();
		const sourceBox = (await source.boundingBox())!;
		await page.evaluate(() => {
			const trace = { stage: "enter", frames: [] as { stage: string; opacity: number; offset: number; targets: number }[], running: true };
			Object.assign(window, { dashedMotionTrace: trace });
			const started = performance.now();
			function sample() {
				const well = document.querySelector('[data-jira-dropzone-well][data-jira-dropzone-column="To do"]')
					?? document.querySelector('[data-board-agent-session-create-work-item-drop-zone="To do"]')?.parentElement;
				if (well) {
					const style = getComputedStyle(well);
					trace.frames.push({
						stage: trace.stage,
						opacity: Number(style.opacity),
						offset: style.transform === "none" ? 0 : new DOMMatrixReadOnly(style.transform).m42,
						targets: document.querySelectorAll('[data-board-agent-session-drop-zone="create"]').length,
					});
				}
				if (trace.running && performance.now() - started < 3000) requestAnimationFrame(sample);
			}
			requestAnimationFrame(sample);
		});
		await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
		await page.mouse.down();
		await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 20, sourceBox.y + sourceBox.height / 2 + 20, { steps: 5 });
		const target = page.locator('[data-board-agent-session-create-work-item-drop-zone="To do"]');
		await expect(target).toHaveCount(1);
		await expect.poll(() => target.evaluate((node) => getComputedStyle(node.closest("[data-jira-dropzone-well]") ?? node.parentElement!).opacity)).toBe("1");
		await page.screenshot({ path: `output/agent-browser/dropzone-motion-side/entered-${reducedMotion}.png` });
		await page.mouse.move(900, 100);
		await page.evaluate(() => {
			const trace = (window as typeof window & { dashedMotionTrace: { stage: string } }).dashedMotionTrace;
			trace.stage = "exit";
		});
		await page.mouse.up();
		await expect(page.locator('[data-board-agent-session-drop-zone="create"]')).toHaveCount(0);
		await page.waitForTimeout(180);
		const frames = await page.evaluate(() => {
			const trace = (window as typeof window & { dashedMotionTrace: { running: boolean; frames: { stage: string; opacity: number; offset: number; targets: number }[] } }).dashedMotionTrace;
			trace.running = false;
			return trace.frames;
		});
		const { writeFile } = await import("node:fs/promises");
		await writeFile(`output/agent-browser/dropzone-motion-side/frames-${reducedMotion}.json`, JSON.stringify(frames, null, 2));
		await expect(page.locator("[data-jira-dropzone-well]")).toHaveCount(0);
		if (reducedMotion === "reduce") {
			expect(frames.every((frame) => Math.abs(frame.offset) < 0.01)).toBe(true);
		} else {
			expect(frames.some((frame) => frame.stage === "enter" && frame.offset > 0.01 && frame.opacity > 0 && frame.opacity < 1)).toBe(true);
			expect(frames.some((frame) => frame.stage === "exit" && frame.targets === 0 && frame.offset > 0 && frame.opacity > 0 && frame.opacity < 1)).toBe(true);
		}
	});
}
