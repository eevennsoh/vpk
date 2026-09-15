import { expect, test, type Page } from "@playwright/test";

const origin = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

async function openBoard(page: Page) {
	await page.goto(`${origin}/jira-team-eu26`, { waitUntil: "domcontentloaded" });
	await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible({ timeout: 30_000 });
	await expect(page.locator("[data-jira-kanban-column]")).toHaveCount(4);
}

test("EU26 mounts no unused sidebar editor before opening floating chat", async ({ page }) => {
	await openBoard(page);
	await expect(page.locator("[contenteditable=true]")).toHaveCount(0);
	await page.getByRole("button", { name: "Open Rovo chat", exact: true }).click();
	await expect(page.locator('[data-rovo-chat-placement="floating"]')).toBeVisible();
	await expect(page.locator("[contenteditable=true]")).toHaveCount(1);
	await expect(page.getByRole("textbox", { name: "Chat message input" })).toBeVisible();
});

test("EU26 keeps an opened sidebar draft while switching Board and List and closing chat", async ({ page }) => {
	await openBoard(page);
	await page.getByRole("button", { name: "Ask Rovo", exact: true }).click();
	const composer = page.getByRole("textbox", { name: "Chat message input" });
	await expect(composer).toBeVisible();
	await composer.fill("Keep this unsent draft");
	await page.getByRole("tab", { name: "List", exact: true }).click();
	await expect(page.getByRole("region", { name: "Payments SDK v2 migration work items list" })).toBeVisible();
	await expect(composer).toContainText("Keep this unsent draft");
	await page.getByRole("button", { name: "Ask Rovo", exact: true }).click();
	await expect(composer).not.toBeVisible();
	await page.getByRole("button", { name: "Ask Rovo", exact: true }).click();
	await expect(composer).toContainText("Keep this unsent draft");
	await page.getByRole("tab", { name: "Board", exact: true }).click();
	await expect(page.locator("[data-jira-kanban-column]")).toHaveCount(4);
	await expect(composer).toContainText("Keep this unsent draft");
});

test("record repeatable warm Board and List interaction samples", async ({ page }, testInfo) => {
	test.skip(!process.env.VPK_PERF_SAMPLES, "Opt-in measurement; timings depend on the machine and build mode.");
	test.setTimeout(180_000);
	await openBoard(page);
	// Wait for the finite, intentionally randomized demo arrivals to finish.
	await page.waitForFunction(() => document.querySelector('[aria-label="Unlink sessions, 24 sessions"]') !== null, undefined, { timeout: 75_000 });
	await page.evaluate(() => {
		const entries: { name: string; duration: number; start: number }[] = [];
		Object.assign(window, { eu26PerformanceEntries: entries });
		const options: PerformanceObserverInit & { durationThreshold: number } = { type: "event", durationThreshold: 16 };
		new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				if (entry.name === "click") entries.push({ name: entry.name, duration: entry.duration, start: entry.startTime });
			}
		}).observe(options);
	});
	const samples: { view: string; durationMs: number }[] = [];
	for (let index = 0; index < Number(process.env.VPK_PERF_SAMPLES); index += 1) {
		for (const view of ["List", "Board"]) {
			const started = await page.evaluate(() => performance.now());
			await page.getByRole("tab", { name: view, exact: true }).click();
			await expect(page.getByRole("tab", { name: view, exact: true })).toHaveAttribute("aria-selected", "true");
			if (view === "Board") await expect(page.locator("[data-jira-kanban-column]")).toHaveCount(4);
			else await expect(page.getByRole("region", { name: "Payments SDK v2 migration work items list" })).toBeVisible();
			// Event Timing entries arrive after presentation, asynchronously.
			await page.waitForTimeout(150);
			const durationMs = await page.evaluate((since) => {
				const entries = (window as unknown as { eu26PerformanceEntries: { duration: number; start: number }[] }).eu26PerformanceEntries;
				return Math.max(0, ...entries.filter((entry) => entry.start >= since).map((entry) => entry.duration));
			}, started);
			samples.push({ view, durationMs });
		}
	}
	await testInfo.attach("interaction-samples", { body: JSON.stringify({ origin, samples }, null, 2), contentType: "application/json" });
	console.log(JSON.stringify({ origin, samples }));
});

test("EU26 preserves warm view nodes and hides inactive controls", async ({ page }) => {
	await openBoard(page);
	const boardColumn = page.locator("[data-jira-kanban-column]").first();
	const originalColumn = await boardColumn.elementHandle();
	if (!originalColumn) throw new Error("Expected the initial board column");
	await page.getByRole("tab", { name: "List", exact: true }).click();
	const list = page.getByRole("region", { name: "Payments SDK v2 migration work items list" });
	await expect(list).toBeVisible();
	await expect(page.getByRole("button", { name: "PAY-118: Carry card-artwork metadata into the next wallet epic", exact: true })).toHaveCount(0);
	expect(await originalColumn.evaluate((element) => element.isConnected)).toBe(true);
	await expect(boardColumn).not.toBeVisible();
	const originalList = await list.elementHandle();
	if (!originalList) throw new Error("Expected the visited list");
	await page.getByRole("tab", { name: "Board", exact: true }).click();
	await expect(boardColumn).toBeVisible();
	expect(await boardColumn.evaluate((element, original) => element === original, originalColumn)).toBe(true);
	await expect(page.getByRole("region", { name: "Payments SDK v2 migration work items list" })).toHaveCount(0);
	expect(await originalList.evaluate((element) => element.isConnected)).toBe(true);
	await page.getByRole("tab", { name: "List", exact: true }).click();
	await expect(list).toBeVisible();
	expect(await list.evaluate((element, original) => element === original, originalList)).toBe(true);
});

test("EU26 keeps retained board agent chins anchored when returning from List", async ({ page }) => {
	await openBoard(page);
	await page.getByRole("tab", { name: "List", exact: true }).first().click();
	await expect(page.getByRole("region", { name: "Payments SDK v2 migration work items list" })).toBeVisible();

	const samples = await page.evaluate(async () => {
		const boardTab = Array.from(document.querySelectorAll<HTMLElement>('[role="tab"]'))
			.find((tab) => tab.textContent?.trim() === "Board");
		if (!boardTab) throw new Error("Expected the Board tab");

		const frames: { offset: number; transform: string }[] = [];
		boardTab.click();
		for (let frame = 0; frame < 18; frame += 1) {
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			const board = document.querySelector(
				'[aria-label="Track the Payments SDK v2 migration. Scroll horizontally to review all delivery statuses."]',
			);
			const row = board?.querySelector<HTMLElement>('[data-slot="jira-issue-agent-row"]');
			const shell = row?.closest<HTMLElement>('[data-slot="jira-issue-agent-shell"]');
			const rowWrap = row?.closest<HTMLElement>('[data-slot="jira-issue-agent-row-wrap"]');
			const rowMotion = rowWrap?.parentElement;
			if (row && shell && rowMotion) {
				frames.push({
					offset: row.getBoundingClientRect().left - shell.getBoundingClientRect().left,
					transform: getComputedStyle(rowMotion).transform,
				});
			}
		}
		return frames;
	});

	expect(samples).not.toHaveLength(0);
	const restingOffset = samples.at(-1)?.offset ?? 0;
	for (const [frame, sample] of samples.entries()) {
		expect(sample.transform, `frame ${frame} should not project the chin from another view`).toBe("none");
		expect(
			Math.abs(sample.offset - restingOffset),
			`frame ${frame} should keep the chin aligned to its Jira issue shell`,
		).toBeLessThanOrEqual(0.5);
	}
});
