import { expect, test } from "@playwright/test";

const BOARD_URL = (process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000") + "/jira-team-eu26";

for (const reducedMotion of [false, true]) {
	test(reducedMotion
		? "reduced motion places new and returning sessions immediately"
		: "top arrivals and returning sessions ease the existing rows down", async ({ page }) => {
		test.setTimeout(60_000);
		await page.emulateMedia({ reducedMotion: reducedMotion ? "reduce" : "no-preference" });
		await page.goto(BOARD_URL, { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible({ timeout: 15_000 });
		await page.getByRole("button", { name: "Expand Unlink sessions column" }).press("Enter");
		await expect(page.locator('[data-agent-session-column] ul[data-variant="large"]')).toBeVisible();

		await page.locator('[data-agent-session-column] ul[data-variant="large"]').evaluate((list) => {
			type Sample = { elapsed: number; top: number };
			type Entry = { kind: "new" | "returning"; start: number; samples: Sample[] };
			const traces: Entry[] = [];
			Object.assign(window, { sessionEntryTraces: traces });
			const rows = () => Array.from(list.querySelectorAll<HTMLElement>('[data-testid^="agent-session-row-"]'));
			let previous = rows().map((row) => ({ id: row.dataset.testid, top: row.getBoundingClientRect().top }));
			new MutationObserver(() => {
				const current = rows();
				if (current[0]?.dataset.testid !== previous[0]?.id) {
					const follower = current.find((row) => row.dataset.testid === previous[0]?.id);
					if (follower && previous.length > 0) {
						const entry: Entry = {
							kind: current.length > previous.length ? "new" : "returning",
							start: previous[0].top,
							samples: [],
						};
						traces.push(entry);
						const started = performance.now();
						const sample = () => {
							const elapsed = performance.now() - started;
							entry.samples.push({ elapsed, top: follower.getBoundingClientRect().top });
							if (elapsed < 850) requestAnimationFrame(sample);
						};
						requestAnimationFrame(sample);
					}
				}
				previous = current.map((row) => ({ id: row.dataset.testid, top: row.getBoundingClientRect().top }));
			}).observe(list, { childList: true });
		});
		await page.waitForFunction(() => {
			const traces = (window as unknown as {
				sessionEntryTraces: { kind: string; samples: { elapsed: number }[] }[];
			}).sessionEntryTraces;
			return ["new", "returning"].every((kind) => traces.some((trace) => trace.kind === kind && (trace.samples.at(-1)?.elapsed ?? 0) >= 850));
		}, undefined, { timeout: 30_000 });
		const traces = await page.evaluate(() => (window as unknown as {
			sessionEntryTraces: { kind: string; start: number; samples: { elapsed: number; top: number }[] }[];
		}).sessionEntryTraces);
		for (const kind of ["new", "returning"]) {
			const entry = traces.find((trace) => trace.kind === kind);
			expect(entry, `${kind} must be exercised`).toBeDefined();
			const samples = entry!.samples;
			const finalTop = samples.at(-1)!.top;
			expect(finalTop - entry!.start).toBeGreaterThan(40);
			if (reducedMotion) {
				for (const sample of samples) expect(Math.abs(sample.top - finalTop)).toBeLessThan(0.5);
				continue;
			}
			const middle = samples.find((sample) => sample.elapsed >= 160)!;
			expect(middle.top).toBeGreaterThan(entry!.start + 1);
			expect(middle.top).toBeLessThan(finalTop - 4);
			const late = samples.find((sample) => sample.elapsed >= 400)!;
			expect(late.top).toBeLessThan(finalTop - 0.5);
		}
	});
}

test("Needs input preserves the timeline and never replays arrivals across modes", async ({ page }) => {
	await page.clock.install();
	await page.goto(BOARD_URL, { waitUntil: "domcontentloaded" });
	await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible({ timeout: 15_000 });
	await page.getByRole("button", { name: "Expand Unlink sessions column" }).press("Enter");
	await expect(page.locator("[data-agent-session-column-expansion]"))
		.toHaveAttribute("data-agent-session-column-expansion", "expanded");
	await page.getByRole("heading", { name: "Jira Design" }).hover();
	const column = page.locator("[data-agent-session-column]");
	await expect.poll(() => column.locator('[data-testid^="agent-session-row-"]').count()).toBeGreaterThan(16);
	await page.clock.pauseAt(new Date(Date.now() + 100));
	const originalColumn = await column.elementHandle();
	const enteredIds = await column.locator('[data-testid^="agent-session-row-"]').evaluateAll(
		(rows) => rows.map((row) => row.getAttribute("data-testid")!.replace("agent-session-row-", "")),
	);
	expect(enteredIds.length).toBeGreaterThan(16);
	const filter = page.getByRole("button", { name: "Needs input: 1 agent" });
	for (let toggle = 0; toggle < 4; toggle += 1) {
		await filter.click();
		await page.clock.runFor(100);
		expect(await originalColumn!.evaluate((element) => element.isConnected)).toBe(true);
		const replayedIds = await column.locator('[data-arrival-reveal="true"]').evaluateAll(
			(faces) => faces.map((face) => face.closest("[data-agent-session-notch]")?.getAttribute("data-testid")?.replace("agent-session-notch-", "")),
		);
		expect(replayedIds.filter((id) => id !== undefined && enteredIds.includes(id))).toEqual([]);
	}
});
