import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

interface MorphFrame {
	time: number;
	agentSize: number;
	identity: { x: number; y: number; width: number; height: number };
	surface: { x: number; y: number; width: number; height: number };
}

for (const theme of ["light", "dark"] as const) {
	for (const reducedMotion of ["no-preference", "reduce"] as const) {
		test(`nearby work items share distance-weighted traces (${theme}, ${reducedMotion})`, async ({ page }) => {
			const baseURL = process.env.PLAYWRIGHT_BASE_URL;
			if (!baseURL) throw new Error("Set PLAYWRIGHT_BASE_URL to this worktree's origin");
			await page.setViewportSize({ width: 1800, height: 1100 });
			// Verify the drag preference on a mounted board, independently of
			// theme/reduced-motion startup behavior elsewhere in the app shell.
			await page.emulateMedia({ reducedMotion: "no-preference", colorScheme: theme });
			await page.addInitScript((mode) => {
				localStorage.setItem("ui-theme", mode);
				localStorage.setItem("ui-design-variants", JSON.stringify({ schemaVersion: 2, sessionPeel: false }));
			}, theme);
			await page.goto(`${baseURL}/jira-team-eu26`);
			await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible();
			await page.emulateMedia({ reducedMotion, colorScheme: theme });
			const expand = page.getByRole("button", { name: "Expand Unlink sessions column" });
			if (await expand.isVisible()) await expand.click();
			const article = page.getByTestId("agent-session-row-lw-scope-thread").locator("article");
			await article.scrollIntoViewIfNeeded();
			const source = await article.boundingBox();
			const left = await page.locator('[data-issue-key="PAY-118"]').boundingBox();
			const right = await page.locator('[data-issue-key="PAY-105"]').boundingBox();
			if (!source || !left || !right) throw new Error("Missing drag geometry");
			await page.mouse.move(source.x + source.width * 0.65, source.y + source.height / 2);
			await page.mouse.down();
			await page.mouse.move(source.x + source.width * 0.65 + 20, source.y + source.height / 2);
			await expect.poll(async () => Math.max(0, ...await page.locator('[data-slot="jira-issue-attach-trace"]').evaluateAll((elements) => elements.map((element) => Number(getComputedStyle(element).opacity))))).toBeLessThan(0.5);
			await page.mouse.move((left.x + left.width + right.x) / 2, left.y + left.height - 14, { steps: 8 });
			const traces = page.locator('[data-slot="jira-issue-attach-trace"][data-trace-active="true"]');
			if (reducedMotion === "reduce") {
				for (const trace of await traces.all()) await expect(trace).toBeHidden();
			} else {
				await expect.poll(() => traces.count()).toBeGreaterThanOrEqual(2);
				expect(await traces.count()).toBeLessThanOrEqual(4);
				await expect.poll(async () => Math.max(...await traces.evaluateAll((elements) => elements.map((element) => Number(getComputedStyle(element).opacity))))).toBe(1);
				await expect.poll(async () => {
					const strengths = await traces.evaluateAll((elements) => elements.map((element) => Number(getComputedStyle(element).opacity)));
					return strengths.some((value) => value === 1)
						&& strengths.every((value) => value > 0 && value <= 1)
						&& strengths.some((value) => value < 0.95);
				}).toBe(true);
				await expect(page.getByText("Link agent session", { exact: true })).toHaveCount(1);
				for (const trace of await traces.all()) {
					await expect(trace).toHaveAttribute("aria-hidden", "true");
					await expect(trace).toHaveCSS("pointer-events", "none");
				}
			}
			await mkdir("output/agent-browser/proximity-trace", { recursive: true });
			await page.screenshot({ path: `output/agent-browser/proximity-trace/cluster-${theme}-${reducedMotion}.png` });
			await page.keyboard.press("Escape");
			await page.mouse.up();
			await expect(traces).toHaveCount(0);
		});
	}
}

test("trace stays subtle at pickup and fades through intermediate brightness on approach", async ({ page }) => {
	const baseURL = process.env.PLAYWRIGHT_BASE_URL;
	if (!baseURL) throw new Error("Set PLAYWRIGHT_BASE_URL to this worktree's origin");
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.addInitScript(() => localStorage.setItem("ui-design-variants", JSON.stringify({ schemaVersion: 2, sessionPeel: false })));
	await page.goto(`${baseURL}/jira-team-eu26`);
	await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible();
	const article = page.getByTestId("agent-session-row-lw-scope-thread").locator("article");
	await article.scrollIntoViewIfNeeded();
	const source = await article.boundingBox();
	const card = await page.locator('[data-issue-key="PAY-118"]').boundingBox();
	if (!source || !card) throw new Error("Missing approach geometry");
	await page.mouse.move(source.x + source.width * 0.65, source.y + source.height / 2);
	const traces = page.locator('[data-slot="jira-issue-attach-trace"]');
	await page.evaluate(() => {
		const result = { done: false, frames: [] as { time: number; opacity: number }[] };
		(window as typeof window & { traceReveal: typeof result }).traceReveal = result;
		const observer = new MutationObserver(() => {
			const trace = document.querySelector('[data-issue-key="PAY-118"] [data-slot="jira-issue-attach-trace"]');
			if (!trace) return;
			observer.disconnect();
			const started = performance.now();
			const sample = () => {
				result.frames.push({ time: performance.now() - started, opacity: Number(getComputedStyle(trace).opacity) });
				if (performance.now() - started < 280) requestAnimationFrame(sample);
				else result.done = true;
			};
			sample();
		});
		observer.observe(document.body, { childList: true, subtree: true });
	});
	await page.mouse.down();
	await page.mouse.move(source.x + source.width * 0.65 + 20, source.y + source.height / 2);
	await page.mouse.move(card.x - 65, card.y + 30);
	await expect.poll(() => page.evaluate(() => (window as typeof window & { traceReveal: { done: boolean } }).traceReveal.done)).toBe(true);
	const frames = await page.evaluate(() => (window as typeof window & { traceReveal: { frames: { time: number; opacity: number }[] } }).traceReveal.frames);
	const settled = frames.at(-1)!.opacity;
	expect(frames[0].opacity).toBeLessThan(0.1);
	expect(settled).toBeGreaterThan(0.1);
	expect(settled).toBeLessThan(0.9);
	expect(frames.some((frame) => frame.opacity > 0.01 && frame.opacity < settled * 0.9)).toBe(true);
	await mkdir("output/agent-browser/proximity-trace", { recursive: true });
	await writeFile("output/agent-browser/proximity-trace/reveal-frames.json", JSON.stringify(frames, null, 2));
	await page.mouse.move(card.x + 8, card.y + 30);
	await expect.poll(async () => Math.max(...await traces.evaluateAll((elements) => elements.map((element) => Number(getComputedStyle(element).opacity))))).toBe(1);
	await page.evaluate(() => {
		const trace = document.querySelector('[data-issue-key="PAY-118"] [data-slot="jira-issue-attach-trace"]')!;
		const result = { done: false, frames: [] as number[] };
		(window as typeof window & { traceTravel: typeof result }).traceTravel = result;
		const started = performance.now();
		const sample = () => {
			result.frames.push(Number(getComputedStyle(trace).getPropertyValue("--card-glow-pointer-y")));
			if (performance.now() - started < 180) requestAnimationFrame(sample);
			else result.done = true;
		};
		sample();
	});
	await page.mouse.move(card.x + 8, card.y + 90);
	await expect.poll(() => page.evaluate(() => (window as typeof window & { traceTravel: { done: boolean } }).traceTravel.done)).toBe(true);
	const travel = await page.evaluate(() => (window as typeof window & { traceTravel: { frames: number[] } }).traceTravel.frames);
	const [start, end] = [travel[0], travel.at(-1)!];
	expect(end).toBeGreaterThan(start + 0.5);
	expect(travel.every((value) => value >= start - 0.01 && value <= end + 0.01)).toBe(true);
	await writeFile("output/agent-browser/proximity-trace/gradient-travel-frames.json", JSON.stringify(travel, null, 2));
	const firstTrace = page.locator('[data-issue-key="PAY-118"] [data-slot="jira-issue-attach-trace"]');
	await expect(firstTrace).toHaveAttribute("data-trace-phase", "track");
	await firstTrace.evaluate((element) => { (window as typeof window & { revealedTrace?: Element }).revealedTrace = element; });
	await page.mouse.move(card.x - 180, card.y + 30);
	for (const trace of await traces.all()) await expect(trace).toHaveCSS("opacity", "0");
	await page.mouse.move(card.x + 8, card.y + 30);
	await expect(firstTrace).toHaveCSS("opacity", "1");
	await expect(firstTrace).toHaveAttribute("data-trace-phase", "track");
	expect(await firstTrace.evaluate((element) => element === (window as typeof window & { revealedTrace?: Element }).revealedTrace)).toBe(true);
	await page.keyboard.press("Escape");
	await page.mouse.up();
	await expect(firstTrace).toHaveCount(0);
});

test("nearby borders stay stable during subpixel nearest-card handoffs", async ({ page }) => {
	const baseURL = process.env.PLAYWRIGHT_BASE_URL;
	if (!baseURL) throw new Error("Set PLAYWRIGHT_BASE_URL to this worktree's origin");
	await page.setViewportSize({ width: 1440, height: 920 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.addInitScript(() => localStorage.setItem("ui-design-variants", JSON.stringify({ schemaVersion: 2, sessionPeel: false })));
	await page.goto(`${baseURL}/jira-team-eu26`);
	await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible();
	const article = page.getByTestId("agent-session-row-lw-scope-thread").locator("article");
	await article.scrollIntoViewIfNeeded();
	const source = await article.boundingBox();
	const first = page.locator('[data-issue-key="PAY-118"] [data-slot="jira-issue-surface"]');
	const second = page.locator('[data-issue-key="PAY-124"] [data-slot="jira-issue-surface"]');
	const box = await first.boundingBox();
	if (!source || !box) throw new Error("Missing handoff geometry");
	await page.mouse.move(source.x + source.width * 0.65, source.y + source.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + 8, box.y + 90, { steps: 8 });
	const traceA = first.locator('[data-slot="jira-issue-attach-trace"]');
	const traceB = second.locator('[data-slot="jira-issue-attach-trace"]');
	await expect(traceA).toHaveCSS("opacity", "1");
	const a = (await first.boundingBox())!;
	const b = (await second.boundingBox())!;
	const x = Math.min(a.x, b.x) - 12;
	const gap = b.y - a.y - a.height;
	const y = a.y + a.height + gap / 2 + ((b.x - x) ** 2 - (a.x - x) ** 2) / (2 * gap);
	await page.mouse.move(x, y);
	for (const trace of [traceA, traceB]) {
		await expect.poll(async () => Number(await trace.evaluate((element) => getComputedStyle(element).opacity))).toBeGreaterThan(0.8);
	}
	await page.evaluate(() => {
		const nodes = ["PAY-118", "PAY-124"].map((key) => document.querySelector(`[data-issue-key="${key}"] [data-slot="jira-issue-attach-trace"]`)!);
		const result = { running: true, frames: [] as number[][] };
		(window as typeof window & { handoffFrames: typeof result }).handoffFrames = result;
		const sample = () => {
			result.frames.push(nodes.map((node) => Number(getComputedStyle(node).opacity)));
			if (result.running) requestAnimationFrame(sample);
		};
		sample();
	});
	for (let index = 0; index < 30; index++) {
		await page.mouse.move(x, y + (index % 2 === 0 ? -0.2 : 0.2));
		// Deliberate 60Hz input cadence for the frame-by-frame handoff check.
		await page.waitForTimeout(16);
	}
	const frames = await page.evaluate(() => {
		const result = (window as typeof window & { handoffFrames: { running: boolean; frames: number[][] } }).handoffFrames;
		result.running = false;
		return result.frames;
	});
	expect(frames.length).toBeGreaterThan(10);
	for (const [index, values] of frames.entries()) {
		for (const [cardIndex, opacity] of values.entries()) {
			expect(opacity).toBeGreaterThan(0.75);
			if (index > 0) expect(Math.abs(opacity - frames[index - 1][cardIndex])).toBeLessThan(0.1);
		}
	}
	await mkdir("output/agent-browser/proximity-trace", { recursive: true });
	await writeFile("output/agent-browser/proximity-trace/handoff-frames.json", JSON.stringify(frames, null, 2));
	await page.keyboard.press("Escape");
	await page.mouse.up();
	await expect(traceA).toHaveCount(0);
	await expect(traceB).toHaveCount(0);
});

test("horizontal tracing does not jump when brightness retargets across columns", async ({ page }) => {
	const baseURL = process.env.PLAYWRIGHT_BASE_URL;
	if (!baseURL) throw new Error("Set PLAYWRIGHT_BASE_URL to this worktree's origin");
	await page.setViewportSize({ width: 1440, height: 920 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.addInitScript(() => localStorage.setItem("ui-design-variants", JSON.stringify({ schemaVersion: 2, sessionPeel: false })));
	await page.goto(`${baseURL}/jira-team-eu26`);
	await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible();
	const article = page.getByTestId("agent-session-row-lw-scope-thread").locator("article");
	await article.scrollIntoViewIfNeeded();
	const source = await article.boundingBox();
	const box = await page.locator('[data-issue-key="PAY-118"]').boundingBox();
	if (!source || !box) throw new Error("Missing horizontal drag geometry");
	await page.mouse.move(source.x + source.width * 0.65, source.y + source.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x - 180, box.y + 62);
	await expect(page.locator('[data-issue-key="PAY-118"] [data-slot="jira-issue-attach-trace"][data-trace-active="true"]')).toHaveCount(0);
	await page.evaluate(() => {
		const result = { running: true, frames: [] as { time: number; opacity: number; strength: number; phase: string }[] };
		(window as typeof window & { horizontalFrames: typeof result }).horizontalFrames = result;
		const sample = () => {
			const trace = document.querySelector('[data-issue-key="PAY-118"] [data-slot="jira-issue-attach-trace"]');
			result.frames.push({ time: performance.now(), opacity: trace ? Number(getComputedStyle(trace).opacity) : 0,
				strength: trace ? Number((trace as HTMLElement).dataset.traceStrength) : 0,
				phase: trace ? (trace as HTMLElement).dataset.tracePhase ?? "none" : "none" });
			if (result.running) requestAnimationFrame(sample);
		};
		sample();
	});
	for (let x = box.x - 130; x <= box.x + box.width + 78; x += 6) {
		await page.mouse.move(x, box.y + 62);
		// Replay continuous horizontal input at a deliberate 60Hz cadence.
		await page.waitForTimeout(16);
	}
	const frames = await page.evaluate(() => {
		const result = (window as typeof window & { horizontalFrames: { running: boolean; frames: { time: number; opacity: number; strength: number; phase: string }[] } }).horizontalFrames;
		result.running = false;
		return result.frames;
	});
	await mkdir("output/agent-browser/proximity-trace", { recursive: true });
	await writeFile("output/agent-browser/proximity-trace/horizontal-regression-frames.json", JSON.stringify(frames, null, 2));
	const tracking = frames.filter((frame) => frame.phase === "track");
	expect(tracking.length).toBeGreaterThan(10);
	expect(tracking.filter((frame) => Math.abs(frame.opacity - frame.strength) > 0.01), "revealed borders follow proximity without a new tween").toEqual([]);
	expect(Math.max(...frames.map((frame) => frame.opacity))).toBeGreaterThan(0.9);
	await page.keyboard.press("Escape");
	await page.mouse.up();
	await expect(page.locator('[data-issue-key="PAY-118"] [data-slot="jira-issue-attach-trace"]')).toHaveCount(0);
});

for (const grab of [0.3, 0.8]) {
	test(`pickup stays continuous from the ${grab < 0.5 ? "left" : "right"} half`, async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 920 });
		await page.emulateMedia({ reducedMotion: "no-preference" });
		await page.addInitScript(() => localStorage.setItem("ui-design-variants", JSON.stringify({ schemaVersion: 2, sessionPeel: false })));
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
		await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible();
		const expand = page.getByRole("button", { name: "Expand Unlink sessions column" });
		if (await expand.isVisible()) await expand.click();
		const article = page.getByTestId("agent-session-row-lw-scope-thread").locator("article");
		await article.scrollIntoViewIfNeeded();
		await article.hover();
		const source = await article.boundingBox();
		if (!source) throw new Error("Missing session source");
		await page.evaluate(() => {
			const frames: { time: number; x: number; y: number; width: number; height: number; lightWidth: number; lightHeight: number; transform: string; parentTransform: string; animations: { kind: string; time: number | null; progress: number | null }[] }[] = [];
			(window as typeof window & { pickupFrames: typeof frames }).pickupFrames = frames;
			let started: number | undefined;
			const sample = (time: number) => {
				const surface = document.querySelector<HTMLElement>("[data-session-drag-overlay] [data-session-drag-surface]");
				if (!surface) return;
				started ??= time;
				const box = surface.getBoundingClientRect();
				const light = document.querySelector("[data-session-drag-overlay] [data-session-carry-light-surface]")?.getBoundingClientRect();
				frames.push({ time: time - started, x: box.x, y: box.y, width: box.width, height: box.height,
					lightWidth: light?.width ?? 0, lightHeight: light?.height ?? 0,
					transform: getComputedStyle(surface).transform,
					parentTransform: getComputedStyle(surface.parentElement!.parentElement!).transform,
					animations: surface.getAnimations().map((a) => ({ kind: a.constructor.name, time: typeof a.currentTime === "number" ? a.currentTime : null, progress: a.effect!.getComputedTiming().progress ?? null })),
				});
				if (time - started < 1300) requestAnimationFrame(sample);
			};
			const observer = new MutationObserver(() => {
				if (document.querySelector("[data-session-drag-overlay]")) {
					observer.disconnect();
					requestAnimationFrame(sample);
				}
			});
			observer.observe(document.body, { childList: true, subtree: true });
		});
		const x = source.x + source.width * grab;
		const y = source.y + source.height / 2;
		await page.mouse.move(x, y);
		await page.mouse.down();
		await page.mouse.move(x + 20, y);
		await expect.poll(() => page.evaluate(() => (window as typeof window & { pickupFrames: { time: number }[] }).pickupFrames.at(-1)?.time ?? 0)).toBeGreaterThanOrEqual(1300);
		const frames = await page.evaluate(() => (window as typeof window & { pickupFrames: { time: number; x: number; y: number; width: number; height: number; lightWidth: number; lightHeight: number; transform: string; parentTransform: string; animations: { kind: string }[] }[] }).pickupFrames);
		await writeFile(`output/agent-browser/compact-drag/pickup-${grab}.json`, JSON.stringify({ source, pointer: { x: x + 20, y }, frames }, null, 2));
		await page.screenshot({ path: `output/agent-browser/compact-drag/pickup-${grab}.png` });
		await page.mouse.move(700, 150);
		await page.mouse.up();
		const first = frames[0];
		for (const frame of frames) {
			expect(frame.lightWidth, `light width at ${frame.time}ms`).toBeCloseTo(frame.width, 1);
			expect(frame.lightHeight, `light height at ${frame.time}ms`).toBeCloseTo(frame.height, 1);
		}
		expect(frames.some((frame) => frame.animations.some((animation) => animation.kind === "Animation"))).toBe(true);
		expect(frames.every((frame) => frame.animations.every((animation) => animation.kind !== "CSSTransition"))).toBe(true);
		// Pickup starts up to 40% larger, but the compact container must already
		// surround the pointer instead of travelling across from the row avatar.
		expect(first.x + first.width / 2).toBeCloseTo(x + 20, 1);
		expect(first.y + first.height / 2).toBeCloseTo(y, 1);
		for (let i = 1; i < frames.length; i++) {
			expect(frames[i].width, `width at ${frames[i].time}ms`).toBeLessThanOrEqual(frames[i - 1].width + 0.5);
			expect(frames[i].x + frames[i].width / 2, `center x at ${frames[i].time}ms`).toBeCloseTo(first.x + first.width / 2, 1);
			expect(frames[i].y + frames[i].height / 2, `center y at ${frames[i].time}ms`).toBeCloseTo(first.y + first.height / 2, 1);
		}
	});
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	for (const firstMove of [4, 80]) {
		test(`session drag keeps avatar continuity: ${reducedMotion}, ${firstMove}px first move`, async ({ page }) => {
			await page.setViewportSize({ width: firstMove === 4 ? 1440 : 1100, height: 920 });
			await page.emulateMedia({ reducedMotion, colorScheme: firstMove === 4 ? "dark" : "light" });
			await page.addInitScript((theme) => localStorage.setItem("ui-theme", theme), firstMove === 4 ? "dark" : "light");
			// This suite exercises the native morph; Peel's handoff has its own coverage.
			await page.addInitScript(() => localStorage.setItem("ui-design-variants", JSON.stringify({ schemaVersion: 2, sessionPeel: false })));
			await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
			await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible({ timeout: 15_000 });
			await expect(page.locator("html")).toHaveAttribute("data-color-mode", firstMove === 4 ? "dark" : "light");
			const expand = page.getByRole("button", { name: "Expand Unlink sessions column" });
			if (await expand.isVisible()) await expand.click();
			const session = page.locator("[data-agent-session-column]").getByTestId("agent-session-row-lw-scope-thread");
			const article = session.locator("article");
			await article.scrollIntoViewIfNeeded();
			const source = await article.boundingBox();
			const identity = await article.locator("[data-session-drag-identity]").boundingBox();
			expect(source).not.toBeNull();
			expect(identity).not.toBeNull();
			if (!source || !identity) return;
			const x = source.x + source.width / 2;
			const y = source.y + source.height / 2;
			await page.mouse.move(x, y);
			await page.mouse.down();
			await page.evaluate(() => {
				const frames: MorphFrame[] = [];
				(window as Window & { dragMorphFrames?: MorphFrame[] }).dragMorphFrames = frames;
				let sampling = false;
				let started: number | undefined;
				const sample = (time: number) => {
					const overlay = document.querySelector("[data-session-drag-overlay]");
					const identityNode = overlay?.querySelector("[data-session-drag-identity]");
					const surfaceNode = overlay?.querySelector("[data-session-drag-surface]");
					if (identityNode && surfaceNode) {
						started ??= time;
						const identityRect = identityNode.getBoundingClientRect();
						const surfaceRect = surfaceNode.getBoundingClientRect();
						frames.push({
							time: time - started,
							agentSize: identityNode.querySelector('[data-avatar-role="agent"]')?.getBoundingClientRect().width ?? 0,
							identity: { x: identityRect.x, y: identityRect.y, width: identityRect.width, height: identityRect.height },
							surface: { x: surfaceRect.x, y: surfaceRect.y, width: surfaceRect.width, height: surfaceRect.height },
						});
						if (time - started < 750) requestAnimationFrame(sample);
					}
				};
				const observer = new MutationObserver(() => {
					if (!sampling && document.querySelector("[data-session-drag-overlay]")) {
						sampling = true;
						observer.disconnect();
						requestAnimationFrame(sample);
					}
				});
				observer.observe(document.body, { childList: true, subtree: true });
			});
			await page.mouse.move(x + firstMove, y);
			const overlay = page.locator("[data-session-drag-overlay]");
			await expect(overlay).toHaveCount(1);
			await expect(overlay).toHaveAttribute("aria-hidden", "true");
			expect(await overlay.evaluate((node) => node.parentElement === document.body)).toBe(true);
			await expect.poll(() => page.evaluate(() => (
				(window as Window & { dragMorphFrames?: MorphFrame[] }).dragMorphFrames?.at(-1)?.time ?? 0
			))).toBeGreaterThanOrEqual(750);
			const frames = await page.evaluate(() => (window as Window & { dragMorphFrames?: MorphFrame[] }).dragMorphFrames ?? []);
			const first = frames[0];
			const last = frames[frames.length - 1];
			await test.info().attach("drag-morph-frames", { body: JSON.stringify({ source, identity, frames }), contentType: "application/json" });
			for (const frame of frames) {
				expect(frame.identity.width).toBeCloseTo(32, 1);
				expect(frame.identity.height).toBeCloseTo(32, 1);
			}
			if (reducedMotion === "no-preference") {
				// The agent moves from its source size into the horizontal group.
				expect(first.agentSize).toBeCloseTo(30, 0);
				expect(last.agentSize).toBeCloseTo(16, 1);
				expect(first.identity.x).toBeCloseTo(last.identity.x, 1);
				expect(first.identity.y).toBeCloseTo(last.identity.y, 1);
				for (const frame of frames) {
					expect(frame.surface.width).toBeLessThanOrEqual(last.surface.width * 1.4 + 0.5);
					expect(frame.surface.height).toBeLessThanOrEqual(last.surface.height * 1.4 + 0.5);
				}
				expect(first.surface.width).toBeLessThan(source.width - 40);
			} else {
				expect(first.surface.width).toBeCloseTo(last.surface.width, 1);
				expect(first.identity.x).toBeCloseTo(last.identity.x, 1);
			}
			// The independent carry tilt projects viewport boxes by fractions of a
			// pixel. Verify the resting dimensions in the surface's own plane.
			expect(await overlay.locator("[data-session-drag-surface]").evaluate((node) => (node as HTMLElement).offsetHeight)).toBe(44);
			const avatar = overlay.locator('[data-slot="human-agent-avatar"]');
			await expect(avatar).toHaveAttribute("data-composition", "group");
			const group = avatar.locator('[data-slot="avatar-group"]');
			await expect(overlay.locator("[data-session-drag-label]")).toHaveText("Priya Raman");
			await expect.poll(() => group.locator('[data-avatar-role]').evaluateAll((nodes) =>
				nodes.map((node) => {
					const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
					return { role: (node as HTMLElement).dataset.avatarRole, width: (node as HTMLElement).offsetWidth * matrix.a, height: (node as HTMLElement).offsetHeight * matrix.d };
				}),
			)).toEqual([
				{ role: "agent", width: 16, height: 16 },
				{ role: "human", width: 16, height: 16 },
			]);
			// The destination holds for the gesture beyond the demo's repeat pause.
			await page.waitForTimeout(1_600);
			await expect(avatar).toHaveAttribute("data-composition", "group");
			await expect(overlay.locator('[data-avatar-role]')).toHaveCount(2);
			await page.screenshot({ path: `output/agent-browser/session-drag-morph-${reducedMotion}-${firstMove}.png` });
			await expect.poll(() => overlay.locator("[data-session-drag-surface]").evaluate((node) => (
				(node as HTMLElement).style.willChange
			))).toBe("");
			// Cancel during a subsequent gesture as well as releasing this one.
			await page.getByRole("heading", { name: "Jira Design" }).hover();
			await page.mouse.up();
			await expect(overlay).toHaveCount(0);
			await expect(article).toBeVisible();
			await article.scrollIntoViewIfNeeded();
			const restored = await article.boundingBox();
			if (!restored) return;
			await page.mouse.move(restored.x + restored.width / 2, restored.y + restored.height / 2);
			await page.mouse.down();
			await page.mouse.move(restored.x + restored.width / 2 + 4, restored.y + restored.height / 2);
			await expect(overlay).toHaveCount(1);
			if (reducedMotion === "no-preference") {
				await page.emulateMedia({ reducedMotion: "reduce" });
				await expect.poll(() => overlay.locator("[data-session-drag-surface]").evaluate((node) => (
					(node as HTMLElement).style.transform
				))).toBe("");
			}
			await article.dispatchEvent("pointercancel");
			await page.mouse.up();
			await expect(overlay).toHaveCount(0);
			await expect(article).toBeVisible();
		});
	}
}
