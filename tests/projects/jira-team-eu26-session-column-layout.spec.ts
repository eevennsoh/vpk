import { expect, test, type Page } from "@playwright/test";

const JIRA_TEAM_EU26_URL = (
	process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"
) + "/jira-team-eu26";
const JIRA_TEAM_EU26_EMBEDDED_URL = (
	process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"
) + "/preview/projects/jira-team-eu26?embedded=1";

for (const width of [1440, 1024]) {
	test(`empty collapsed unlink sessions shares the status pill geometry at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.clock.install();
		await page.goto(JIRA_TEAM_EU26_URL, { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible();
		await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 100));
		const needsInput = page.getByRole("button", { name: /^Needs input:/u });
		await needsInput.click();
		const column = page.getByRole("region", { name: "Unlink sessions, 0 sessions", exact: true });
		await expect(column).toBeVisible();
		await page.getByRole("button", { name: "Collapse Unlink sessions column" }).click();
		await expect(column).toHaveCSS("width", "32px");
		const title = column.getByText("Unlink sessions", { exact: true });
		await expect(title).toBeVisible();
		await expect(title).toHaveCSS("writing-mode", "vertical-rl");
		await expect(column.locator("[data-agent-session-column-rail]")).toHaveCount(0);
		await expect(column.locator("[data-agent-session-column-surface]")).toHaveCount(0);
		const geometry = await title.evaluate((label) => {
			const pill = label.parentElement!.parentElement!;
			const statusTitle = document.querySelector<HTMLElement>('[data-jira-kanban-column="To do"] span.truncate')!;
			const statusPill = statusTitle.parentElement!.parentElement!;
			const pillStyle = getComputedStyle(pill);
			const statusStyle = getComputedStyle(statusPill);
			return {
				width: pill.getBoundingClientRect().width,
				statusWidth: statusPill.getBoundingClientRect().width,
				radius: pillStyle.borderRadius,
				statusRadius: statusStyle.borderRadius,
				border: pillStyle.borderTopWidth,
				stroke: pillStyle.borderTopColor,
				height: pill.getBoundingClientRect().height,
				countTop: pill.querySelector("[data-agent-session-column-count]")!.getBoundingClientRect().top,
				statusCountTop: statusPill.querySelector(".h-6")!.getBoundingClientRect().top,
			};
		});
		expect(geometry.width).toBe(geometry.statusWidth);
		expect(geometry.radius).toBe(geometry.statusRadius);
		expect(geometry.border).toBe("1px");
		expect(geometry.stroke).not.toBe("rgba(0, 0, 0, 0)");
		expect(geometry.height).toBeLessThan(200);
		expect(geometry.countTop).toBeCloseTo(geometry.statusCountTop, 0);
		await page.getByRole("button", { name: "Expand Unlink sessions column" }).focus();
		await page.keyboard.press("Enter");
		await expect(column).toHaveCSS("width", "280px");
		await expect(column.getByText("No sessions to unlink", { exact: true })).toBeVisible();
		await needsInput.click();
		await expect(page.locator("[data-agent-session-column-scrollport]")).toBeVisible();
		await page.getByRole("button", { name: "Collapse Unlink sessions column" }).click();
		await expect(page.locator("[data-agent-session-column-rail]")).toBeVisible();
	});
}

async function openBoard(page: Page): Promise<void> {
	await page.goto(JIRA_TEAM_EU26_URL, { waitUntil: "networkidle" });
	await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible({
		timeout: 15_000,
	});
	const session = page.locator("[data-agent-session-column]")
		.getByTestId("agent-session-row-lw-scope-thread");
	const options = page.getByRole("button", { name: "Unlink sessions column options" });
	if (!await session.isVisible()) {
		const directExpand = page.getByRole("button", { name: "Expand Unlink sessions column" });
		if (await directExpand.isVisible()) {
			await directExpand.click();
			await expect(session).toBeVisible();
			return;
		}
		if (await page.locator("[data-agent-session-column-hit-area]").count() > 0) {
			await revealCollapsedAgentSessionColumn(page);
		}
		await options.click();
		const pin = page.getByRole("menuitem", { name: "Pin", exact: true });
		if (await pin.isVisible()) {
			await pin.click();
			await page.getByRole("button", { name: "Unlink sessions column options" }).click();
		}
		await page.getByRole("menuitem", { name: "Expand" }).click();
	}
	await expect(session).toBeVisible();
}

async function openCollapsedBoard(page: Page): Promise<void> {
	await page.goto(JIRA_TEAM_EU26_URL, { waitUntil: "domcontentloaded" });
	await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible({
		timeout: 15_000,
	});
	await expect(page.getByRole("button", { name: "Unlink sessions column options" })).toBeVisible();
}

test("collapsed status glyphs cover the resting dot before returning to it", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(JIRA_TEAM_EU26_URL, { waitUntil: "domcontentloaded" });
	await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible({ timeout: 15_000 });
	await expect(page.locator("[data-agent-session-column-rail]")).toBeAttached();
	const notch = page.getByTestId("agent-session-notch-lw-sync-webhook-gap");
	await expect(notch).toBeAttached({ timeout: 20_000 });

	for (const [state, accessibleState] of [
		["needs-input", "needs input"],
		["complete", "finished"],
	] as const) {
		const mark = notch.locator(`[data-agent-session-state-mark="${state}"]`);
		await expect(mark).toBeAttached({ timeout: 25_000 });
		await expect.poll(async () => mark.evaluate((element) => Number(getComputedStyle(element).opacity)), {
			timeout: 25_000,
		}).toBeGreaterThan(0.8);
		const backing = await mark.evaluate((element) => {
			const style = getComputedStyle(element);
			return {
				backgroundColor: style.backgroundColor,
				backgroundAlpha: style.backgroundColor.startsWith("rgb(")
					? 1
					: Number(style.backgroundColor.match(/^rgba\([^)]*,\s*([0-9.]+)\)$/u)?.[1] ?? 0),
				borderRadius: Number.parseFloat(style.borderTopLeftRadius),
				width: element.getBoundingClientRect().width,
			};
		});
		expect(backing.backgroundAlpha, `Expected an opaque backing, got ${backing.backgroundColor}`).toBe(1);
		expect(backing.width).toBeGreaterThanOrEqual(10);
		expect(backing.borderRadius).toBeGreaterThanOrEqual(backing.width / 2);
		await expect(notch).toHaveAccessibleName(new RegExp(accessibleState, "u"));
	}
});

async function revealCollapsedAgentSessionColumn(page: Page): Promise<void> {
	const hitArea = page.locator("[data-agent-session-column-hit-area]");
	const hitAreaBox = await hitArea.boundingBox();
	expect(hitAreaBox).not.toBeNull();
	if (!hitAreaBox) return;

	await page.mouse.move(
		hitAreaBox.x + hitAreaBox.width / 2,
		hitAreaBox.y + hitAreaBox.height / 2,
	);
	await expect(hitArea).toHaveCount(0);
}

async function openHeightComparisonBoard(page: Page): Promise<void> {
	await openBoard(page);
	await expect(page.locator("[data-agent-session-column-expansion]"))
		.toHaveAttribute("data-agent-session-column-expansion", "expanded");
	// Leave the column's focus/pointer pause before waiting for live revisions.
	await page.getByRole("heading", { name: "Jira Design" }).click();
	await expect(page.locator('[data-agent-session-column] [data-agent-session-lifecycle-current="needs-input"]').first())
		.toBeVisible({ timeout: 20_000 });
}

for (const collapsed of [true, false]) {
	test(`status revisions fade at their old slot and return at the top in ${collapsed ? "collapsed" : "expanded"} mode`, async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		if (collapsed) {
			await page.goto(JIRA_TEAM_EU26_URL, { waitUntil: "domcontentloaded" });
			await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible();
		} else {
			await openBoard(page);
			await page.getByRole("heading", { name: "Jira Design" }).click();
		}
		const id = `agent-session-${collapsed ? "notch" : "row"}-lw-sync-webhook-gap`;
		const row = page.getByTestId(id);
		await expect(row).toBeAttached({ timeout: 10_000 });
		if (!collapsed) await expect(row.locator(".shimmer")).toHaveCount(0);
		const trace = await page.evaluateHandle(({ id, collapsed }) => {
			const samples: { leaving: boolean; index: number; opacity: number; translateY: number; height: number; glow: boolean; accent: string; state: string | null; shownState: string | null; rotating: boolean; humanTransform: string | null; avatarWidth: number }[] = [];
			let stopped = false;
			const sample = () => {
				const element = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
				const host = collapsed ? element?.closest("li") : element;
				if (host) {
					const style = getComputedStyle(host);
					const transform = style.transform === "none" ? null : new DOMMatrixReadOnly(style.transform);
					const glow = host.querySelector<HTMLElement>("[data-agent-session-status-glow]");
					const avatar = host.querySelector<HTMLElement>('[data-slot="human-agent-avatar"]');
					const human = avatar?.querySelector<HTMLElement>('[data-avatar-role="human"]');
					samples.push({
						leaving: host.hasAttribute(collapsed ? "data-agent-session-status-exit" : "data-departing"),
						index: Array.from(host.parentElement?.children ?? []).indexOf(host),
						opacity: Number(style.opacity),
						translateY: transform?.m42 ?? 0,
						height: host.getBoundingClientRect().height,
						glow: glow !== null,
						accent: getComputedStyle(host).getPropertyValue("--card-glow-tile-accent").trim(),
						state: host.querySelector("[data-agent-session-lifecycle-current]")?.getAttribute("data-agent-session-lifecycle-current") ?? null,
						shownState: host.querySelector("[data-agent-session-lifecycle-shown]")?.getAttribute("data-agent-session-lifecycle-shown") ?? null,
						rotating: avatar?.getAttribute("data-animated") === "true",
						humanTransform: human ? getComputedStyle(human).transform : null,
						avatarWidth: avatar?.getBoundingClientRect().width ?? 0,
					});
				}
				if (!stopped) requestAnimationFrame(sample);
			};
			requestAnimationFrame(sample);
			return { samples, stop: () => { stopped = true; } };
		}, { id, collapsed });
		await expect.poll(async () => collapsed
			? row.getAttribute("aria-label").then((label) => label ?? row.textContent())
			: row.locator("[data-agent-session-lifecycle-current]").getAttribute("data-agent-session-lifecycle-current"),
		{ timeout: 15_000 }).toMatch(/needs.?input/u);
		// The first revision is already first. The next arrival displaces it,
		// so its teammate-completed revision must retire the old lower slot.
		await expect.poll(async () => collapsed
			? row.textContent()
			: row.locator("[data-agent-session-lifecycle-current]").getAttribute("data-agent-session-lifecycle-current"),
		{ timeout: 15_000 }).toMatch(collapsed ? /finished/u : /complete/u);
		await expect.poll(() => row.evaluate((element) => {
			const host = element.closest("li");
			return host?.parentElement?.firstElementChild === host;
		})).toBe(true);
		if (!collapsed) {
			await expect(row.locator("[data-agent-session-lifecycle-shown]")).toHaveAttribute("data-agent-session-lifecycle-shown", "complete");
			await expect(row.locator("[data-agent-session-lifecycle-shown] > span").last()).toHaveCSS("will-change", "auto");
			await expect(row.locator("[data-agent-session-status-glow]")).toHaveCount(0, { timeout: 5_000 });
			await expect(row.locator(".shimmer")).toHaveCount(0);
		}
		const samples = await trace.evaluate((value) => { value.stop(); return value.samples; });
		await trace.dispose();
		const departure = samples.findIndex((sample) => sample.leaving && sample.index > 0);
		expect(departure).toBeGreaterThanOrEqual(0);
		const revision = samples.slice(departure);
		expect(revision.some((sample) => sample.leaving && sample.opacity < 0.5)).toBe(true);
		expect(revision.some((sample) => !sample.leaving && sample.index === 0 && sample.opacity > 0.8)).toBe(true);
		// Expanded arrivals now enter from one full row above; compact notches
		// retain their shorter travel. Keep the bound tied to rendered geometry.
		expect(revision.every((sample) => Math.abs(sample.translateY) <= (collapsed ? 16 : sample.height) + 0.1)).toBe(true);
		if (!collapsed) {
			const rotation = revision.filter((sample) => sample.rotating);
			expect(rotation.length).toBeGreaterThan(3);
			expect(rotation.every((sample) => !sample.leaving && sample.index === 0 && sample.opacity > 0.99)).toBe(true);
			expect(rotation.every((sample) => sample.state === "complete" && sample.shownState === "needs-input" && !sample.glow)).toBe(true);
			expect(new Set(rotation.map((sample) => sample.humanTransform)).size).toBeGreaterThan(3);
			expect(rotation.every((sample) => Math.abs(sample.avatarWidth - 32) < 0.1)).toBe(true);
			const statusSwap = revision.findIndex((sample) => sample.shownState === "complete");
			const rotationStart = revision.findIndex((sample) => sample.rotating);
			expect(statusSwap).toBeGreaterThan(rotationStart);
			expect(revision.slice(statusSwap).every((sample) => !sample.rotating)).toBe(true);
			expect(revision.every((sample) => !sample.glow)).toBe(true);
		}
	});
}

test("reduced motion keeps Working titles static and applies status changes without glow", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await openBoard(page);
	await page.getByRole("heading", { name: "Jira Design" }).click();
	const row = page.getByTestId("agent-session-row-lw-sync-webhook-gap");
	await expect(row).toBeAttached({ timeout: 10_000 });
	await expect(row.locator(".shimmer")).toHaveCount(0);
	await expect(row.locator("[data-agent-session-lifecycle-current]")).toHaveAttribute("data-agent-session-lifecycle-current", "needs-input", { timeout: 15_000 });
	await expect(row.locator("[data-agent-session-status-glow]")).toHaveCount(0);
	await expect(row.locator('[data-slot="human-agent-avatar"]')).toHaveAttribute("data-animated", "false");
	await expect(page.locator("[data-departing]")).toHaveCount(0);
});

test("the expanded session well hugs a short filtered list and caps a long list", async ({ page }) => {
	test.setTimeout(60_000);
	await page.setViewportSize({ width: 1440, height: 900 });
	await openHeightComparisonBoard(page);
	const sessionColumn = page.locator("[data-agent-session-column]");
	const scrollport = sessionColumn.locator("[data-agent-session-column-scrollport]");
	await expect.poll(() => scrollport.evaluate((element) => element.scrollHeight - element.clientHeight))
		.toBeGreaterThan(100);
	const fullHeight = (await sessionColumn.boundingBox())?.height ?? 0;

	await page.getByRole("button", { name: "Needs input: 1 agent" }).click();
	const filteredRows = sessionColumn.locator('[data-testid^="agent-session-row-"]');
	await expect.poll(() => filteredRows.count()).toBeLessThan(6);
	await expect.poll(() => filteredRows.count(), { timeout: 30_000 }).toBeGreaterThan(0);
	const columnBox = await sessionColumn.boundingBox();
	const lastRowBox = await filteredRows.last().boundingBox();
	expect(columnBox && lastRowBox ? columnBox.y + columnBox.height - lastRowBox.y - lastRowBox.height : Infinity)
		.toBeLessThan(32);
	expect(fullHeight - (columnBox?.height ?? fullHeight)).toBeGreaterThan(100);
});

test("Needs input switches session positions without travel", async ({ page }) => {
	test.setTimeout(60_000);
	await page.setViewportSize({ width: 1440, height: 900 });
	await openHeightComparisonBoard(page);
	const rows = page.locator('[data-agent-session-column] [data-testid^="agent-session-row-"]');
	await expect.poll(() => rows.count()).toBeGreaterThan(4);
	await page.waitForTimeout(1_200); // Finish one-time sync arrivals before measuring the filter.
	const needsInput = page.getByRole("button", { name: "Needs input: 1 agent" });

	for (const filtered of [true, false]) {
		await needsInput.click();
		if (filtered) {
			await expect.poll(() => rows.count()).toBeLessThan(6);
			await expect.poll(() => rows.count(), { timeout: 30_000 }).toBeGreaterThan(0);
		} else {
			await expect.poll(() => rows.count()).toBeGreaterThan(4);
		}
		const transforms = await rows.evaluateAll(async (elements) => {
			await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
			return elements.map((element) => getComputedStyle(element).transform);
		});
		expect(transforms.every((transform) => transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)"))
			.toBe(true);
	}
});

test("Advanced timeline omits its scroll ending when filtered sessions fit", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(JIRA_TEAM_EU26_URL, { waitUntil: "domcontentloaded" });
	await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible();
	await page.getByRole("button", { name: "Settings" }).click();
	await page.getByRole("menuitemcheckbox", { name: "Advanced timeline" }).click();
	await page.getByRole("button", { name: "Settings" }).click();
	await page.getByRole("button", { name: "Unlink sessions column options" }).click();
	await page.getByRole("menuitem", { name: "Expand" }).click();
	await page.getByRole("button", { name: "Needs input: 1 agent" }).click();

	const column = page.locator("[data-agent-session-column]");
	const rows = column.locator('[data-testid^="agent-session-row-"]');
	await expect.poll(() => rows.count()).toBeLessThan(6);
	await expect.poll(() => rows.count()).toBeGreaterThan(0);
	await expect(column.getByText("Nice work")).toHaveCount(0);
	const columnBox = await column.boundingBox();
	const lastRowBox = await rows.last().boundingBox();
	expect(columnBox && lastRowBox ? columnBox.y + columnBox.height - lastRowBox.y - lastRowBox.height : Infinity)
		.toBeLessThan(32);

	await page.getByRole("button", { name: "Needs input: 1 agent" }).click();
	await expect.poll(() => rows.count()).toBeGreaterThan(6);
	const scrollport = column.locator("[data-agent-session-column-scrollport]");
	await expect.poll(() => scrollport.evaluate((element) => element.scrollHeight - element.clientHeight))
		.toBeGreaterThan(100);
	await scrollport.hover();
	await page.mouse.wheel(0, 5_000);
	await expect(column.getByText("Nice work").first()).toBeVisible();
});

test("the expanded session plane follows overlay elevation as board columns underlap", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await openHeightComparisonBoard(page);
	for (let attempt = 0; attempt < 3; attempt++) {
		if (await page.getByRole("button", { name: "Dark theme" }).isVisible()) break;
		await page.getByRole("button", { name: /^(Light|System) theme$/u }).click();
	}
	await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");

	const plane = page.locator("[data-agent-session-column-surface]").first();
	const fade = page.locator("[data-agent-session-column] [data-scroll-mask-overlay]").first();
	const board = page.locator("[data-jira-kanban-scrollport]");
	const [surfaceColor, overlayColor] = await page.evaluate(() => {
		const probe = document.createElement("div");
		document.body.append(probe);
		probe.style.backgroundColor = "var(--color-surface)";
		const surface = getComputedStyle(probe).backgroundColor;
		probe.style.backgroundColor = "var(--color-surface-overlay)";
		const overlay = getComputedStyle(probe).backgroundColor;
		probe.remove();
		return [surface, overlay];
	});
	expect(surfaceColor).not.toBe(overlayColor);
	await expect(plane).toHaveCSS("background-color", surfaceColor);
	await board.evaluate((element) => { element.scrollLeft = 120; });
	await expect(plane).toHaveCSS("background-color", overlayColor);
	await expect(fade).toHaveCSS("color", overlayColor);
	expect(await fade.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain(overlayColor);
	await board.evaluate((element) => { element.scrollLeft = 0; });
	await expect(plane).toHaveCSS("background-color", surfaceColor);
	await expect(fade).toHaveCSS("color", surfaceColor);
	expect(await fade.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain(surfaceColor);

	await page.getByRole("button", { name: "Dark theme" }).click();
	await page.getByRole("button", { name: "System theme" }).click();
	await expect(page.locator("html")).toHaveAttribute("data-color-mode", "light");
	await board.evaluate((element) => { element.scrollLeft = 120; });
	await expect(plane).toHaveCSS("background-color", "rgb(255, 255, 255)");
	await page.emulateMedia({ reducedMotion: "reduce" });
	expect(await plane.evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThan(0.001);
});

test("only the expanded resting session well retains its 1px border", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await openHeightComparisonBoard(page);
	const plane = page.locator("[data-agent-session-column-surface]").first();
	const board = page.locator("[data-jira-kanban-scrollport]");

	await expect(plane).toHaveCSS("border-top-width", "1px");
	await board.evaluate((element) => { element.scrollLeft = 120; });
	await expect(plane).toHaveCSS("border-top-width", "0px");
	await expect(plane).toHaveCSS("padding-left", "1px");
	await page.getByRole("button", { name: "Collapse Unlink sessions column" }).click();
	await expect(plane).toHaveCSS("border-top-width", "0px");
	await board.evaluate((element) => { element.scrollLeft = 0; });
	await expect(plane).toHaveCSS("border-top-width", "0px");
	await page.getByRole("button", { name: "Expand Unlink sessions column" }).click();
	await expect(plane).toHaveCSS("border-top-width", "1px");
});

test("the elevated session well keeps depth without a perimeter shadow", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await openHeightComparisonBoard(page);
	for (let attempt = 0; attempt < 3; attempt++) {
		if (await page.getByRole("button", { name: "Dark theme" }).isVisible()) break;
		await page.getByRole("button", { name: /^(Light|System) theme$/u }).click();
	}
	await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");

	const plane = page.locator("[data-agent-session-column-surface]").first();
	await page.locator("[data-jira-kanban-scrollport]").evaluate((element) => { element.scrollLeft = 120; });
	await expect.poll(() => plane.evaluate((element) => getComputedStyle(element).boxShadow))
		.toMatch(/^rgba\(1, 4, 4, 0\.36\) 0px 8px 12px 0px$/u);
	await page.getByRole("button", { name: "Collapse Unlink sessions column" }).click();
	await expect.poll(() => plane.evaluate((element) => getComputedStyle(element).boxShadow))
		.toMatch(/^rgba\(1, 4, 4, 0\.36\) 0px 8px 12px 0px$/u);

	await page.getByRole("button", { name: "Dark theme" }).click();
	await page.getByRole("button", { name: "System theme" }).click();
	await expect(page.locator("html")).toHaveAttribute("data-color-mode", "light");
	await expect.poll(() => plane.evaluate((element) => getComputedStyle(element).boxShadow))
		.toMatch(/^rgba\(30, 31, 33, 0\.15\) 0px 8px 12px 0px$/u);
});

test("hovering the leading gutter stays open without bouncing under a stationary pointer", async ({ page }) => {
	await page.goto(JIRA_TEAM_EU26_EMBEDDED_URL, { waitUntil: "domcontentloaded" });
	await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible();
	const gutter = await page.locator("[data-agent-session-column-hit-area]").boundingBox();
	if (!gutter) throw new Error("Expected the leading gutter");
	const origin = await page.evaluate(() => ({
		left: document.querySelector('[data-jira-kanban-column="To do"]')!.getBoundingClientRect().left,
		rail: document.querySelector("[data-agent-session-column]")!.getBoundingClientRect().left,
	}));
	await page.mouse.move(gutter.x + 2, gutter.y + 30);
	const samples = await page.evaluate(async () => {
		const values: { open: boolean; left: number; rail: number }[] = [];
		const started = performance.now();
		while (performance.now() - started < 650) {
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			values.push({
				open: !document.querySelector("[data-agent-session-column-hit-area]"),
				left: document.querySelector('[data-jira-kanban-column="To do"]')!.getBoundingClientRect().left,
				rail: document.querySelector("[data-agent-session-column]")!.getBoundingClientRect().left,
			});
		}
		return values;
	});
	expect(samples.slice(2).every((sample) => sample.open)).toBe(true);
	for (let index = 1; index < samples.length; index++) {
		expect(samples[index].left).toBeGreaterThanOrEqual(samples[index - 1].left - 0.5);
	}
	const settled = samples[samples.length - 1];
	for (const sample of samples) {
		const boardProgress = (sample.left - origin.left) / (settled.left - origin.left);
		const railProgress = (sample.rail - origin.rail) / (settled.rail - origin.rail);
		expect(Math.abs(boardProgress - railProgress)).toBeLessThan(0.15);
	}
	await page.getByRole("heading", { name: "Jira Design" }).hover();
	await expect(page.locator("[data-agent-session-column-hit-area]")).toHaveCount(1);
	const exitSamples = await page.evaluate(async () => {
		const values: { left: number; rail: number }[] = [];
		const started = performance.now();
		while (performance.now() - started < 300) {
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			values.push({
				left: document.querySelector('[data-jira-kanban-column="To do"]')!.getBoundingClientRect().left,
				rail: document.querySelector("[data-agent-session-column]")!.getBoundingClientRect().left,
			});
		}
		return values;
	});
	for (let index = 0; index < exitSamples.length; index++) {
		const sample = exitSamples[index];
		const boardProgress = (sample.left - origin.left) / (settled.left - origin.left);
		const railProgress = (sample.rail - origin.rail) / (settled.rail - origin.rail);
		expect(Math.abs(boardProgress - railProgress)).toBeLessThan(0.15);
		if (index > 0) expect(sample.left).toBeLessThanOrEqual(exitSamples[index - 1].left + 0.5);
	}
	for (let repeat = 0; repeat < 3; repeat++) {
		await page.mouse.move(gutter.x + 2, gutter.y + 30);
		await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
		await page.mouse.move(gutter.x + 180, gutter.y - 30);
	}
	await page.mouse.move(gutter.x + 2, gutter.y + 30);
	await expect(page.locator("[data-agent-session-column-hit-area]")).toHaveCount(0);
	await expect.poll(async () => (await page.locator('[data-jira-kanban-column="To do"]').boundingBox())?.x).toBeCloseTo(settled.left, 0);
});

test("session column slots between statuses and supports cancellation and keyboard movement", async ({ page }) => {
	await openBoard(page);
	const placement = page.locator("[data-session-column-placement]");
	const column = page.locator("[data-agent-session-column]");
	const originalColumn = await column.elementHandle();
	const handle = page.getByRole("button", { name: "Move Unlink sessions column" });
	const todo = page.locator('[data-jira-kanban-column="To do"]');
	const progress = page.locator('[data-jira-kanban-column="In progress"]');
	const start = await handle.boundingBox();
	const target = await todo.boundingBox();
	expect(start).not.toBeNull();
	expect(target).not.toBeNull();
	if (!start || !target) return;
	await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
	await page.mouse.down();
	await page.mouse.move(target.x + target.width - 8, start.y + start.height / 2, { steps: 12 });
	await expect(page.locator('[data-session-column-drop-marker="1"] > span')).toBeVisible();
	await page.mouse.up();
	await expect(placement).toHaveAttribute("data-session-column-placement", "1");
	expect(await originalColumn?.evaluate((element) => element.isConnected)).toBe(true);
	await expect.poll(async () => {
		const [sessions, before, after] = await Promise.all([column.boundingBox(), todo.boundingBox(), progress.boundingBox()]);
		return Boolean(sessions && before && after && sessions.x >= before.x + before.width && sessions.x + sessions.width <= after.x);
	}).toBe(true);
	await handle.focus();
	await page.keyboard.press("ArrowRight");
	await expect(placement).toHaveAttribute("data-session-column-placement", "2");
	const beforeScroll = await column.boundingBox();
	await page.locator("[data-jira-kanban-scrollport]").evaluate((element) => { element.scrollLeft = 100; });
	await expect.poll(async () => (await column.boundingBox())?.x ?? 0).toBeCloseTo((beforeScroll?.x ?? 0) - 100, 0);
	await page.getByRole("tab", { name: "List", exact: true }).click();
	await expect(page.locator("[data-session-column-slot]")).toHaveCount(0);
	await page.getByRole("tab", { name: "Board", exact: true }).click();
	await expect(placement).toHaveAttribute("data-session-column-placement", "2");
	await handle.focus();
	await page.keyboard.press("Home");
	await expect(placement).toHaveAttribute("data-session-column-placement", "0");
	const restored = await handle.boundingBox();
	if (!restored) return;
	await page.mouse.move(restored.x + restored.width / 2, restored.y + restored.height / 2);
	await page.mouse.down();
	await page.mouse.move(target.x + target.width - 8, restored.y + restored.height / 2, { steps: 10 });
	await page.keyboard.press("Escape");
	await page.mouse.up();
	await expect(placement).toHaveAttribute("data-session-column-placement", "0");
	await expect(page.locator("[data-session-column-drop-marker]")).toHaveCount(0);
});

test("the collapsed options button still moves the column and opens its menu", async ({ page }) => {
	await openCollapsedBoard(page);
	await revealCollapsedAgentSessionColumn(page);
	const options = page.getByRole("button", { name: "Unlink sessions column options" });
	const start = (await options.boundingBox())!;
	const todo = (await page.locator('[data-jira-kanban-column="To do"]').boundingBox())!;
	await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
	await page.mouse.down();
	await page.mouse.move(todo.x + todo.width - 8, start.y + start.height / 2, { steps: 12 });
	await expect(page.locator("[data-session-column-drag-chip]")).toHaveCount(1);
	await expect(page.locator("[data-session-drag-overlay]")).toHaveCount(0);
	await page.mouse.up();
	const placement = page.locator("[data-session-column-placement]");
	await expect(placement).toHaveAttribute("data-session-column-placement", "1");
	await expect(page.locator("[data-session-column-drag-chip]")).toHaveCount(0);
	await options.click();
	await expect(page.getByRole("menuitem", { name: "Expand" })).toBeVisible();
	await page.keyboard.press("Escape");
	await options.focus();
	await page.keyboard.press("Alt+ArrowRight");
	await expect(placement).toHaveAttribute("data-session-column-placement", "2");
});

for (const activation of ["click", "Enter", "Space"] as const) {
	test(`the first Expand ${activation} works after dragging a collapsed session column`, async ({ page }) => {
		await openCollapsedBoard(page);
		if (await page.locator("[data-agent-session-column-hit-area]").count()) {
			await revealCollapsedAgentSessionColumn(page);
		}
		const options = page.getByRole("button", { name: "Unlink sessions column options" });
		const start = (await options.boundingBox())!;
		const progress = (await page.locator('[data-jira-kanban-column="In progress"]').boundingBox())!;
		await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
		await page.mouse.down();
		await page.mouse.move(progress.x + progress.width - 8, start.y + start.height / 2, { steps: 12 });
		await expect(page.locator("[data-session-column-drag-chip]")).toHaveCount(1);
		await page.mouse.up();
		await expect(page.locator("[data-session-column-placement]")).toHaveAttribute("data-session-column-placement", "2");
		await expect(page.locator("[data-agent-session-column-expansion]")).not.toHaveAttribute("data-agent-session-column-expansion", "expanded");
		// Hover only: a header click would clear the stale drag suppression flag.
		await options.hover();
		const expand = page.getByRole("menuitem", { name: "Expand", exact: true });
		await expect(expand).toBeVisible();
		if (activation === "click") {
			await expand.click();
		} else {
			await expand.focus();
			await page.keyboard.press(activation);
		}
		await expect(page.locator("[data-agent-session-column-expansion]")).toHaveAttribute("data-agent-session-column-expansion", "expanded");
		if (activation === "click") {
			await page.screenshot({ path: "output/agent-browser/session-column-first-expand-click.png" });
		}
	});
}

for (const [surface, url] of [
	["board", JIRA_TEAM_EU26_URL],
	["embedded preview", JIRA_TEAM_EU26_EMBEDDED_URL],
] as const) {
	test(`the ${surface} collapsed timeline responds across both edges of its rail`, async ({ page }) => {
		await page.goto(url, { waitUntil: "domcontentloaded" });
		const heading = page.getByRole("heading", { name: "Jira Design" });
		await expect(heading).toBeVisible({ timeout: 15_000 });
		const rail = page.locator("[data-agent-session-column-rail]");
		const notch = rail.locator("[data-agent-session-notch]").first();
		const flyout = page.locator('[data-slot="hover-card-content"]');
		await expect(notch).toBeVisible();
		const notchId = await notch.getAttribute("data-testid");
		expect(notchId).not.toBeNull();

		for (const edge of ["left", "right"] as const) {
			await heading.hover();
			await expect(flyout).toBeHidden();
			const railBox = await rail.boundingBox();
			const notchBox = await notch.boundingBox();
			if (!railBox || !notchBox) throw new Error("Expected the collapsed rail and notch");
			const x = edge === "left" ? railBox.x + 2 : railBox.x + railBox.width - 2;
			const y = notchBox.y + notchBox.height / 2;
			const hitId = await page.evaluate(({ x, y }) =>
				document.elementFromPoint(x, y)?.closest("[data-agent-session-notch]")?.getAttribute("data-testid"),
				{ x, y },
			);
			expect(hitId).toBe(notchId);
			await page.mouse.move(x, y);
			await expect(flyout).toBeVisible();
		}
	});
}

test("the collapsed Expand gutter target paints only its 24px column control", async ({ page }) => {
	await page.goto(JIRA_TEAM_EU26_URL, { waitUntil: "domcontentloaded" });
	await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible({ timeout: 15_000 });
	const expand = page.getByRole("button", { name: "Expand Unlink sessions column" });
	const visual = expand.locator("[data-agent-session-column-expand-visual]");
	const column = page.locator("[data-agent-session-column]");
	const separator = page.locator('[data-slot="sidebar-resize-handle"]').first();
	const todo = page.locator('[data-jira-kanban-column="To do"] > .group\\/board-column');
	await expect(expand).toBeVisible();
	const [buttonBox, columnBox, separatorBox, todoBox] = await Promise.all([
		expand.boundingBox(), column.boundingBox(), separator.boundingBox(), todo.boundingBox(),
	]);
	if (!buttonBox || !columnBox || !separatorBox || !todoBox) {
		throw new Error("Expected the collapsed control and board boundaries");
	}
	const separatorRight = separatorBox.x + separatorBox.width;
	expect(buttonBox.x).toBeLessThanOrEqual(separatorRight);
	expect(buttonBox.x + buttonBox.width).toBeLessThan(todoBox.x);
	const visualBox = await visual.boundingBox();
	if (!visualBox) throw new Error("Expected the 24px Expand visual");
	expect(visualBox.width).toBe(24);
	expect(visualBox.height).toBe(24);
	expect(visualBox.x).toBeGreaterThanOrEqual(columnBox.x);
	expect(visualBox.x + visualBox.width).toBeLessThanOrEqual(columnBox.x + columnBox.width);

	const gutterX = separatorRight + 1;
	const headerY = buttonBox.y + buttonBox.height / 2;
	await page.mouse.move(gutterX, headerY);
	expect(await expand.evaluate((node) => node.matches(":hover"))).toBe(true);
	const tooltip = page.locator('[data-slot="tooltip-content"]', { hasText: "Expand" });
	await expect(tooltip).toBeVisible();
	await expect(expand).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
	expect(await visual.evaluate((node) => getComputedStyle(node).backgroundColor))
		.not.toBe("rgba(0, 0, 0, 0)");
	const tooltipBox = await tooltip.boundingBox();
	if (!tooltipBox) throw new Error("Expected the Expand tooltip");
	expect(Math.abs(tooltipBox.x + tooltipBox.width / 2 - visualBox.x - visualBox.width / 2))
		.toBeLessThan(1.5);

	const lowerOwner = await page.evaluate(({ x, y }) =>
		document.elementFromPoint(x, y)?.closest('[data-slot="sidebar-resize-handle"]') !== null,
		{ x: gutterX, y: buttonBox.y + buttonBox.height + 20 },
	);
	expect(lowerOwner).toBe(true);
	await page.mouse.click(gutterX, headerY);
	await expect(page.locator("[data-agent-session-column-expansion]"))
		.toHaveAttribute("data-agent-session-column-expansion", "expanded");
});

test("dragging a session notch never starts a column drag", async ({ page }) => {
	await openCollapsedBoard(page);
	await revealCollapsedAgentSessionColumn(page);
	const source = page.locator("[data-agent-session-column] [data-agent-session-notch]").first();
	await source.hover();
	const box = (await source.boundingBox())!;
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2 + 4, box.y + box.height / 2 + 4);
	await expect(page.locator("[data-session-drag-overlay]")).toHaveCount(1);
	// Cross the separate 6px column threshold after the session drag starts.
	await page.mouse.move(box.x + 200, box.y + box.height / 2, { steps: 8 });
	await expect(page.locator("[data-session-column-drag-chip]")).toHaveCount(0);
	await expect(page.locator("[data-session-column-drag-source]")).toHaveCount(0);
	await expect(page.locator("[data-session-column-drop-marker]")).toHaveCount(0);
	await expect(page.locator("[data-session-column-placement]")).toHaveAttribute("data-session-column-placement", "0");
	await page.screenshot({ path: "output/agent-browser/session-drag-without-column.png" });
	await page.keyboard.press("Escape");
	await page.mouse.up();
	await expect(page.locator("[data-session-drag-overlay]")).toHaveCount(0);
	await expect(page.locator("[data-session-column-placement]")).toHaveAttribute("data-session-column-placement", "0");
});

test("compact session header drags without expanding and keeps its wider target", async ({ page }) => {
	await openCollapsedBoard(page);
	await revealCollapsedAgentSessionColumn(page);
	const expand = page.getByRole("button", { name: "Unlink sessions column options" });
	const start = await expand.boundingBox();
	const todo = await page.locator('[data-jira-kanban-column="To do"]').boundingBox();
	if (!start || !todo) throw new Error("Expected visible column headers");
	await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
	await page.mouse.down();
	await page.mouse.move(start.x + start.width / 2 + 8, start.y + start.height / 2);
	const markers = page.locator("[data-session-column-drop-marker]");
	await expect(markers).toHaveCount(5);
	const neutralMarkers = markers.locator(":scope:not([data-session-column-drop-target])");
	expect(await neutralMarkers.count()).toBeGreaterThanOrEqual(4);
	for (const line of await neutralMarkers.locator(":scope > span").all()) {
		await expect(line).toHaveClass(/bg-neutral-100/u);
		await expect(line).toHaveCSS("width", "4px");
		await expect(line).toHaveCSS("height", "64px");
	}
	const firstCardTop = (await page.locator('[data-jira-kanban-column="To do"] article').first().boundingBox())?.y;
	const firstHandleTop = (await neutralMarkers.first().locator(":scope > span").boundingBox())?.y;
	expect(firstHandleTop).toBeCloseTo(firstCardTop ?? 0, 0);
	await page.mouse.move(todo.x + todo.width - 8, start.y + start.height / 2, { steps: 12 });
	await expect(page.locator('[data-slot="tooltip-content"]')).toHaveCount(0);
	await expect(page.locator("[data-agent-session-notch]").first()).not.toBeVisible();
	const draggingButton = page.getByRole("button", { name: "Unlink sessions column options" });
	await expect(draggingButton).toHaveAttribute("data-variant", "outline");
	await expect(draggingButton).toHaveCSS("opacity", "1");
	await expect(draggingButton).toHaveCSS("border-top-style", "solid");
	await expect(draggingButton.locator("svg")).toBeVisible();
	expect(await draggingButton.evaluate((button) => getComputedStyle(button).backgroundColor)).toMatch(/^rgb\(/u);
	await page.mouse.up();
	await expect(page.locator("[data-session-column-placement]")).toHaveAttribute("data-session-column-placement", "1");
	const more = page.getByRole("button", { name: "Unlink sessions column options" });
	await expect(more).toBeVisible();
	await expect(more).toHaveAttribute("data-variant", "ghost");
	await expect(page.locator("[data-agent-session-notch]").first()).toBeVisible();
	await expect(markers).toHaveCount(0);
	await expect(page.locator("[data-agent-session-column]")).toHaveCSS("width", "32px");
	const box = await more.boundingBox();
	if (!box) throw new Error("Expected the moved expand-more target");
	expect(box.width).toBe(56);
	for (const x of [box.x + 2, box.x + box.width - 2]) {
		expect(await more.evaluate((button, point) => button.contains(document.elementFromPoint(point.x, point.y)), { x, y: box.y + box.height / 2 })).toBe(true);
	}
	await more.focus();
	await page.keyboard.press("Alt+Home");
	await expect(page.locator("[data-session-column-placement]")).toHaveAttribute("data-session-column-placement", "0");
});

test("keyboard movement reveals the last slot on a narrow board with reduced motion", async ({ page }) => {
	await page.setViewportSize({ width: 900, height: 760 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await openBoard(page);
	const handle = page.getByRole("button", { name: "Move Unlink sessions column" });
	await handle.focus();
	await page.keyboard.press("End");
	await expect(page.locator("[data-session-column-placement]")).toHaveAttribute("data-session-column-placement", "4");
	await expect(handle).toBeInViewport();
	await expect.poll(async () => {
		const [sessions, done] = await Promise.all([
			page.locator("[data-agent-session-column]").boundingBox(),
			page.locator('[data-jira-kanban-column="Done"]').boundingBox(),
		]);
		return Boolean(sessions && done && sessions.x >= done.x + done.width);
	}).toBe(true);
	await page.keyboard.press("Home");
	await expect(page.locator("[data-session-column-placement]")).toHaveAttribute("data-session-column-placement", "0");
	await expect(handle).toBeInViewport();
});

test("nearby column gaps grow blue and return to subtle lines as the drag moves away", async ({ page }) => {
	await openCollapsedBoard(page);
	await revealCollapsedAgentSessionColumn(page);
	const expand = page.getByRole("button", { name: "Unlink sessions column options" });
	await expand.hover();
	const start = await expand.boundingBox();
	if (!start) throw new Error("Expected the compact header");
	const y = start.y + start.height / 2;
	await page.mouse.move(start.x + start.width / 2, y);
	await page.mouse.down();
	await page.mouse.move(start.x + start.width / 2 + 10, y);
	const gap = page.locator('[data-session-column-drop-marker="1"]');
	const line = gap.locator(":scope > span");
	await expect(line).toBeVisible();
	const neutralColor = await line.evaluate((element) => getComputedStyle(element).backgroundColor);
	const gapBox = await gap.boundingBox();
	if (!gapBox) throw new Error("Expected the first insertion gap");
	await page.mouse.move(gapBox.x - 96, y, { steps: 10 });
	await expect(gap).toHaveAttribute("data-session-column-drop-target", "true");
	await expect.poll(async () => (await line.boundingBox())?.width ?? 0).toBe(2);
	await expect.poll(async () => (await line.boundingBox())?.height ?? 0).toBeCloseTo(gapBox.height, 0);
	await expect(line).not.toHaveCSS("background-color", neutralColor);
	await expect(line).toHaveCSS("transition-property", "top, height, width, background-color, border-radius");
	const todo = await page.locator('[data-jira-kanban-column="To do"]').boundingBox();
	if (!todo) throw new Error("Expected To do");
	await page.mouse.move(todo.x + todo.width / 2, y, { steps: 10 });
	await expect(page.locator("[data-session-column-drop-target]")).toHaveCount(0);
	await expect.poll(async () => (await line.boundingBox())?.width ?? 0).toBe(4);
	await expect.poll(async () => (await line.boundingBox())?.height ?? 0).toBe(64);
	await expect(line).toHaveCSS("background-color", neutralColor);
	await page.keyboard.press("Escape");
	await page.mouse.up();
});

test("the collapsed options menu offers Pin and Expand", async ({ page }) => {
	await page.goto(JIRA_TEAM_EU26_EMBEDDED_URL, { waitUntil: "domcontentloaded" });
	await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible({ timeout: 15_000 });
	await revealCollapsedAgentSessionColumn(page);
	const options = page.getByRole("button", { name: "Unlink sessions column options" });
	await options.hover();
	await expect(options.locator('[data-agent-session-column-options-glyph="drag-handle"]')).toBeVisible();
	await expect(page.getByRole("menuitem", { name: "Pin" })).toBeVisible();
	await expect(page.getByRole("menuitem", { name: "Expand" })).toBeVisible();
	await page.keyboard.press("Escape");
	await page.getByRole("heading", { name: "Jira Design" }).hover();
	await expect(page.getByRole("menuitem", { name: "Expand" })).toHaveCount(0);
});

test("the hover-open collapsed menu keeps timeline notches inert across its safezone", async ({ page }) => {
	await openCollapsedBoard(page);
	if (await page.locator("[data-agent-session-column-hit-area]").count() > 0) {
		await revealCollapsedAgentSessionColumn(page);
	}
	const column = page.locator("[data-agent-session-column]");
	const options = page.getByRole("button", { name: "Unlink sessions column options" });
	const first = column.locator("[data-agent-session-notch]").first();
	const menu = page.getByRole("menu", { name: "Unlink sessions column options" });

	await options.hover();
	await expect(menu).toBeVisible();
	const optionsBox = (await options.boundingBox())!;
	const firstBox = (await first.boundingBox())!;
	const menuBox = (await menu.boundingBox())!;
	const crossingY = firstBox.y + firstBox.height / 2;

	await page.mouse.move(menuBox.x + 8, crossingY);
	await page.mouse.move(firstBox.x + firstBox.width - 8, crossingY);
	await page.waitForTimeout(400);
	await expect(page.locator('[data-slot="hover-card-content"]')).toBeHidden();
	await page.mouse.move(optionsBox.x + optionsBox.width / 2, optionsBox.y + optionsBox.height / 2);

	await expect(menu).toBeVisible();
});

test("scrolling the session column dismisses the active flyout", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await openBoard(page);
	const column = page.locator("[data-agent-session-column]");
	const row = column.locator('[data-slot="hover-card-trigger"]:visible').first();
	const rowBox = await row.boundingBox();
	expect(rowBox).not.toBeNull();
	if (!rowBox) return;
	await page.mouse.move(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2);
	const popup = page.locator('[data-slot="hover-card-content"]');
	await expect(popup).toBeVisible();
	const scrollport = column.locator("[data-agent-session-column-scrollport]");
	await page.mouse.wheel(0, 450);
	await expect.poll(() => scrollport.evaluate((element) => element.scrollTop)).toBeGreaterThan(200);
	await expect(popup).toHaveCount(0);

	// Continued wheel input must not let passing rows reopen a floating preview.
	const scrollEnded = scrollport.evaluate((element) => new Promise<void>((resolve) => {
		element.addEventListener("scrollend", () => resolve(), { once: true });
	}));
	await page.mouse.wheel(0, 450);
	await expect.poll(() => scrollport.evaluate((element) => element.scrollTop)).toBeGreaterThan(500);
	await scrollEnded;
	await expect(popup).toHaveCount(0);

	await page.getByRole("heading", { name: "Jira Design" }).hover();
	const scrollportBox = await scrollport.boundingBox();
	expect(scrollportBox).not.toBeNull();
	if (!scrollportBox) return;
	await page.mouse.move(
		scrollportBox.x + scrollportBox.width / 2,
		scrollportBox.y + scrollportBox.height / 2,
	);
	await expect(popup).toBeVisible();
	await popup.hover();
	await expect(popup).toBeVisible();
	await page.getByRole("heading", { name: "Jira Design" }).hover();
	await expect(popup).toHaveCount(0);
});

test("wheel input over a session host tooltip scrolls the session column", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await openBoard(page);
	const column = page.locator("[data-agent-session-column]");
	const scrollport = column.locator("[data-agent-session-column-scrollport]");
	const hostIcon = column.getByRole("img", { name: "Local session" }).first();

	await hostIcon.hover();
	const tooltip = page.locator('[data-slot="tooltip-content"]', {
		hasText: "Local session",
	});
	await expect(tooltip).toBeVisible();
	await expect.poll(() => tooltip.evaluate((element) => Number(getComputedStyle(element).opacity))).toBe(1);
	const tooltipBox = await tooltip.boundingBox();
	expect(tooltipBox).not.toBeNull();
	if (!tooltipBox) return;
	await page.mouse.move(tooltipBox.x + tooltipBox.width / 2, tooltipBox.y + tooltipBox.height / 2);
	await page.mouse.wheel(0, 450);

	await expect.poll(() => scrollport.evaluate((element) => element.scrollTop)).toBeGreaterThan(200);
});

test("the work-item type menu is anchored on its first open", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(JIRA_TEAM_EU26_URL, { waitUntil: "domcontentloaded" });
	await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible({
		timeout: 15_000,
	});
	const columnOptions = page.getByRole("button", { name: "Unlink sessions column options" });
	if (await columnOptions.isVisible()) {
		await columnOptions.click();
		await page.getByRole("menuitem", { name: "Expand" }).click();
	}
	const row = page.getByTestId("agent-session-row-lw-scope-thread");
	await expect(row).toBeVisible();
	await row.hover();
	await row.getByRole("button", { name: /^More actions for/u }).click();
	await page.getByRole("menuitem", { name: "Link work item Open submenu" }).click();
	await page.getByRole("tab", { name: "Create new" }).click();

	const trigger = page.locator('[aria-label="Work item type: Task"]');
	const triggerBox = await trigger.boundingBox();
	if (!triggerBox) throw new Error("Expected the work-item type trigger");
	expect(triggerBox.width).toBeLessThanOrEqual(48);
	await trigger.click();

	const task = page.getByRole("menuitemradio", { name: /^task Task$/u });
	await expect(task).toBeVisible();
	const popup = task.locator('xpath=ancestor::*[@data-slot="dropdown-menu-sub-content"][1]');
	await popup.evaluate(async (element) => {
		await Promise.all(element.getAnimations().map((animation) => animation.finished));
	});
	const popupBox = await popup.boundingBox();
	if (!popupBox) throw new Error("Expected the work-item type menu");
	expect(popupBox.x).toBeCloseTo(triggerBox.x, 0);
	const verticalGap = popupBox.y >= triggerBox.y + triggerBox.height
		? popupBox.y - (triggerBox.y + triggerBox.height)
		: triggerBox.y - (popupBox.y + popupBox.height);
	expect(verticalGap).toBeGreaterThanOrEqual(0);
	expect(verticalGap).toBeLessThanOrEqual(8);

	await page.keyboard.press("Escape");
	await expect(task).toHaveCount(0);
	await expect(page.getByRole("tab", { name: "Create new" })).toBeVisible();
});
