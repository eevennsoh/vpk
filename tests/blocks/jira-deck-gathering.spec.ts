import { expect, test, type Page } from "@playwright/test";

const origin = process.env.PLAYWRIGHT_BASE_URL ?? "https://26b9.localhost";
const codes = ["PAY-105", "PAY-107", "PAY-123", "PAY-130"];
const card = (page: Page, code: string) => page.locator(`[data-jira-kanban-scrollport] [data-issue-key="${code}"] [draggable="true"]`).first();
const preview = (page: Page) => page.locator('[data-issue-cohort-preview]');
declare global {
	interface Window {
		issueGatherAnimations: Animation[];
		issueGatherPointer: string;
		issueGatherOffset: { x: number; y: number };
	}
}

test.use({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });

async function holdGathering(page: Page) {
	await page.addInitScript(() => {
		const state = window;
		state.issueGatherAnimations = [];
		const animate = Element.prototype.animate;
		Element.prototype.animate = function (keyframes, options) {
			const animation = animate.call(this, keyframes, options);
			if (this.hasAttribute("data-issue-deck-layer")) {
				animation.pause();
				animation.currentTime = 0;
				state.issueGatherAnimations.push(animation);
			}
			return animation;
		};
		const track = (event: DragEvent) => { state.issueGatherPointer = `${event.clientX},${event.clientY}`; };
		document.addEventListener("dragenter", track, true);
		document.addEventListener("dragover", track, true);
		document.addEventListener("dragstart", (event) => {
			const face = (event.target as HTMLElement).querySelector('[data-slot="jira-issue-surface"]')!.getBoundingClientRect();
			state.issueGatherOffset = { x: event.clientX - face.x, y: event.clientY - face.y };
		}, true);
	});
}

async function select(page: Page, count: number) {
	await card(page, codes[0]).click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
	if (count > 1) await card(page, codes[count - 1]).click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
	// Selection already animates its joined wells. Measure the gathering after
	// that existing layout change has settled, using rendered geometry.
	await expect.poll(() => page.evaluate(async () => {
		const faces = [...document.querySelectorAll('[data-jira-kanban-column="To do"] [data-slot="jira-issue-surface"]')];
		const before = faces.map((face) => face.getBoundingClientRect().y);
		await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
		return faces.every((face, index) => Math.abs(face.getBoundingClientRect().y - before[index]) < 0.01);
	})).toBe(true);
}

async function start(page: Page, code: string) {
	const source = (await card(page, code).boundingBox())!;
	await page.mouse.move(source.x + 70, source.y + 30);
	await page.mouse.down();
	await page.mouse.move(source.x + 95, source.y + 35, { steps: 5 });
	await expect(card(page, code)).toHaveAttribute("data-dragging", "true");
	await expect(preview(page)).toBeVisible();
}

async function seek(page: Page, time: number) {
	await page.evaluate((nextTime) => {
		for (const animation of window.issueGatherAnimations) {
			if (animation.playState !== "idle") animation.currentTime = nextTime;
		}
	}, time);
}

async function move(page: Page, x: number, y: number) {
	await page.mouse.move(x - 1, y);
	await page.mouse.move(x, y);
	await expect.poll(() => page.evaluate(() => window.issueGatherPointer)).toBe(`${x},${y}`);
	await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	for (const count of [1, 2, 3, 4]) {
		test(`${count} selected cards keep a plain deck and immediate cursor tracking (${reducedMotion})`, async ({ page }) => {
			await holdGathering(page);
			await page.emulateMedia({ reducedMotion });
			await page.goto(`${origin}/preview/blocks/jira-dragging`);
			await page.waitForLoadState("networkidle");
			await select(page, count);
			const grabbed = codes[Math.floor(count / 2)];
			const original = await page.locator('[data-jira-kanban-column="To do"] [data-slot="jira-issue-surface"]').evaluateAll((nodes) => nodes.map((node) => {
				const bounds = node.getBoundingClientRect();
				return { code: node.closest<HTMLElement>('[data-issue-key]')!.dataset.issueKey, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
			}));
			await start(page, grabbed);
			const traveller = preview(page);
			const front = traveller.locator('[data-issue-cohort-front]');
			const layers = traveller.locator('[data-issue-deck-layer]');
			const rearCount = Math.min(count - 1, 2);
			await expect(traveller).toHaveAttribute("data-issue-cohort-count", String(count));
			await expect(front).toContainText(grabbed);
			await expect(front).toHaveCSS("transform", "none");
			await expect(layers).toHaveCount(rearCount);
			await expect(traveller.locator('[data-slot="jira-issue-surface"]')).toHaveCount(1);
			await expect(traveller).toHaveAttribute("aria-hidden", "true");
			await expect(traveller).toHaveAttribute("inert", "");
			await expect(traveller.locator('[data-slot="badge"]')).toHaveCount(count > 1 ? 1 : 0);
			if (count > 1) await expect(traveller.locator('[data-slot="badge"]')).toHaveText(String(count));
			const timings = await page.evaluate(() => window.issueGatherAnimations.map((animation) => animation.effect!.getTiming()));
			expect(timings).toHaveLength(reducedMotion === "reduce" ? 0 : rearCount);
			for (const [index, timing] of timings.entries()) {
				expect(timing.duration).toBe(250);
				expect(timing.delay).toBe(index * 35);
			}
			const anchorBox = (await traveller.boundingBox())!;
			const frontBox = (await front.boundingBox())!;
			expect(frontBox.x).toBeCloseTo(anchorBox.x, 1);
			expect(frontBox.y).toBeCloseTo(anchorBox.y, 1);
			const startingBoxes = [];
			for (const layer of await layers.all()) {
				await expect(layer).toBeEmpty();
				await expect(layer.locator("*")).toHaveCount(0);
				const box = (await layer.boundingBox())!;
				startingBoxes.push(box);
				if (reducedMotion === "no-preference") {
					// Even a selected card above the grabbed card starts nearby and
					// underneath it, rather than travelling from its board position.
					expect(box.y - anchorBox.y).toBeGreaterThan(0);
					expect(box.y - anchorBox.y).toBeLessThan(40);
					expect(Math.abs(box.x - anchorBox.x)).toBeLessThan(16);
				}
			}
			if (reducedMotion === "no-preference") {
				await seek(page, 100);
				for (const [index, layer] of (await layers.all()).entries()) {
					const box = (await layer.boundingBox())!;
					expect(box.y).toBeLessThan(startingBoxes[index].y);
					expect(box.x).toBeCloseTo(startingBoxes[index].x, 1);
				}
			}
			// Move rapidly while the rear animations are still in flight. Only the
			// traveller changes; the animation time and the source cards stay put.
			const first = (await traveller.boundingBox())!;
			await move(page, 1100, 100);
			const moved = (await traveller.boundingBox())!;
			expect(Math.abs(moved.x - first.x)).toBeGreaterThan(100);
			const offset = await page.evaluate(() => window.issueGatherOffset);
			expect(moved.x).toBeCloseTo(1100 - offset.x, 0);
			expect(moved.y).toBeCloseTo(100 - offset.y, 0);
			if (reducedMotion === "no-preference") {
				expect(await page.evaluate(() => window.issueGatherAnimations.map((animation) => animation.currentTime))).toEqual(Array.from({ length: rearCount }, () => 100));
				await seek(page, 300);
			}
			for (const [index, layer] of (await layers.all()).entries()) {
				const finished = await layer.evaluate((node) => ({ actual: [...new DOMMatrix(getComputedStyle(node).transform).toFloat64Array()], expected: [...new DOMMatrix((node as HTMLElement).style.transform).toFloat64Array()] }));
				finished.actual.forEach((value, index) => expect(value).toBeCloseTo(finished.expected[index], 5));
				const rear = (await layer.boundingBox())!;
				const anchor = (await traveller.boundingBox())!;
				expect(rear.y + rear.height).toBeGreaterThan(anchor.y + anchor.height);
				if (reducedMotion === "no-preference") {
					expect((startingBoxes[index].y - anchorBox.y) - (rear.y - anchor.y)).toBeCloseTo(24, 0);
					expect(startingBoxes[index].width).toBeCloseTo(rear.width, 0);
					expect(startingBoxes[index].height).toBeCloseTo(rear.height, 0);
				}
			}
			await seek(page, 100);
			await page.keyboard.press("Escape");
			await page.mouse.up();
			await expect(traveller).toHaveCount(0);
			await expect(page.locator('[data-issue-cohort-drag-image]')).toHaveCount(0);
			expect(await page.evaluate(() => window.issueGatherAnimations.map((animation) => animation.playState))).toEqual(Array.from({ length: reducedMotion === "reduce" ? 0 : rearCount }, () => "idle"));
			const after = await page.locator('[data-jira-kanban-column="To do"] [data-slot="jira-issue-surface"]').evaluateAll((nodes) => nodes.map((node) => {
				const bounds = node.getBoundingClientRect();
				return { code: node.closest<HTMLElement>('[data-issue-key]')!.dataset.issueKey, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
			}));
			expect(after).toEqual(original);
		});
	}
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	for (const count of [2, 3]) {
		test(`cancelled ${count}-card pickups always change the next stack (${reducedMotion})`, async ({ page }) => {
			await holdGathering(page);
			await page.emulateMedia({ reducedMotion });
			await page.goto(`${origin}/preview/blocks/jira-dragging`);
			await page.waitForLoadState("networkidle");
			await select(page, count);
			// Identical random draws must still produce a visibly different retry.
			await page.evaluate(() => { Math.random = () => 0.5; });
			let previous: number[] | undefined;
			for (let pickup = 0; pickup < 4; pickup++) {
				await start(page, "PAY-107");
				await seek(page, 300);
				const layers = preview(page).locator("[data-issue-deck-layer]");
				const angles = await layers.evaluateAll((nodes) => nodes.map((node) => {
					const matrix = new DOMMatrix(getComputedStyle(node).transform);
					return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
				}));
				expect(angles).toHaveLength(count - 1);
				const family = (values: number[]) => values.every((angle) => angle > 0) ? 1 : values.every((angle) => angle < 0) ? -1 : 0;
				if (previous) expect(family(angles)).not.toBe(family(previous));
				previous = angles;
				await move(page, 50, 850);
				if (pickup % 2 === 1) await page.keyboard.press("Escape");
				await page.mouse.up();
				await expect(preview(page)).toHaveCount(0);
				await expect(page.getByRole("region", { name: `${count} cards selected. Bulk actions available.`, exact: true })).toBeVisible();
				await expect(page.locator('[data-jira-kanban-column="To do"] [data-board-agent-session-drop-zone="issue"]')).toHaveCount(4);
			}
		});
	}

	test(`fresh pickups randomize the rear sheets without jitter during a drag (${reducedMotion})`, async ({ page }) => {
		await holdGathering(page);
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${origin}/preview/blocks/jira-dragging`);
		await page.waitForLoadState("networkidle");
		await select(page, 3);
		const arrangements: string[][] = [];
		for (let index = 0; index < 3; index++) {
			await start(page, "PAY-107");
			await seek(page, 300);
			const layers = preview(page).locator("[data-issue-deck-layer]");
			const arrangement = await layers.evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).style.transform));
			expect(arrangement).toHaveLength(2);
			arrangements.push(arrangement);
			await move(page, 1100, 100);
			expect(await layers.evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).style.transform))).toEqual(arrangement);
			if (index === 2) await page.screenshot({ path: `output/agent-browser/jira-dragging/randomized-stack-${reducedMotion}.png` });
			await page.keyboard.press("Escape");
			await page.mouse.up();
			await expect(preview(page)).toHaveCount(0);
		}
		expect(new Set(arrangements.map((layers) => JSON.stringify(layers))).size).toBe(3);
	});
}

test("early drop, rapid restart and live reduced motion retire gathering cleanly", async ({ page }) => {
	await holdGathering(page);
	await page.goto(`${origin}/preview/blocks/jira-dragging`);
	await page.waitForLoadState("networkidle");
	await select(page, 4);
	await start(page, "PAY-107");
	await seek(page, 70);
	await page.keyboard.press("Escape");
	await page.mouse.up();
	await expect(preview(page)).toHaveCount(0);
	await start(page, "PAY-123");
	await expect(preview(page).locator('[data-issue-cohort-front]')).toContainText("PAY-123");
	await seek(page, 70);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await expect.poll(() => preview(page).evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(0);
	for (const layer of await preview(page).locator('[data-issue-deck-layer]').all()) {
		const pose = await layer.evaluate((node) => ({ actual: [...new DOMMatrix(getComputedStyle(node).transform).toFloat64Array()], expected: [...new DOMMatrix((node as HTMLElement).style.transform).toFloat64Array()] }));
		pose.actual.forEach((value, index) => expect(value).toBeCloseTo(pose.expected[index], 5));
	}
	await page.keyboard.press("Escape");
	await page.mouse.up();
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await start(page, "PAY-105");
	await seek(page, 90);
	const review = (await page.locator('[data-jira-kanban-column="In review"]').boundingBox())!;
	await move(page, review.x + 90, review.y + 240);
	await page.mouse.up();
	await expect(preview(page)).toHaveCount(0);
	await expect(page.locator('[data-issue-cohort-drag-image]')).toHaveCount(0);
	await expect(page.locator('[data-jira-kanban-column="To do"] [data-board-agent-session-drop-zone="issue"]')).toHaveCount(0);
	await expect(page.locator('[data-jira-kanban-column="In review"] [data-board-agent-session-drop-zone="issue"]')).toHaveCount(4);
	expect(await page.evaluate(() => window.issueGatherAnimations.every((animation) => animation.playState === "idle"))).toBe(true);
});

test("single-card pickup is immediate and supports native dropping", async ({ page }) => {
	await holdGathering(page);
	await page.goto(`${origin}/preview/blocks/jira-dragging`);
	await page.waitForLoadState("networkidle");
	await start(page, "PAY-107");
	await expect(preview(page)).toHaveAttribute("data-issue-cohort-count", "1");
	await expect(preview(page).locator('[data-issue-cohort-front]')).toHaveCSS("transform", "none");
	expect(await page.evaluate(() => window.issueGatherAnimations.length)).toBe(0);
	const review = (await page.locator('[data-jira-kanban-column="In review"]').boundingBox())!;
	await move(page, review.x + 90, review.y + 240);
	await page.mouse.up();
	await expect(preview(page)).toHaveCount(0);
	await expect(page.locator('[data-issue-cohort-drag-image]')).toHaveCount(0);
	await expect(page.locator('[data-jira-kanban-column="To do"] [data-board-agent-session-drop-zone="issue"]')).toHaveCount(3);
	await expect(page.locator('[data-jira-kanban-column="In review"] [data-issue-key="PAY-107"]')).toHaveCount(1);
	expect(await page.evaluate(() => window.issueGatherAnimations.every((animation) => animation.playState === "idle"))).toBe(true);
});

test("record immediate single-card pickup and plain backing sheets", async ({ browser }) => {
	const context = await browser.newContext({
		viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true,
		recordVideo: { dir: "output/agent-browser/jira-dragging/gathering-recording", size: { width: 1600, height: 1000 } },
	});
	const page = await context.newPage();
	const video = page.video()!;
	try {
		await page.goto(`${origin}/preview/blocks/jira-dragging`);
		await page.waitForLoadState("networkidle");
		await start(page, "PAY-107");
		await expect.poll(() => preview(page).evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(0);
		await page.mouse.move(660, 380, { steps: 8 });
		await page.mouse.move(900, 460, { steps: 12 });
		await expect.poll(() => preview(page).evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(0);
		await page.screenshot({ path: "output/agent-browser/jira-dragging/single-immediate.png" });
		await page.keyboard.press("Escape");
		await page.mouse.up();
		await expect(preview(page)).toHaveCount(0);
		await select(page, 3);
		for (const grabbed of ["PAY-107", "PAY-123"]) {
			await start(page, grabbed);
			await expect.poll(() => preview(page).evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(0);
			await page.mouse.move(660, 380, { steps: 8 });
			await page.mouse.move(900, 460, { steps: 12 });
			await expect.poll(() => preview(page).evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(0);
			await page.screenshot({ path: `output/agent-browser/jira-dragging/gathered-${grabbed}.png` });
			await page.keyboard.press("Escape");
			await page.mouse.up();
			await expect(preview(page)).toHaveCount(0);
		}
	} finally {
		await context.close();
		await video.saveAs("output/agent-browser/jira-dragging/gathering-plain.webm");
	}
});

test("record clockwise, counterclockwise and mixed stack shapes after missed drops", async ({ browser }) => {
	const context = await browser.newContext({
		viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true,
		recordVideo: { dir: "output/agent-browser/jira-dragging/independent-tilt-recording", size: { width: 1600, height: 1000 } },
	});
	const page = await context.newPage();
	const video = page.video()!;
	try {
		await holdGathering(page);
		await page.goto(`${origin}/preview/blocks/jira-dragging`);
		await page.waitForLoadState("networkidle");
		await select(page, 3);
		for (const [name, draw] of [["clockwise", 0.125], ["counterclockwise", 0.125], ["mixed", 0.5]] as const) {
			await page.evaluate((value) => { Math.random = () => value; }, draw);
			await start(page, "PAY-107");
			await seek(page, 300);
			await move(page, 800, 220);
			const angles = await preview(page).locator("[data-issue-deck-layer]").evaluateAll((nodes) => nodes.map((node) => {
				const matrix = new DOMMatrix(getComputedStyle(node).transform);
				return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
			}));
			expect(angles.map(Math.sign)).toEqual(name === "clockwise" ? [1, 1] : name === "counterclockwise" ? [-1, -1] : [1, -1]);
			await page.screenshot({ path: `output/agent-browser/jira-dragging/tilt-${name}.png` });
			// Deliberate recording dwell so the three silhouettes can be compared.
			await page.waitForTimeout(650);
			await move(page, 50, 850);
			await page.mouse.up();
			await expect(preview(page)).toHaveCount(0);
			await expect(page.getByRole("region", { name: "3 cards selected. Bulk actions available.", exact: true })).toBeVisible();
		}
	} finally {
		await context.close();
		await video.saveAs("output/agent-browser/jira-dragging/independent-tilt-retries.webm");
	}
});
