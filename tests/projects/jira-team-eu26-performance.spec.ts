import { execFileSync } from "node:child_process";
import { arch, cpus, platform, release } from "node:os";
import { expect, test, type Page } from "@playwright/test";
import {
	selectInteractionSample,
	summarizeInteractionSamples,
	selectJourneyTiming,
	summarizeJourneyTimings,
	type EventTimingRecord,
	type InteractionSample,
	type SampleAction,
} from "@/tests/helpers/interaction-performance";
import { appUrl } from "@/tests/helpers/origin";

const eventTimingDeliveryTimeoutMs = 1_000;
const journeyDeliveryTimeoutMs = 30_000;

test.use({ ignoreHTTPSErrors: true });

type BrowserAction = SampleAction & { clickedAtMs: number | null; startedAtMs: number | null; acknowledgedAtMs: number | null; readyAtMs: number | null; element: Element };
type BrowserSampler = {
	actions: BrowserAction[];
	collect: (entries: PerformanceEntry[]) => void;
	entries: EventTimingRecord[];
	listener: (event: MouseEvent) => void;
	observer: PerformanceObserver | null;
	frame: number | null;
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
	await page.goto(appUrl("/jira-team-eu26"), { waitUntil: "domcontentloaded" });
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

async function recordBoardListTrial(page: Page, repeatCount: number, trial: number) {
	await openBoard(page);
	// Wait for the finite, intentionally randomized demo arrivals to finish.
	await expect(page.locator('[data-jira-team-eu26-board-surface]')).toHaveAttribute("data-agent-session-sync", "settled", { timeout: 240_000 });
	const conditionsBefore = await page.evaluate(() => ({
		contentPreset: document.querySelector("[data-jira-team-eu26-board-surface]")?.getAttribute("data-jira-team-eu26-content") ?? "unknown",
		fixtureLabel: document.querySelector('[aria-label^="Unlink sessions, "]')?.getAttribute("aria-label") ?? "unknown",
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
			frame: null,
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
				action.startedAtMs = performance.now();
				const observeReady = () => {
					const selected = action.element.getAttribute("aria-selected") === "true";
					if (selected && action.acknowledgedAtMs === null) action.acknowledgedAtMs = performance.now();
					const surface = document.querySelector("[data-jira-team-eu26-board-surface]");
					const content = surface?.querySelectorAll(action.view === "List"
						? '[data-testid="jira-list"] tbody tr'
						: "[data-jira-kanban-column]");
					const visible = [...(content ?? [])].filter((element) => element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));
					if (selected && (action.view === "List" ? visible.length > 0 : visible.length === 4)) {
						action.readyAtMs = performance.now();
						state.frame = null;
					} else state.frame = requestAnimationFrame(observeReady);
				};
				state.frame = requestAnimationFrame(observeReady);
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
	const journeys: (ReturnType<typeof selectJourneyTiming> & { view: string; visit: "cold" | "warm"; trial: number })[] = [];
	const seenInteractionIds = new Set<number>();
	// Board mounted on navigation; the first List activation is cold, Board returns are warm.
	const visited = new Set(["Board"]);
	try {
		for (let index = 0; index < repeatCount; index += 1) {
			for (const view of ["List", "Board"]) {
				const settings = { id: `${view.toLowerCase()}-${trial}-${index + 1}`, targetId: `role=tab[name=${view}]`, view, visit: visited.has(view) ? "warm" as const : "cold" as const };
				const tab = page.getByRole("tab", { name: view, exact: true });
				await tab.evaluate((element, action) => {
					const state = (window as SamplerWindow).eu26PerformanceSampler;
					if (!state) throw new Error("Expected the Event Timing sampler.");
					if (state.frame !== null) cancelAnimationFrame(state.frame);
					state.frame = null;
					state.actions.push({ ...action, armedAtMs: performance.now(), clickedAtMs: null, startedAtMs: null, acknowledgedAtMs: null, readyAtMs: null, element });
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
					while (performance.now() - started < timeoutMs) {
						state.collect(state.observer?.takeRecords() ?? []);
						const pending = state.actions.find((action) => action.id === id);
						if (pending && pending.readyAtMs !== null
							&& (!state.supported || performance.now() - started >= 1_000 || state.entries.some((entry) => entry.actionId === id && entry.name === "click"))) {
							deliveredAt ??= performance.now();
							if (performance.now() - deliveredAt >= 100) break;
						}
						await new Promise((resolve) => setTimeout(resolve, 25));
					}
					state.collect(state.observer?.takeRecords() ?? []);
					const action = state.actions.find((candidate) => candidate.id === id);
					if (!action) throw new Error(`Missing armed action: ${id}`);
					return {
						action: { armedAtMs: action.armedAtMs, clickedAtMs: action.clickedAtMs, startedAtMs: action.startedAtMs, acknowledgedAtMs: action.acknowledgedAtMs, readyAtMs: action.readyAtMs, id: action.id, targetId: action.targetId, view: action.view, visit: action.visit },
						entries: state.entries.filter((entry) => entry.actionId === id),
					};
				}, { id: settings.id, timeoutMs: journeyDeliveryTimeoutMs });
				journeys.push({ ...selectJourneyTiming(captured.action), view, visit: settings.visit, trial });
				samples.push(selectInteractionSample({ ...captured, seenInteractionIds, supported }));
				visited.add(view);
			}
		}
	} finally {
		await page.evaluate(() => {
			const state = (window as SamplerWindow).eu26PerformanceSampler;
			state?.observer?.disconnect();
			if (state?.frame !== null && state?.frame !== undefined) cancelAnimationFrame(state.frame);
			if (state) document.removeEventListener("click", state.listener, { capture: true });
			delete (window as SamplerWindow).eu26PerformanceSampler;
		});
	}
	return { samples, journeys, supported, conditionsBefore };
}

test("record repeatable cold and warm Board and List interaction samples", async ({ page, browser, browserName }, testInfo) => {
	test.skip(!process.env.VPK_PERF_SAMPLES, "Opt-in machine/build-specific measurement.");
	const repeatCount = Number(process.env.VPK_PERF_SAMPLES);
	const trialCount = Number(process.env.VPK_PERF_TRIALS ?? 1);
	if (![repeatCount, trialCount].every((count) => Number.isSafeInteger(count) && count > 0)) throw new Error("Samples and trials must be positive integers.");
	test.setTimeout(300_000 * trialCount);
	const trials = [];
	for (let trial = 1; trial <= trialCount; trial += 1) trials.push(await recordBoardListTrial(page, repeatCount, trial));
	const samples = trials.flatMap((trial) => trial.samples);
	const journeys = trials.flatMap((trial) => trial.journeys);
	const artifact = {
		schemaVersion: 3,
		origin: new URL(page.url()).origin,
		trialCount,
		lifecycleReset: "fresh navigation per trial; browser/server/build caches unchanged",
		route: "/jira-team-eu26",
		measurement: {
			kind: "lab-attributed-event-timing",
			duration: "maximum observed event duration for the attributed click interaction",
			phases: "input, processing and presentation of that maximum-duration event",
			durationRoundingMs: 8,
			durationThresholdMs: 16,
			eventDeliveryMinimumWaitMs: eventTimingDeliveryTimeoutMs,
			journeyDeliveryTimeoutMs,
			percentileMethod: "nearest-rank",
			varianceMethod: "population",
			coldMeaning: "first activation of an unvisited view; page and caches may already be warm",
			missingMeaning: "unsupported, below reporting threshold, unattributed, invalid or absent within observation window; never zero-filled",
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
			background: { workload: process.env.VPK_PERF_BACKGROUND ?? "unknown", source: process.env.VPK_PERF_BACKGROUND ? "declared" : "unknown", fixture: "authored arrivals and state-transition queue settled before measurement; observed count recorded per trial" },
			before: trials.map((trial) => trial.conditionsBefore),
			after: await page.evaluate(() => ({ documentFocused: document.hasFocus(), visibilityState: document.visibilityState })),
		},
		samples,
		journeys,
		journeyMeasurement: "click-listener dispatch to selected-tab acknowledgement and visible view rows/columns on an animation frame; excludes earlier input delay, network/model waits and painted-pixel completion",
		journeySummaries: summarizeJourneyTimings(journeys),
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


test("EU26 opens the deferred assignee picker with keyboard and keeps its List draft", async ({ page }) => {
	await openBoard(page);
	await page.getByRole("tab", { name: "List", exact: true }).click();
	await page.getByTestId("jira-list-footer-controls").getByRole("button").click();
	const draft = page.getByPlaceholder("What needs to be done?");
	await draft.fill("Keep this list draft");
	const trigger = page.getByRole("button", { name: "Set assignee", exact: true });
	await trigger.press("Enter");
	const menu = page.getByRole("listbox", { name: "Assign work item" });
	await expect(menu).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(trigger).toBeFocused();
	await expect(draft).toHaveValue("Keep this list draft");
	await trigger.press("Enter");
	await expect(menu).toBeVisible();
	await menu.getByRole("option").first().press("Enter");
	await expect(menu).not.toBeVisible();
	await expect(page.getByRole("button", { name: /^Assignee:/u })).toBeFocused();
	await page.getByRole("tab", { name: "Board", exact: true }).click();
	await page.getByRole("tab", { name: "List", exact: true }).click();
	await expect(draft).toHaveValue("Keep this list draft");
});


test("EU26 frame-batched resize preserves keyboard bounds, release, and cancellation", async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem("ui-design-variants", JSON.stringify({ schemaVersion: 2, agentSessionColumnResizing: true })));
	await openBoard(page);
	const handle = page.getByRole("separator", { name: "Resize Unlink sessions column" });
	await expect(handle).toBeVisible();
	for (const key of ["End", "Home", "End", "Home"]) {
		await handle.press(key);
		await expect(handle).toHaveAttribute("aria-valuenow", key === "Home" ? "280" : "560");
	}
	await handle.hover();
	const box = await handle.boundingBox();
	if (!box) throw new Error("Expected resize handle geometry");
	const x = box.x + box.width / 2, y = box.y + 80;
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x + 80, y, { steps: 20 });
	await page.mouse.up();
	await expect(handle).toHaveAttribute("aria-valuenow", "360");
	await handle.hover();
	const moved = await handle.boundingBox();
	if (!moved) throw new Error("Expected committed resize handle");
	await page.mouse.move(moved.x + moved.width / 2, y);
	await page.mouse.down();
	await page.mouse.move(moved.x + moved.width / 2 + 100, y);
	await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true })));
	await page.mouse.up();
	await expect(handle).toHaveAttribute("aria-valuenow", "360");
	await handle.dblclick();
	await expect(handle).toHaveAttribute("aria-valuenow", "280");
});
