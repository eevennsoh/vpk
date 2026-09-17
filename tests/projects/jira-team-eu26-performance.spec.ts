import { execFileSync } from "node:child_process";
import { arch, cpus, platform, release } from "node:os";
import { expect, test, type Page } from "@playwright/test";
import {
	selectInteractionSample,
	summarizeInteractionSamples,
	type EventTimingRecord,
	type InteractionSample,
	type SampleAction,
} from "@/tests/helpers/interaction-performance";

const eventTimingDeliveryTimeoutMs = 1_000;

function worktreeOrigin() {
	return (process.env.PLAYWRIGHT_BASE_URL
		?? execFileSync(process.execPath, [".agents/skills/vpk-verify/scripts/control-vpk", "url"], { encoding: "utf8" }).trim())
		.replace(/\/$/u, "");
}

test.use({ ignoreHTTPSErrors: true });

type BrowserAction = SampleAction & { clickedAtMs: number | null; element: Element };
type BrowserSampler = {
	actions: BrowserAction[];
	collect: (entries: PerformanceEntry[]) => void;
	entries: EventTimingRecord[];
	listener: (event: MouseEvent) => void;
	observer: PerformanceObserver | null;
	supported: boolean;
};
type SamplerWindow = Window & { eu26PerformanceSampler?: BrowserSampler };

function localCheckout() {
	try {
		return {
			revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
			dirty: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0,
		};
	} catch {
		return { revision: "unknown", dirty: "unknown" };
	}
}

async function openBoard(page: Page) {
	await page.goto(`${worktreeOrigin()}/jira-team-eu26`, { waitUntil: "domcontentloaded" });
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

test("record repeatable cold and warm Board and List interaction samples", async ({ page, browser, browserName }, testInfo) => {
	test.skip(!process.env.VPK_PERF_SAMPLES, "Opt-in measurement; timings depend on the machine and build mode.");
	const repeatCount = Number(process.env.VPK_PERF_SAMPLES);
	if (!Number.isSafeInteger(repeatCount) || repeatCount <= 0) throw new Error("VPK_PERF_SAMPLES must be a positive integer.");
	test.setTimeout(180_000);
	await openBoard(page);
	const origin = new URL(page.url()).origin;
	// Wait for the finite, intentionally randomized demo arrivals to finish.
	await page.waitForFunction(() => document.querySelector('[aria-label="Unlink sessions, 24 sessions"]') !== null, undefined, { timeout: 75_000 });
	const conditionsBefore = await page.evaluate(() => ({
		deviceMemoryGiB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? "unknown",
		documentFocused: document.hasFocus(),
		hardwareConcurrency: navigator.hardwareConcurrency,
		userAgent: navigator.userAgent,
		viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
		visibilityState: document.visibilityState,
	}));
	const supported = await page.evaluate(() => {
		const state: BrowserSampler = {
			actions: [],
			collect: () => {},
			entries: [],
			listener: () => {},
			observer: null,
			supported: typeof PerformanceObserver !== "undefined"
				&& PerformanceObserver.supportedEntryTypes.includes("event")
				&& typeof PerformanceEventTiming !== "undefined"
				&& "interactionId" in PerformanceEventTiming.prototype,
		};
		state.collect = (entries) => {
			for (const raw of entries) {
				if (!["pointerdown", "pointerup", "click"].includes(raw.name)) continue;
				const entry = raw as PerformanceEventTiming & { interactionId?: number };
				const action = state.actions.findLast((candidate) => entry.target !== null
					&& candidate.element.contains(entry.target)
					&& entry.startTime >= candidate.armedAtMs
					&& (candidate.clickedAtMs === null || entry.startTime <= candidate.clickedAtMs + 1));
				state.entries.push({
					actionId: action?.id ?? null,
					durationMs: entry.duration,
					interactionId: entry.interactionId ?? null,
					name: entry.name,
					processingEndMs: entry.processingEnd,
					processingStartMs: entry.processingStart,
					startTimeMs: entry.startTime,
					targetId: action?.targetId ?? null,
				});
			}
		};
		state.listener = (event) => {
			const action = state.actions.at(-1);
			if (action?.clickedAtMs === null && event.target instanceof Node && action.element.contains(event.target)) {
				action.clickedAtMs = event.timeStamp;
			}
		};
		document.addEventListener("click", state.listener, { capture: true });
		if (state.supported) {
			try {
				state.observer = new PerformanceObserver((list) => state.collect(list.getEntries()));
				state.observer.observe({ type: "event", durationThreshold: 16 } as PerformanceObserverInit);
			} catch {
				state.supported = false;
			}
		}
		(window as SamplerWindow).eu26PerformanceSampler = state;
		return state.supported;
	});
	const samples: InteractionSample[] = [];
	const seenInteractionIds = new Set<number>();
	// Board mounted on navigation; the first List activation is cold, Board returns are warm.
	const visited = new Set(["Board"]);
	try {
		for (let index = 0; index < repeatCount; index += 1) {
			for (const view of ["List", "Board"]) {
				const settings = { id: `${view.toLowerCase()}-${index + 1}`, targetId: `role=tab[name=${view}]`, view, visit: visited.has(view) ? "warm" as const : "cold" as const };
				const tab = page.getByRole("tab", { name: view, exact: true });
				await tab.evaluate((element, action) => {
					const state = (window as SamplerWindow).eu26PerformanceSampler;
					if (!state) throw new Error("Expected the Event Timing sampler.");
					state.actions.push({ ...action, armedAtMs: performance.now(), clickedAtMs: null, element });
				}, settings);
				await tab.click();
				await expect(tab).toHaveAttribute("aria-selected", "true");
				if (view === "Board") await expect(page.locator("[data-jira-kanban-column]")).toHaveCount(4);
				else await expect(page.getByRole("region", { name: "Payments SDK v2 migration work items list" })).toBeVisible();
				const captured = await page.evaluate(async ({ id, timeoutMs }) => {
					const state = (window as SamplerWindow).eu26PerformanceSampler;
					if (!state) throw new Error("Expected the Event Timing sampler.");
					const started = performance.now();
					let deliveredAt: number | null = null;
					while (state.supported && performance.now() - started < timeoutMs) {
						state.collect(state.observer?.takeRecords() ?? []);
						if (state.entries.some((entry) => entry.actionId === id && entry.name === "click")) {
							deliveredAt ??= performance.now();
							if (performance.now() - deliveredAt >= 100) break;
						}
						await new Promise((resolve) => setTimeout(resolve, 25));
					}
					state.collect(state.observer?.takeRecords() ?? []);
					const action = state.actions.find((candidate) => candidate.id === id);
					if (!action) throw new Error(`Missing armed action: ${id}`);
					return {
						action: { armedAtMs: action.armedAtMs, clickedAtMs: action.clickedAtMs, id: action.id, targetId: action.targetId, view: action.view, visit: action.visit },
						entries: state.entries.filter((entry) => entry.actionId === id),
					};
				}, { id: settings.id, timeoutMs: eventTimingDeliveryTimeoutMs });
				samples.push(selectInteractionSample({ ...captured, seenInteractionIds, supported }));
				visited.add(view);
			}
		}
	} finally {
		await page.evaluate(() => {
			const state = (window as SamplerWindow).eu26PerformanceSampler;
			state?.observer?.disconnect();
			if (state) document.removeEventListener("click", state.listener, { capture: true });
			delete (window as SamplerWindow).eu26PerformanceSampler;
		});
	}
	const artifact = {
		schemaVersion: 2,
		origin,
		route: "/jira-team-eu26",
		measurement: {
			kind: "lab-attributed-event-timing",
			duration: "maximum observed event duration for the attributed click interaction",
			phases: "input, processing and presentation of that maximum-duration event",
			durationRoundingMs: 8,
			durationThresholdMs: 16,
			deliveryTimeoutMs: eventTimingDeliveryTimeoutMs,
			percentileMethod: "nearest-rank",
			varianceMethod: "population",
			coldMeaning: "first activation of an unvisited view; page and caches may already be warm",
			missingMeaning: "unsupported, below reporting threshold, unattributed, invalid or absent within delivery window; never zero-filled",
		},
		conditions: {
			localCheckout: localCheckout(),
			servedRevision: { value: process.env.VPK_PERF_REVISION ?? "unknown", source: process.env.VPK_PERF_REVISION ? "declared" : "unknown" },
			buildMode: ["development", "production"].includes(process.env.VPK_PERF_BUILD_MODE ?? "") ? process.env.VPK_PERF_BUILD_MODE : "unknown",
			buildModeSource: ["development", "production"].includes(process.env.VPK_PERF_BUILD_MODE ?? "") ? "declared" : "unknown",
			browser: { name: browserName, version: browser.version(), project: testInfo.project.name },
			host: { source: "runner-host", platform: platform(), release: release(), arch: arch(), logicalCpus: cpus().length, nodeVersion: process.version },
			context: { source: "configured", viewport: testInfo.project.use.viewport ?? "default", deviceScaleFactor: testInfo.project.use.deviceScaleFactor ?? "default", isMobile: testInfo.project.use.isMobile ?? "default", hasTouch: testInfo.project.use.hasTouch ?? "default" },
			cache: { state: process.env.VPK_PERF_CACHE_STATE ?? "unknown", source: process.env.VPK_PERF_CACHE_STATE ? "declared" : "unknown", policy: "unchanged by sampler" },
			background: { workload: process.env.VPK_PERF_BACKGROUND ?? "unknown", source: process.env.VPK_PERF_BACKGROUND ? "declared" : "unknown", fixture: "24-session arrival sequence settled before measurement" },
			before: conditionsBefore,
			after: await page.evaluate(() => ({ documentFocused: document.hasFocus(), visibilityState: document.visibilityState })),
		},
		samples,
		summaries: summarizeInteractionSamples(samples),
	};
	await testInfo.attach("interaction-samples", { body: JSON.stringify(artifact, null, 2), contentType: "application/json" });
	console.log(JSON.stringify(artifact));
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
