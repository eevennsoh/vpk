import { expect, test } from "@playwright/test";

const BOARD_URL = (process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000") + "/jira-team-eu26";

for (const reducedMotion of [false, true]) {
	test(reducedMotion
		? "reduced motion releases first-place and returning statuses without an avatar beat"
		: "first-place and returning statuses wait for the human-agent avatar beat", async ({ page }, testInfo) => {
		await page.emulateMedia({ reducedMotion: reducedMotion ? "reduce" : "no-preference" });
		// One-session batches exercise the first-place change, then a lower-row return.
		await page.addInitScript(() => { Math.random = () => 0; });
		await page.goto(BOARD_URL, { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible();
		const expand = page.getByRole("button", { name: "Expand Unlink sessions column" });
		if (await expand.count()) await expand.press("Enter");
		await page.getByRole("heading", { name: "Jira Design" }).hover();
		const row = page.getByTestId("agent-session-row-lw-sync-webhook-gap");
		await expect(row).toBeAttached();
		const samples = await row.evaluate(async (initialRow) => {
			const traces: {
				elapsed: number; current: string; shown: string; animated: boolean;
				humanTransform: string; top: number; sameRow: boolean;
			}[] = [];
			const started = performance.now();
			while (performance.now() - started < 12_000) {
				await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
				const currentRow = document.querySelector<HTMLElement>('[data-testid="agent-session-row-lw-sync-webhook-gap"]');
				if (!currentRow) continue;
				const lifecycle = currentRow.querySelector<HTMLElement>("[data-agent-session-lifecycle-current]");
				const avatar = currentRow.querySelector<HTMLElement>('[data-slot="human-agent-avatar"]');
				const human = avatar?.querySelector<HTMLElement>('[data-avatar-role="human"]');
				const sample = {
					elapsed: performance.now() - started,
					current: lifecycle?.dataset.agentSessionLifecycleCurrent ?? "running",
					shown: lifecycle?.dataset.agentSessionLifecycleShown ?? "running",
					animated: avatar?.dataset.animated === "true",
					humanTransform: human ? getComputedStyle(human).transform : "none",
					top: currentRow.getBoundingClientRect().top,
					sameRow: currentRow === initialRow,
				};
				traces.push(sample);
				if (sample.current === "complete" && sample.shown === "complete" && !sample.animated) break;
			}
			return traces;
		});
		await testInfo.attach("avatar-status-sequence", { body: JSON.stringify(samples), contentType: "application/json" });
		for (const [current, previous] of [["needs-input", "running"], ["complete", "needs-input"]]) {
			const revision = samples.filter((sample) => sample.current === current);
			expect(revision.length, `${current} must be exercised`).toBeGreaterThan(0);
			expect(revision.at(-1)?.shown).toBe(current);
			if (reducedMotion) {
				expect(revision.every((sample) => !sample.animated && sample.shown === current)).toBe(true);
				continue;
			}
			expect(revision[0].shown, `${current} must retain the previous status before the avatar beat`).toBe(previous);
			const avatarBeat = revision.filter((sample) => sample.animated);
			expect(avatarBeat.length, `${current} must play the avatar beat`).toBeGreaterThan(5);
			expect(avatarBeat.every((sample) => sample.shown === previous)).toBe(true);
			expect(new Set(avatarBeat.map((sample) => sample.humanTransform)).size).toBeGreaterThan(5);
			expect(avatarBeat.at(-1)!.elapsed - avatarBeat[0].elapsed).toBeGreaterThan(500);
			if (current === "needs-input") {
				const inPlaceBeat = revision.slice(0, revision.findIndex((sample) => sample.shown === current) + 1);
				expect(inPlaceBeat.every((sample) => sample.sameRow)).toBe(true);
				expect(Math.max(...inPlaceBeat.map((sample) => sample.top)) - Math.min(...inPlaceBeat.map((sample) => sample.top))).toBeLessThan(0.5);
			}
		}
	});
}

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
