import { expect, test, type Locator, type Page } from "@playwright/test";

const origin = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const project = process.env.PLAYWRIGHT_JIRA_PROJECT ?? "jira-team-eu26";

interface CreateFlightFrame {
	chipY: number;
	copy: string | null;
	distanceToTarget: number;
	opacity: number;
	pendingCardSafe: boolean;
	projectionY: number;
	scale: number;
	targetHeight: number;
}

interface CreatedCardEntranceFrame {
	deferred: boolean;
	opacity: number;
	scale: number;
	slotHeight: number;
}

test("columns hug their cards and keep creation visible outside the scrollport", async ({ page }) => {
	await openBoard(page);
	await page.setViewportSize({ width: 1720, height: 1100 });
	const rowWidth = await page.locator("[data-jira-kanban-scrollport]").evaluate((node) => ({
		content: node.firstElementChild!.getBoundingClientRect().width,
		viewport: node.getBoundingClientRect().width,
	}));
	expect(rowWidth.content).toBeLessThan(rowWidth.viewport);
	await page.getByRole("heading", { name: "Jira Design", exact: true }).hover();
	for (const title of ["To do", "In progress", "In review", "Done"]) {
		const column = page.locator(`[data-jira-kanban-column="${title}"]`);
		const list = column.locator("[data-jira-kanban-card-list]");
		const button = column.getByRole("button", { name: `Create in ${title}` });
		await expect(button).toBeVisible();
		await expect(button).toHaveCSS("height", "24px");
		await expect(button).toHaveCSS("opacity", "1");
		expect(await button.evaluate((node) => node.closest("[data-jira-kanban-card-list]") === null)).toBe(true);
		const geometry = await readList(list);
		const box = (await button.boundingBox())!;
		const insets = await button.evaluate((node) => {
			const buttonRect = node.getBoundingClientRect();
			const columnRect = node.closest("[data-kanban-column-chrome]")!.getBoundingClientRect();
			return { left: buttonRect.left - columnRect.left, right: columnRect.right - buttonRect.right, bottom: columnRect.bottom - buttonRect.bottom };
		});
		expect(insets.bottom).toBe(insets.left);
		expect(insets.bottom).toBe(insets.right);
		if (geometry.scrollHeight <= geometry.height) {
			expect(box.y - geometry.lastBottom).toBeLessThanOrEqual(20);
		}
		await list.evaluate((node) => { node.scrollTop = node.scrollHeight; });
		expect(await button.boundingBox()).toEqual(box);
	}
});

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
	await expect(slot).toHaveCount(0);
	const sensorBox = (await column.locator("[data-create-work-item-proximity]").boundingBox())!;
	await page.mouse.move(sensorBox.x + sensorBox.width / 2, sensorBox.y + 80);
	await expect(column.locator("[data-insertion-line], [data-board-insertion-marker]")).toHaveCount(0);
	await expect(column.locator('[data-board-agent-session-drop-zone="create"]')).toHaveCount(1);
	await page.mouse.move(900, 100);
	await page.mouse.up();
	await expect(column.locator("[data-issue-key]")).toHaveCount(0);
});

async function openBoard(page: Page) {
	await page.setViewportSize({ width: 1440, height: 1100 });
	await page.goto(`${origin}/${project}`);
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

for (const [reducedMotion, columnState] of [
	["no-preference", "filled"],
	["reduce", "filled"],
	["no-preference", "empty"],
	["reduce", "empty"],
	["no-preference", "center"],
] as const) {
	test(`a dropped session flies into an open well before restoring creation (${columnState}, ${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		const source = await openBoard(page);
		await page.setViewportSize({ width: 1440, height: columnState === "empty" ? 1100 : 760 });
		const column = page.locator('[data-jira-kanban-column="To do"]');
		const cards = column.locator("[data-issue-key]");
		if (columnState === "empty") {
			await page.getByRole("button", { name: "Filter board by Venn", exact: true }).click();
			const expand = page.getByRole("button", { name: "Expand To do column", exact: true });
			if (await expand.isVisible()) {
				await expand.focus();
				await page.keyboard.press("Enter");
			}
			await expect(cards).toHaveCount(0);
		}
		const initialCount = await cards.count();
		const initialKeys = await cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-issue-key")));
		const button = column.locator('[data-jira-dropzone-control="To do"]');
		const resting = (await button.boundingBox())!;
		await startDrag(page, source, await page.locator("[data-jira-kanban-card-list]").count());
		const sensor = (await column.locator("[data-create-work-item-proximity]").boundingBox())!;
		await page.mouse.move(sensor.x + sensor.width / 2, sensor.y + (columnState === "center" ? sensor.height / 2 : sensor.height - 8), { steps: 5 });
		await expect(column.locator('[data-board-agent-session-drop-zone="create"]')).toHaveAttribute("data-armed", "true");
		const openHeight = Math.max(64, sensor.height);
		await expect.poll(async () => (await button.boundingBox())!.height).toBeCloseTo(openHeight, 0);
		await page.evaluate(() => {
			const trace = { running: true, frames: [] as CreateFlightFrame[], cards: [] as CreatedCardEntranceFrame[] };
			Object.assign(window, { completeCreateFlightTrace: trace });
			const started = performance.now();
			function sample() {
				const button = document.querySelector('[data-jira-dropzone-control="To do"]')!;
				const target = button.getBoundingClientRect();
				const transform = getComputedStyle(button).transform;
				const card = document.querySelector('[data-jira-kanban-column="To do"] [data-jira-creating-arrival="true"]');
				const pending = card?.closest("[data-created-card-pending]");
				if (card) {
					const content = card.querySelector('[data-slot="jira-creating-card"]')!;
					const cardTransform = getComputedStyle(content).transform;
					trace.cards.push({
						deferred: pending !== null,
						opacity: Number(getComputedStyle(content).opacity),
						scale: cardTransform === "none" ? 1 : new DOMMatrixReadOnly(cardTransform).m11,
						slotHeight: card.querySelector('[data-slot="jira-creating-slot"]')!.getBoundingClientRect().height,
					});
				}
				for (const flight of document.querySelectorAll('[data-jira-dropzone-flight]')) {
					const chip = flight.firstElementChild!.getBoundingClientRect();
					const flightTransform = getComputedStyle(flight).transform;
					trace.frames.push({
						chipY: (chip.top + chip.bottom) / 2,
						copy: button.querySelector("[data-jira-dropzone-copy-motion]")!.getAttribute("data-jira-dropzone-copy-motion"),
						distanceToTarget: Math.hypot((chip.left + chip.right - target.left - target.right) / 2, (chip.top + chip.bottom - target.top - target.bottom) / 2),
						opacity: Number(getComputedStyle(flight).opacity),
						pendingCardSafe: Boolean(pending && getComputedStyle(pending).display === "none" && pending.hasAttribute("inert") && pending.getAttribute("aria-hidden") === "true"),
						projectionY: transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42,
						scale: flightTransform === "none" ? 1 : new DOMMatrixReadOnly(flightTransform).m11,
						targetHeight: target.height,
					});
				}
				if (trace.running && performance.now() - started < 5000) requestAnimationFrame(sample);
			}
			requestAnimationFrame(sample);
		});
		await page.mouse.up();
		if (columnState === "center") {
			const flights = page.locator("[data-jira-dropzone-flight]");
			await flights.evaluateAll((roots) => roots.forEach((root) => root.getAnimations().forEach((animation) => {
				animation.pause();
				animation.currentTime = 120;
			})));
			await page.screenshot({ path: "output/agent-browser/dropzone-motion-side/create-drop-in-progress.png" });
			const box = (await button.boundingBox())!;
			await page.screenshot({ path: "output/agent-browser/dropzone-motion-side/create-drop-chip.png", clip: { x: box.x - 12, y: box.y - 44, width: box.width + 24, height: box.height + 60 } });
			await flights.evaluateAll((roots) => roots.forEach((root) => root.getAnimations().forEach((animation) => animation.play())));
		}
		await expect(cards).toHaveCount(initialCount + 1);
		await expect(source).toHaveCount(0);
		await expect(page.locator("[data-jira-dropzone-flight]")).toHaveCount(0);
		const createdKey = (await cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-issue-key"))))
			.find((key) => !initialKeys.includes(key));
		expect(createdKey).toBeTruthy();
		const created = column.locator(`[data-issue-key="${createdKey}"]`);
		await expect(created).toBeVisible();
		await expect(created).not.toHaveAttribute("data-jira-creating-arrival", "true");
		expect(await created.evaluate((node) => node.closest('[inert], [aria-hidden="true"]') === null)).toBe(true);
		await expect(button).toHaveCSS("height", "24px");
		await expect(button).toHaveAttribute("aria-label", "Create in To do");
		const trace = await page.evaluate(() => {
			const trace = (window as typeof window & { completeCreateFlightTrace: { running: boolean; frames: CreateFlightFrame[]; cards: CreatedCardEntranceFrame[] } }).completeCreateFlightTrace;
			trace.running = false;
			return { frames: trace.frames, cards: trace.cards };
		});
		const { frames } = trace;
		const { mkdir, writeFile } = await import("node:fs/promises");
		await mkdir("output/agent-browser/dropzone-motion-side", { recursive: true });
		await writeFile(`output/agent-browser/dropzone-motion-side/complete-create-flight-${columnState}-${reducedMotion}.json`, JSON.stringify(trace, null, 2));
		if (reducedMotion === "no-preference") {
			expect(frames.length).toBeGreaterThan(2);
			const visibleFrames = frames.filter((frame) => frame.opacity > 0.01);
			expect(visibleFrames.length).toBeGreaterThan(2);
			expect(visibleFrames.every((frame) => frame.copy === "label" && frame.targetHeight >= openHeight - 0.5 && frame.pendingCardSafe && Math.abs(frame.projectionY) <= 0.1)).toBe(true);
			if (columnState !== "center") expect(frames[0].distanceToTarget).toBeGreaterThan(4);
			expect(Math.min(...frames.map((frame) => frame.chipY))).toBeLessThan(frames[0].chipY - 12);
			expect(frames.some((frame) => frame.opacity > 0.01 && frame.opacity < 0.99 && frame.scale < 0.99)).toBe(true);
			expect(frames.at(-1)!.distanceToTarget).toBeLessThan(10);
			expect(trace.cards.some((card) => !card.deferred && card.slotHeight > 0 && card.scale > 0.8 && card.scale < 1)).toBe(true);
			expect(trace.cards.some((card) => !card.deferred && card.opacity > 0 && card.opacity < 1)).toBe(true);
		}
		if (columnState !== "empty") {
			await expect.poll(async () => (await button.boundingBox())!.y + 24).toBeCloseTo(resting.y + resting.height, 0);
		} else {
			expect((await button.boundingBox())!.y).toBeGreaterThan(resting.y);
		}
	});
}

test("a second creation drop preserves a card whose entrance already started", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	const source = await openBoard(page);
	await page.setViewportSize({ width: 1440, height: 760 });
	const column = page.locator('[data-jira-kanban-column="To do"]');
	const cards = column.locator("[data-issue-key]");
	const before = await cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-issue-key")));
	const drop = async (row: Locator) => {
		await startDrag(page, row);
		const sensor = (await column.locator("[data-create-work-item-proximity]").boundingBox())!;
		await page.mouse.move(sensor.x + sensor.width / 2, sensor.y + sensor.height - 8, { steps: 5 });
		await expect(column.locator('[data-jira-dropzone-control="To do"]')).toHaveCSS("height", "64px");
		await page.mouse.up();
	};
	await drop(source);
	await expect(page.locator("[data-jira-dropzone-flight]")).toHaveCount(0);
	const key = (await cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-issue-key"))))
		.find((value) => !before.includes(value));
	const first = column.locator(`[data-issue-key="${key}"]`);
	await expect(first).toBeVisible();
	const content = first.locator('[data-slot="jira-creating-card"]');
	await content.evaluate((node) => node.getAnimations().forEach((animation) => { animation.pause(); animation.currentTime = 80; }));
	await expect(first).toHaveAttribute("data-jira-creating-arrival", "true");
	await drop(page.locator("[data-agent-session-column]").getByTestId("agent-session-row-lw-kickoff-killswitch-session"));
	await expect(page.locator("[data-jira-dropzone-flight]")).toHaveCount(1);
	const stayedVisible = await first.isVisible();
	const stayedReachable = await first.evaluate((node) => node.closest('[inert], [aria-hidden="true"]') === null);
	await content.evaluate((node) => node.getAnimations().forEach((animation) => animation.play()));
	await expect(page.locator("[data-jira-dropzone-flight]")).toHaveCount(0);
	await expect(cards).toHaveCount(before.length + 2);
	await expect(column.locator('[data-created-card-pending]')).toHaveCount(0);
	await expect(column.getByRole("button", { name: "Create in To do" })).toHaveCSS("height", "24px");
		expect(stayedVisible).toBe(true);
		expect(stayedReachable).toBe(true);
});

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
	await expect(page.locator('button[aria-label^="Create in "]')).toHaveCount(0);
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
			scrollHeight: element.scrollHeight,
			scrollTop: element.scrollTop,
			lastBottom: cards[cards.length - 1]?.getBoundingClientRect().bottom ?? element.getBoundingClientRect().top,
		};
	});
}

async function measureDragScrollSpeed(list: Locator) {
	return list.evaluate(async (element) => {
		const started = performance.now();
		const before = element.scrollTop;
		// Measure actual scrolling over the same window in the development browser.
		await new Promise((resolve) => setTimeout(resolve, 250));
		return Math.abs(element.scrollTop - before) * 1000 / (performance.now() - started);
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

test("edge scrolling pauses when the drag window loses focus and resumes on pointer movement", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	const source = await openBoard(page);
	await page.setViewportSize({ width: 1440, height: 760 });
	const list = page.locator('[data-jira-kanban-column="In review"] [data-jira-kanban-card-list]');
	await startDrag(page, source);
	const box = (await list.boundingBox())!;
	const x = box.x + box.width / 2;
	const y = box.y + box.height - 110;
	await page.mouse.move(x, y, { steps: 8 });
	await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(40);
	await page.evaluate(() => window.dispatchEvent(new Event("blur")));
	const paused = await list.evaluate((element) => element.scrollTop);
	await page.waitForTimeout(200);
	expect(await list.evaluate((element) => element.scrollTop)).toBe(paused);
	await page.mouse.move(x + 1, y);
	await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(paused + 40);
	await page.mouse.move(900, 100);
	await page.mouse.up();
});

for (const reducedMotion of ["reduce", "no-preference"] as const) {
	test(`an attached session scrolls its source column and moves to a later issue (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await openBoard(page);
		await page.setViewportSize({ width: 1440, height: 760 });
		const column = page.locator('[data-jira-kanban-column="In review"]');
		const list = column.locator("[data-jira-kanban-card-list]");
		const sourceIssue = column.locator('[data-board-agent-session-drop-zone="issue"][data-issue-key="PAY-112"]');
		const source = sourceIssue.locator('[data-slot="jira-issue-agent-row"]');
		const box = (await source.boundingBox())!;
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 20, { steps: 5 });
		await expect(page.locator("[data-session-drag-overlay]")).toHaveCount(1);
		await expect(list).toHaveCSS("overflow-y", "auto");
		const viewport = (await list.boundingBox())!;
		await page.mouse.move(viewport.x + viewport.width / 2, viewport.y + viewport.height - 110, { steps: 8 });
		await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(120);
		const target = column.locator('[data-board-agent-session-drop-zone="issue"][data-issue-key="PAY-128"]');
		// A gentle edge position needs time to traverse the eight-card column.
		await expect.poll(async () => {
			const card = (await target.boundingBox())!;
			return card.y + 40 < viewport.y + viewport.height - 8;
		}, { timeout: 15_000 }).toBe(true);
		const targetBox = (await target.boundingBox())!;
		await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 40, { steps: 8 });
		await expect(target).toHaveAttribute("data-board-agent-session-target", "attach");
		await page.screenshot({ path: `output/agent-browser/attached-session-source-scroll-${reducedMotion}.png` });
		await page.mouse.up();
		await expect(sourceIssue.locator('[data-slot="jira-issue-agent-row"]')).toHaveCount(0);
		await expect(target.locator('[data-slot="jira-issue-agent-row"]')).toHaveCount(1);
		await expect(page.locator("[data-session-drag-overlay]")).toHaveCount(0);
	});

	test(`dragging between cards creates an issue at that slot (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		const source = await openBoard(page);
		const sourceId = await source.getAttribute("data-testid");
		const column = page.locator('[data-jira-kanban-column="To do"]');
		const cards = column.locator('[data-board-agent-session-drop-zone="issue"]');
		const first = cards.nth(0);
		const second = cards.nth(1);
		const firstBox = (await first.boundingBox())!;
		const secondBox = (await second.boundingBox())!;
		const x = firstBox.x + firstBox.width / 2;
		const y = (firstBox.y + firstBox.height + secondBox.y) / 2;
		const line = column.locator("[data-insertion-line]");
		await startDrag(page, source);
		await page.mouse.move(x, y, { steps: 8 });
		await expect(second.locator("[data-insertion-line]")).toBeVisible();
		for (const offset of [-2, 1, -1, 2, 0]) {
			await page.mouse.move(x + offset, y + offset);
			await expect(line).toHaveCount(1);
			await expect(first).not.toHaveAttribute("data-board-agent-session-target", "attach");
			await expect(second).not.toHaveAttribute("data-board-agent-session-target", "attach");
		}
		await page.screenshot({ path: `output/agent-browser/restored-inline-create-${reducedMotion}.png` });
		await page.mouse.up();
		await expect(cards).toHaveCount(5);
		await expect(cards.nth(0)).toHaveAttribute("data-issue-key", "PAY-118");
		await expect(cards.nth(2)).toHaveAttribute("data-issue-key", "PAY-124");
		await expect(cards.nth(1).locator('[data-slot="jira-issue-agent-row"]')).toHaveCount(1);
		await expect(page.locator("[data-agent-session-column]").getByTestId(sourceId!)).toHaveCount(0);
		await expect(line).toHaveCount(0);
	});

	test(`inline creation still works after edge scrolling (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		const source = await openBoard(page);
		const sourceId = await source.getAttribute("data-testid");
		await page.setViewportSize({ width: 1440, height: 760 });
		const column = page.locator('[data-jira-kanban-column="In review"]');
		const list = column.locator("[data-jira-kanban-card-list]");
		const cards = column.locator('[data-board-agent-session-drop-zone="issue"]');
		await startDrag(page, source);
		const viewport = (await list.boundingBox())!;
		await page.mouse.move(viewport.x + viewport.width / 2, viewport.y + viewport.height - 110, { steps: 8 });
		await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(200);
		await page.mouse.move(900, 100, { steps: 8 });
		await expect.poll(() => list.evaluate((element) => element.getAnimations({ subtree: true })
			.filter((animation) => animation.playState === "running" && animation.effect?.getTiming().iterations !== Infinity).length)).toBe(0);
		// Place the desired seam in the neutral middle before releasing the drag.
		await list.evaluate((element) => {
			const before = element.querySelector('[data-issue-key="PAY-119"]')!.getBoundingClientRect();
			const after = element.querySelector('[data-issue-key="PAY-132"]')!.getBoundingClientRect();
			const clip = element.getBoundingClientRect();
			element.scrollTop += (before.bottom + after.top) / 2 - (clip.top + clip.bottom) / 2;
		});
		const next = column.locator('[data-board-agent-session-drop-zone="issue"][data-issue-key="PAY-132"]');
		const box = (await next.boundingBox())!;
		// Enter horizontally so crossing the top scroll zone cannot move the measured seam.
		await page.mouse.move(viewport.x - 24, box.y - 2, { steps: 8 });
		await page.mouse.move(box.x + box.width / 2, box.y - 2, { steps: 8 });
		await expect(next.locator("[data-insertion-line]")).toBeVisible();
		await page.screenshot({ path: `output/agent-browser/inline-create-after-scroll-${reducedMotion}.png` });
		await page.mouse.up();
		await expect(cards).toHaveCount(9);
		await expect(cards.nth(2)).toHaveAttribute("data-issue-key", "PAY-119");
		await expect(cards.nth(4)).toHaveAttribute("data-issue-key", "PAY-132");
		await expect(cards.nth(3).locator('[data-slot="jira-issue-agent-row"]')).toHaveCount(1);
		await expect(page.locator("[data-agent-session-column]").getByTestId(sourceId!)).toHaveCount(0);
	});

	test(`session drag accelerates toward both scroll edges (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		const source = await openBoard(page);
		await page.setViewportSize({ width: 1440, height: 760 });
		const column = page.locator('[data-jira-kanban-column="In review"]');
		const list = column.locator("[data-jira-kanban-card-list]");
		await startDrag(page, source);
		const box = (await list.boundingBox())!;
		const centerX = box.x + box.width / 2;
		await page.mouse.move(centerX, box.y + box.height - 110, { steps: 8 });
		await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(10);
		const approachDown = await measureDragScrollSpeed(list);
		await page.mouse.move(centerX, box.y + box.height - 48, { steps: 8 });
		const well = column.locator('[data-board-agent-session-drop-zone="create"]');
		await expect.poll(async () => (await well.boundingBox())!.height).toBeGreaterThanOrEqual(64);
		await list.evaluate((element) => { element.scrollTop = 100; });
		const edgeDown = await measureDragScrollSpeed(list);
		expect(edgeDown).toBeGreaterThan(approachDown * 2);
		await page.mouse.move(centerX, box.y + box.height / 2, { steps: 8 });
		await expect.poll(async () => (await well.boundingBox())!.height).toBe(32);
		await list.evaluate((element) => { element.scrollTop = 500; });
		const parked = await list.evaluate((element) => element.scrollTop);
		await page.mouse.move(centerX, box.y + 110, { steps: 8 });
		await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeLessThan(parked - 10);
		const approachUp = await measureDragScrollSpeed(list);
		await page.mouse.move(centerX, box.y + 16, { steps: 8 });
		// Pointer travel can consume the remaining scroll distance before sampling.
		await list.evaluate((element) => { element.scrollTop = 500; });
		const edgeUp = await measureDragScrollSpeed(list);
		expect(edgeUp).toBeGreaterThan(approachUp * 2);
		await test.info().attach(`development-scroll-speeds-${reducedMotion}`, {
			body: JSON.stringify({ approachDown, edgeDown, approachUp, edgeUp }),
			contentType: "application/json",
		});
		await page.keyboard.press("Escape");
		await page.mouse.up();
	});

	test(`session links to an issue reached by dragging and scrolling (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		const source = await openBoard(page);
		const sourceId = await source.getAttribute("data-testid");
		await page.setViewportSize({ width: 1440, height: 760 });
		const column = page.locator('[data-jira-kanban-column="In review"]');
		const list = column.locator("[data-jira-kanban-card-list]");
		const issue = list.locator('[data-issue-key="PAY-128"]');
		await startDrag(page, source);
		const box = (await list.boundingBox())!;
		await page.mouse.move(box.x + box.width / 2, box.y + box.height - 48, { steps: 8 });
		await expect.poll(() => list.evaluate((element) => (
			element.scrollHeight - element.clientHeight - element.scrollTop
		)), { timeout: 10_000 }).toBeLessThan(2);
		const card = (await issue.boundingBox())!;
		const viewport = (await list.boundingBox())!;
		await page.mouse.move(card.x + card.width / 2, viewport.y + viewport.height / 2, { steps: 8 });
		const parked = await list.evaluate((element) => element.scrollTop);
		await page.mouse.wheel(0, -40);
		await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeLessThan(parked - 20);
		const movedCard = (await issue.boundingBox())!;
		await page.mouse.move(movedCard.x + movedCard.width / 2, movedCard.y + 40, { steps: 8 });
		await page.mouse.up();
		await expect(page.locator("[data-agent-session-column]").getByTestId(sourceId!)).toHaveCount(0);
		await expect(issue.locator('[data-slot="jira-issue-agent-row"]')).toHaveCount(1);
		await page.screenshot({ path: `output/agent-browser/session-scroll-linked-issue-${reducedMotion}.png` });
	});

	test(`session drag scrolls overflowing issues above the expanding footer (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		const source = await openBoard(page);
		await page.setViewportSize({ width: 1440, height: 760 });
		const column = page.locator('[data-jira-kanban-column="In review"]');
		const list = column.locator("[data-jira-kanban-card-list]");
		const initialHeight = await list.evaluate((element) => element.clientHeight);
		const initialCardCount = await list.locator("[data-issue-key]").count();
		await startDrag(page, source);
		const dragHeight = await list.evaluate((element) => element.clientHeight);
		expect(dragHeight).toBe(initialHeight - 8);
		const box = (await list.boundingBox())!;
		// Start well away from the edge; the former 56px band did not scroll here.
		await page.mouse.move(box.x + box.width / 2, box.y + box.height - 110, { steps: 8 });
		await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(120);
		const scrolled = await list.evaluate((element) => element.scrollTop);
		await page.mouse.move(box.x + box.width / 2, box.y + 110, { steps: 8 });
		await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeLessThan(scrolled - 80);
		const well = column.locator('[data-board-agent-session-drop-zone="create"]');
		const footer = (await well.boundingBox())!;
		await page.mouse.move(footer.x + footer.width / 2, footer.y + footer.height - 8, { steps: 8 });
		await expect.poll(async () => (await well.boundingBox())!.height).toBeGreaterThanOrEqual(64);
		await expect.poll(() => list.evaluate((element) => element.clientHeight)).toBe(dragHeight);
		const expanded = (await well.boundingBox())!;
		const viewport = (await list.boundingBox())!;
		expect(viewport.y + viewport.height - expanded.y).toBeLessThanOrEqual(40);
		const stopped = await list.evaluate((element) => element.scrollTop);
		await page.waitForTimeout(200);
		expect(await list.evaluate((element) => element.scrollTop)).toBe(stopped);
		await page.screenshot({ path: `output/agent-browser/session-drag-scroll-footer-${reducedMotion}.png` });
		await page.mouse.move(900, 100, { steps: 8 });
		await page.mouse.up();
		await expect.poll(() => list.evaluate((element) => element.clientHeight)).toBe(initialHeight);
		const afterCancel = await list.evaluate((element) => element.scrollTop);
		await page.waitForTimeout(200);

		expect(await list.evaluate((element) => element.scrollTop)).toBe(afterCancel);
		await expect(list.locator("[data-issue-key]")).toHaveCount(initialCardCount);
		await expect(source).toBeVisible();
	});

	test(`create target fills downward from the persistent button in proximity (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		const source = await openBoard(page);
		const sourceId = await source.getAttribute("data-testid");
		const column = page.locator('[data-jira-kanban-column="To do"]');
		const list = column.locator("[data-jira-kanban-card-list]");
		const button = column.getByRole("button", { name: "Create in To do" });
		const buttonBox = (await button.boundingBox())!;
		const before = await readList(list);
		const initialCount = await list.locator("[data-issue-key]").count();
		await startDrag(page, source);
		const well = column.locator('[data-board-agent-session-drop-zone="create"]');
		await page.mouse.move(900, 100, { steps: 8 });
		await expect.poll(async () => Math.round((await well.boundingBox())!.height)).toBe(32);
		const compact = (await well.boundingBox())!;
		expect(compact.y).toBeCloseTo(buttonBox.y, 0);
		const backdrop = column.locator("[data-jira-kanban-column-backdrop]");
		await expect(backdrop).toHaveCSS("opacity", "1");
		expect(await backdrop.evaluate((node) => getComputedStyle(node).clipPath)).not.toBe("none");
		const sensor = column.locator("[data-create-work-item-proximity]");
		const sensorBox = (await sensor.boundingBox())!;
		expect(sensorBox.y).toBeCloseTo(compact.y, 0);
		expect(sensorBox.height).toBeGreaterThan(200);
		const centerX = compact.x + compact.width / 2;
		await page.mouse.move(centerX, compact.y - 12, { steps: 8 });
		await expect(well).toHaveAttribute("data-proximity", "near");
		await expect.poll(async () => (await well.boundingBox())!.height).toBeCloseTo(sensorBox.height, 0);
		await expect(backdrop).toHaveCSS("opacity", "1");
		const columnBox = (await column.boundingBox())!;
		const backdropBox = (await backdrop.boundingBox())!;
		expect(backdropBox.y + backdropBox.height).toBeCloseTo(columnBox.y + columnBox.height - 2, 0);
		expect(backdropBox.y + backdropBox.height).toBeGreaterThan(compact.y + compact.height);
		await page.mouse.move(centerX, compact.y + 100, { steps: 8 });
		await expect(well).toHaveAttribute("data-armed", "true");
		const expanded = (await well.boundingBox())!;
		expect(Math.abs(expanded.y - compact.y)).toBeLessThanOrEqual(10.5);
		expect(Math.abs(expanded.y + expanded.height - sensorBox.y - sensorBox.height)).toBeLessThanOrEqual(10.5);
		expect(await sensor.boundingBox()).toEqual(sensorBox);
		expect(await readList(list)).toEqual(before);
		await expect.poll(() => page.locator('[data-board-agent-session-drop-zone="create"]').evaluateAll((elements) => elements.slice(1).map((element) => Math.round(element.getBoundingClientRect().height))))
			.toEqual([32, 32, 32]);
		const height = expanded.height;
		await page.setViewportSize({ width: 1440, height: 1200 });
		await expect.poll(async () => (await well.boundingBox())!.height).toBeGreaterThan(height + 90);
		const resized = (await sensor.boundingBox())!;
		await page.mouse.move(centerX, resized.y + resized.height / 2, { steps: 8 });
		await expect(well).toHaveAttribute("data-armed", "true");
		await page.screenshot({ path: `output/agent-browser/reactive-dropzone-${reducedMotion}.png` });
		await page.mouse.up();
		await expect(list.locator("[data-issue-key]")).toHaveCount(initialCount + 1);
		await expect(page.locator("[data-agent-session-column]").getByTestId(sourceId!)).toHaveCount(0);
	});
}

test("empty columns keep the persistent create button directly below the header", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await openBoard(page);
	const column = page.locator('[data-jira-kanban-column="To do"]');
	const button = column.getByRole("button", { name: "Create in To do" });
	const populated = await readCreateInset(column, button);
	await page.getByRole("button", { name: "Filter board by Codex" }).click();
	const expand = page.getByRole("button", { name: "Expand To do column" });
	if (await expand.isVisible()) {
		await expand.focus();
		await page.keyboard.press("Enter");
	}
	await expect(column.locator("[data-issue-key]")).toHaveCount(0);
	await page.getByRole("heading", { name: "Jira Design", exact: true }).hover();
	await expect(button).toHaveCSS("opacity", "1");
	await expect(button).toHaveCSS("pointer-events", "auto");
	const box = (await button.boundingBox())!;
	const columnBox = (await column.boundingBox())!;
	expect(box.y - columnBox.y).toBeLessThan(60);
	expect(await readCreateInset(column, button)).toEqual(populated);
	await column.getByRole("button", { name: "Collapse To do column" }).focus();
	await page.keyboard.press("Tab");
	await expect(button).toBeFocused();
});

for (const reducedMotion of ["reduce", "no-preference"] as const) {
	test(`empty columns fill downward and restore creation after cancellation (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await openBoard(page);
		await page.getByRole("button", { name: "Filter board by Codex" }).click();
		const expand = page.getByRole("button", { name: "Expand To do column" });
		if (await expand.isVisible()) {
			await expand.focus();
			await page.keyboard.press("Enter");
		}
		const source = page.locator('[data-agent-session-column] [data-testid^="agent-session-row-"]').first();
		const column = page.locator('[data-jira-kanban-column="To do"]');
		await expect(column.locator("[data-issue-key]")).toHaveCount(0);
		const button = column.getByRole("button", { name: "Create in To do" });
		await expect.poll(() => button.evaluate((node) => {
			const transform = getComputedStyle(node).transform;
			return transform === "none" || new DOMMatrixReadOnly(transform).isIdentity;
		})).toBe(true);
		const before = (await button.boundingBox())!;
		await startDrag(page, source, await page.locator("[data-jira-kanban-card-list]").count());
		const well = column.locator('[data-board-agent-session-drop-zone="create"]');
		await page.mouse.move(900, 100, { steps: 8 });
		const compact = (await well.boundingBox())!;
		const sensor = column.locator("[data-create-work-item-proximity]");
		const sensorBox = (await sensor.boundingBox())!;
		await page.mouse.move(compact.x + compact.width * 0.75, compact.y + 100, { steps: 8 });
		await expect.poll(async () => (await well.boundingBox())!.height).toBeGreaterThan(700);
		const box = (await well.boundingBox())!;
		expect(Math.abs(box.y - compact.y)).toBeLessThanOrEqual(10.5);
		expect(Math.abs(box.y + box.height - sensorBox.y - sensorBox.height)).toBeLessThanOrEqual(10.5);
		if (reducedMotion === "no-preference") {
			await expect.poll(async () => (await well.boundingBox())!.x - compact.x).toBeGreaterThan(1);
		}
		expect(Math.abs((await well.boundingBox())!.x - compact.x)).toBeLessThanOrEqual(10.5);
		expect(await sensor.boundingBox()).toEqual(sensorBox);
		await expect(well).toHaveAttribute("data-armed", "true");
		await page.mouse.move(900, 100, { steps: 8 });
		await page.mouse.up();
		await expect(well).toHaveCount(0);
		await expect(button).toBeVisible();
		await expect.poll(() => button.boundingBox()).toEqual(before);
		await expect(source).toBeVisible();
	});

	test(`small bottom gaps fill down then extend up to the 64px minimum (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		const source = await openBoard(page);
		await page.setViewportSize({ width: 1440, height: 760 });
		const column = page.locator('[data-jira-kanban-column="In review"]');
		const list = column.locator("[data-jira-kanban-card-list]");
		await list.evaluate((element) => { element.scrollTop = 100; });
		const before = await readList(list);
		const button = column.getByRole("button", { name: "Create in In review" });
		const buttonBox = (await button.boundingBox())!;
		await startDrag(page, source);
		await page.mouse.move(900, 100, { steps: 8 });
		const well = column.locator('[data-board-agent-session-drop-zone="create"]');
		const sensor = column.locator("[data-create-work-item-proximity]");
		const sensorBox = (await sensor.boundingBox())!;
		const columnBox = (await column.boundingBox())!;
		const bottom = columnBox.y + columnBox.height - 10;
		const available = bottom - buttonBox.y;
		expect(available).toBeGreaterThan(0);
		expect(available).toBeLessThan(64);
		expect(sensorBox.height).toBe(64);
		expect(sensorBox.y + sensorBox.height).toBeCloseTo(bottom, 0);
		const x = sensorBox.x + sensorBox.width / 2;
		await page.evaluate(() => {
			const trace = { running: true, projectionY: [] as number[] };
			Object.assign(window, { bottomAnchoredWellTrace: trace });
			const started = performance.now();
			function sample() {
				const button = document.querySelector('[data-jira-dropzone-control="In review"]')!;
				const transform = getComputedStyle(button).transform;
				trace.projectionY.push(transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42);
				if (trace.running && performance.now() - started < 10000) requestAnimationFrame(sample);
			}
			requestAnimationFrame(sample);
		});
		await page.mouse.move(x, sensorBox.y - 12, { steps: 8 });
		await expect(well).toHaveAttribute("data-proximity", "near");
		await expect.poll(async () => (await well.boundingBox())!.height).toBe(64);
		for (const y of [bottom - 12, bottom - 40, bottom - 60]) {
			await page.mouse.move(x, y, { steps: 4 });
			await expect(well).toHaveAttribute("data-armed", "true");
			const box = (await well.boundingBox())!;
			expect(Math.abs(box.y + box.height - bottom)).toBeLessThanOrEqual(10.5);
			expect(box.y).toBeLessThan(buttonBox.y);
			expect(await sensor.boundingBox()).toEqual(sensorBox);
		}
		expect((await readList(list)).height).toBe(before.height - 8);
		await page.waitForTimeout(200);
		const parked = await list.evaluate((element) => element.scrollTop);
		await page.waitForTimeout(200);
		expect(await list.evaluate((element) => element.scrollTop)).toBe(parked);
		await page.screenshot({ path: `output/agent-browser/anchored-full-dropzone-${reducedMotion}.png` });
		await page.keyboard.press("Escape");
		await page.mouse.up();

		await expect(button).toBeVisible();
		await expect.poll(() => button.boundingBox()).toEqual(buttonBox);
		const projectionY = await page.evaluate(() => {
			const trace = (window as typeof window & { bottomAnchoredWellTrace: { running: boolean; projectionY: number[] } }).bottomAnchoredWellTrace;
			trace.running = false;
			return trace.projectionY;
		});
		expect(projectionY.length).toBeGreaterThan(10);
		expect(Math.max(...projectionY.map(Math.abs))).toBeLessThanOrEqual(0.1);
	});
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`filtered dropzone keeps one copy inside its shape on every frame (${reducedMotion})`, async ({ page }) => {
		test.setTimeout(90_000);
		await page.emulateMedia({ reducedMotion });
		await openBoard(page);
		// Keep MutationObserver and Motion on the native clock in both modes.
		// Virtual frame timers can sample before native observer microtasks run.
		await page.waitForTimeout(45_000);
		await page.getByRole("button", { name: /^Needs input:/ }).click();
		const expandTodo = page.getByRole("button", { name: "Expand To do column" });
		if (await expandTodo.isVisible()) {
			await expandTodo.focus();
			await page.keyboard.press("Enter");
		}
		const todo = page.locator('[data-jira-kanban-column="In review"]');
		await expect(todo.locator("[data-issue-key]")).toHaveCount(1);
		await expect(todo.locator('[data-slot="jira-issue-agent-row"]')).toBeVisible();
		const expandProgress = page.getByRole("button", { name: "Expand In progress column" });
		if (await expandProgress.isVisible()) {
			await expandProgress.focus();
			await page.keyboard.press("Enter");
		}
		await page.getByRole("heading", { name: "Jira Design", exact: true }).hover();
		const source = page.locator('[data-agent-session-column] [data-testid^="agent-session-row-"]').first();
		await source.scrollIntoViewIfNeeded();
		await page.evaluate(() => {
			const trace = { stage: "enter", running: true, frames: [] as { stage: string; column: string; overhang: number; copies: number; delta: number; backdropGap: number; backdropDetails: string; buttonTransform: string; copyTransform: string }[] };
			Object.assign(window, { containedDropzoneTrace: trace });
			const started = performance.now();
			function sample() {
				for (const button of document.querySelectorAll<HTMLElement>("[data-jira-dropzone-control]")) {
					const copies = [...button.querySelectorAll<HTMLElement>("[data-jira-dropzone-copy-motion]")];
					const viewport = copies[0]?.parentElement;
					if (!viewport) continue;
					const shape = button.getBoundingClientRect();
					const content = viewport.getBoundingClientRect();
					const column = button.closest("[data-jira-kanban-column]")!;
					const background = column.querySelector<HTMLElement>("[data-jira-kanban-column-backdrop]")!;
					const backgroundRect = background.getBoundingClientRect();
					const natural = column.querySelector("[data-jira-kanban-column-content]")!.getBoundingClientRect();
					const targetRect = column.querySelector("[data-create-work-item-proximity]")!.getBoundingClientRect();
					const bottomClip = parseFloat(getComputedStyle(background).clipPath.split("round")[0].replace("inset(", "").trim().split(/\s+/)[2]) || 0;
					const expectedBottom = Math.min(backgroundRect.bottom, Math.max(natural.bottom, shape.bottom + targetRect.left - natural.left));
					trace.frames.push({
						stage: trace.stage,
						column: button.dataset.jiraDropzoneControl!,
						overhang: Math.max(0, shape.left - content.left, content.right - shape.right, shape.top - content.top, content.bottom - shape.bottom),
						copies: copies.length,
						delta: Math.abs((content.top + content.bottom - shape.top - shape.bottom) / 2),
						backdropGap: Math.abs(backgroundRect.bottom - bottomClip - expectedBottom),
						backdropDetails: JSON.stringify({ clip: getComputedStyle(background).clipPath, background: backgroundRect.bottom, bottomClip, expectedBottom, naturalBottom: natural.bottom, shapeBottom: shape.bottom }),
						buttonTransform: getComputedStyle(button).transform,
						copyTransform: getComputedStyle(viewport).transform,
					});
				}
				if (trace.running && performance.now() - started < 6000) requestAnimationFrame(() => setTimeout(sample, 0));
			}
			requestAnimationFrame(() => setTimeout(sample, 0));
		});
		const box = (await source.boundingBox())!;
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 20, { steps: 5 });
		await expect(page.locator('[data-board-agent-session-drop-zone="create"]')).toHaveCount(3);
		await page.mouse.move(900, 100, { steps: 4 });
		await page.waitForTimeout(280);
		const dragButton = todo.getByRole("button", { name: /^Drop to create work item/ });
		await expect(dragButton).toHaveCSS("height", "32px");
		const sensor = todo.locator("[data-create-work-item-proximity]");
		const sensorBox = (await sensor.boundingBox())!;
		const stage = async (value: string) => page.evaluate((next) => {
			(window as typeof window & { containedDropzoneTrace: { stage: string } }).containedDropzoneTrace.stage = next;
		}, value);
		for (let index = 0; index < 2; index += 1) {
			await stage("expand");
			await page.mouse.move(sensorBox.x + sensorBox.width / 2, sensorBox.y + sensorBox.height / 2, { steps: 4 });
			await page.waitForTimeout(220);
			await expect.poll(async () => (await dragButton.boundingBox())!.height).toBeCloseTo(sensorBox.height, 0);
			await stage("collapse");
			await page.mouse.move(900, 100, { steps: 4 });
			await page.waitForTimeout(220);
		}
		await stage("exit");
		await page.mouse.up();
		await page.waitForTimeout(280);
		const frames = await page.evaluate(() => {
			const trace = (window as typeof window & { containedDropzoneTrace: { running: boolean; frames: { stage: string; column: string; overhang: number; copies: number; delta: number; backdropGap: number; backdropDetails: string; buttonTransform: string; copyTransform: string }[] } }).containedDropzoneTrace;
			trace.running = false;
			return trace.frames;
		});
		const { writeFile } = await import("node:fs/promises");
		await writeFile(`output/agent-browser/dropzone-motion-side/contained-copy-${reducedMotion}.json`, JSON.stringify(frames, null, 2));
		await page.screenshot({ path: `output/agent-browser/dropzone-motion-side/contained-copy-${reducedMotion}.png` });
		expect(frames.length).toBeGreaterThan(20);
		expect(frames.every((frame) => frame.buttonTransform === "none")).toBe(true);
		expect(Math.max(...frames.map((frame) => frame.overhang)), JSON.stringify(frames.filter((frame) => frame.overhang > 1.5).slice(0, 4))).toBeLessThanOrEqual(1.5);
		expect(Math.max(...frames.map((frame) => frame.copies))).toBeLessThanOrEqual(1);
		expect(Math.max(...frames.map((frame) => frame.delta))).toBeLessThanOrEqual(1.5);
		expect(Math.max(...frames.map((frame) => frame.backdropGap)), JSON.stringify(frames.filter((frame) => frame.backdropGap > 1.5).slice(0, 3))).toBeLessThanOrEqual(1.5);
	});

	test(`one button grows from 24px to 32px at drag start and returns (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion, colorScheme: "light" });
		const source = await openBoard(page);
		const column = page.locator('[data-jira-kanban-column="To do"]');
		const button = column.getByRole("button", { name: "Create in To do" });
		await expect(button).toHaveCSS("height", "24px");
		const original = (await button.elementHandle())!;
		await page.evaluate(() => {
			const trace = { stage: "enter", frames: [] as { stage: string; kind: string; opacity: number; offset: number; height: number; nativeHeight: number; stale: boolean; addOpacity: number; labelOpacity: number }[], running: true };
			Object.assign(window, { sharedControlTrace: trace });
			const started = performance.now();
			function sample() {
				for (const copy of document.querySelectorAll('[data-jira-dropzone-control="To do"] [data-jira-dropzone-copy-motion]')) {
					const style = getComputedStyle(copy);
					const add = copy.querySelector('[data-jira-dropzone-copy-layer="add"]');
					const label = copy.querySelector('[data-jira-dropzone-copy-layer="label"]');
					const control = document.querySelector<HTMLElement>('[data-jira-dropzone-control="To do"]')!;
					trace.frames.push({
						stage: trace.stage,
						kind: copy.getAttribute("data-jira-dropzone-copy-motion")!,
						height: control.getBoundingClientRect().height,
						nativeHeight: control.offsetHeight,
						stale: copy.getAttribute("data-jira-dropzone-copy-motion") !== (control.getAttribute("aria-label")?.startsWith("Drop to create work item") ? "label" : "add"),
							opacity: Number(style.opacity),
							addOpacity: add ? Number(getComputedStyle(add).opacity) : 0,
							labelOpacity: label ? Number(getComputedStyle(label).opacity) : 0,
						offset: style.transform === "none" ? 0 : new DOMMatrixReadOnly(style.transform).m42,
					});
				}
				if (trace.running && performance.now() - started < 10000) requestAnimationFrame(() => setTimeout(sample, 0));
			}
			requestAnimationFrame(() => setTimeout(sample, 0));
		});
		const sourceBox = (await source.boundingBox())!;
		await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
		await page.mouse.down();
		await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 20, sourceBox.y + sourceBox.height / 2 + 20, { steps: 5 });
		const target = column.getByRole("button", { name: /^Drop to create work item in To do/ });
		await expect(target).toBeVisible();
		expect(await original.evaluate((node) => node === document.querySelector('[data-jira-dropzone-control="To do"]'))).toBe(true);
		await page.mouse.move(900, 100, { steps: 8 });
		await expect(target).toHaveCSS("height", "32px");
		await expect(target).toHaveCSS("background-color", "rgb(255, 255, 255)");
		await expect(target).toHaveAttribute("aria-disabled", "true");
		await page.waitForTimeout(180);
		await expect(target.locator('[data-jira-dropzone-copy-motion="add"]')).toHaveCount(0);
		await page.screenshot({ path: `output/agent-browser/dropzone-motion-side/shared-control-${reducedMotion}.png` });
		const sensor = column.locator("[data-create-work-item-proximity]");
		const sensorBox = (await sensor.boundingBox())!;
		await page.evaluate(() => {
			(window as typeof window & { sharedControlTrace: { stage: string } }).sharedControlTrace.stage = "expand";
		});
		await page.mouse.move(sensorBox.x + sensorBox.width / 2, sensorBox.y + sensorBox.height / 2, { steps: 8 });
		await expect.poll(async () => (await target.boundingBox())!.height).toBeCloseTo(sensorBox.height, 0);
		expect(await sensor.boundingBox()).toEqual(sensorBox);
		await expect(target).toHaveCSS("background-color", "rgb(233, 242, 254)");
		await page.mouse.move(900, 100, { steps: 8 });
		await expect(target).toHaveCSS("height", "32px");

		await page.evaluate(() => {
			(window as typeof window & { sharedControlTrace: { stage: string } }).sharedControlTrace.stage = "exit";
		});
		await page.mouse.up();
		await expect(button).toBeVisible();
		await expect(button).toHaveCSS("height", "24px");
		expect(await original.evaluate((node) => node === document.querySelector('[data-jira-dropzone-control="To do"]'))).toBe(true);
		await page.waitForTimeout(180);
		await expect(button.locator('[data-jira-dropzone-copy-motion="label"]')).toHaveCount(0);
		await expect(button.locator('[data-jira-dropzone-copy-motion="add"]')).toHaveCSS("opacity", "1");
		const frames = await page.evaluate(() => {
			const trace = (window as typeof window & { sharedControlTrace: { running: boolean; frames: { stage: string; kind: string; opacity: number; offset: number; height: number; nativeHeight: number; stale: boolean; addOpacity: number; labelOpacity: number }[] } }).sharedControlTrace;
			trace.running = false;
			return trace.frames;
		});
		const { writeFile } = await import("node:fs/promises");
		await writeFile(`output/agent-browser/dropzone-motion-side/shared-control-frames-${reducedMotion}.json`, JSON.stringify(frames, null, 2));
		expect(frames.filter((frame) => frame.stale)).toEqual([]);
		if (reducedMotion === "reduce") {
			expect(frames.every((frame) => Math.abs(frame.offset) < 0.01)).toBe(true);
		} else {
			expect(frames.some((frame) => frame.stage === "enter" && frame.height > 24 && frame.height < 32)).toBe(true);
			expect(frames.some((frame) => frame.stage === "expand" && frame.height > 32.1 && frame.height < sensorBox.height - 0.1)).toBe(true);
			expect(frames.some((frame) => frame.stage === "exit" && frame.height > 24 && frame.height < 32)).toBe(true);
			for (const stage of ["enter", "exit"]) {
				expect(frames.some((frame) => frame.stage === stage && frame.addOpacity > 0.01 && frame.addOpacity < 0.99 && frame.labelOpacity > 0.01 && frame.labelOpacity < 0.99)).toBe(true);
			}
			expect(frames.every((frame) => Math.abs(frame.height - frame.nativeHeight) < 0.6)).toBe(true);
			expect(frames.every((frame) => frame.opacity === 1 && Math.abs(frame.offset) < 0.01)).toBe(true);
		}
	});
}
