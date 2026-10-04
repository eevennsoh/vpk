import { expect, test, type Page } from "@playwright/test";

import { resolveAppOrigin } from "@/tests/helpers/origin";

const origin = resolveAppOrigin();
test.use({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });

type SparkleProbe = { readyAt: number; staticAt: number; waveEndAt: number; waveObserved: boolean };
declare global {
	interface Window { autoArrangeSparkleProbe?: SparkleProbe; }
}

async function toggleAutoArrange(page: Page) {
	await page.getByRole("button", { name: "Settings", exact: true }).click();
	await page.getByRole("menuitemcheckbox", { name: "Auto arrange", exact: true }).click();
	await page.keyboard.press("Escape");
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`Auto arrange and Peel visual are opt-in through Settings (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${origin}/jira-team-eu26`);
		await page.getByRole("button", { name: "Settings", exact: true }).click();
		await expect(page.getByRole("menuitemcheckbox", { name: "Auto arrange", exact: true })).toHaveAttribute("aria-checked", "false");
		await expect(page.getByRole("menuitemcheckbox", { name: "Peel visual", exact: true })).toHaveAttribute("aria-checked", "false");
		await page.keyboard.press("Escape");

		const card = (code: string) => page.locator(`[data-issue-key="${code}"] [draggable]`).first();
		const action = page.getByRole("button", { name: /^(Preparing auto arrange|Auto arrange)$/u });
		await card("PAY-118").click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await card("PAY-124").click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await expect(page.getByRole("region", { name: "2 cards selected. Bulk actions available." })).toBeVisible();
		await expect(action).toHaveCount(0);
		await expect(page.locator("[data-auto-arrange-count]")).toHaveCount(0);
		await page.keyboard.press("a");
		await expect(page.locator('[data-jira-kanban-column="To do"] [data-issue-key]')).toHaveCount(4);
		await page.screenshot({ path: `output/agent-browser/auto-arrange/off-selection-${reducedMotion}.png` });

		await toggleAutoArrange(page);
		await card("PAY-118").click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await card("PAY-124").click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await expect(action).toBeEnabled();
		await expect(page.locator("[data-auto-arrange-count]")).not.toHaveCount(0);
		await toggleAutoArrange(page);
		await expect(action).toHaveCount(0);
		await expect(page.locator("[data-auto-arrange-count]")).toHaveCount(0);
		await card("PAY-118").click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await expect(action).toHaveCount(0);
		await page.keyboard.press("Escape");

		// With arrange off, the board retains its native manual drag transaction.
		const transfer = await page.evaluateHandle(() => new DataTransfer());
		await card("PAY-118").dispatchEvent("dragstart", { dataTransfer: transfer });
		await expect(page.getByText("Transition to...", { exact: true })).toBeVisible();
		await expect(action).toHaveCount(0);
		await expect(page.locator("[data-auto-arrange-count]")).toHaveCount(0);
		await page.screenshot({ path: `output/agent-browser/auto-arrange/off-drag-${reducedMotion}.png` });
		await card("PAY-118").dispatchEvent("dragend", { dataTransfer: transfer });
		await expect(page.getByText("Transition to...", { exact: true })).toHaveCount(0);
		await expect(page.locator('[data-jira-kanban-column="To do"] [data-issue-key="PAY-118"]')).toHaveCount(1);

		await toggleAutoArrange(page);
		await page.getByRole("button", { name: "Settings", exact: true }).click();
		await page.getByRole("menuitemcheckbox", { name: "Peel visual", exact: true }).click();
		await page.keyboard.press("Escape");
		await page.reload();
		await page.getByRole("button", { name: "Settings", exact: true }).click();
		await expect(page.getByRole("menuitemcheckbox", { name: "Auto arrange", exact: true })).toHaveAttribute("aria-checked", "true");
		await expect(page.getByRole("menuitemcheckbox", { name: "Peel visual", exact: true })).toHaveAttribute("aria-checked", "true");
	});

	test(`Auto arrange works with Move visual off (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${origin}/jira-team-eu26`);
		await page.getByRole("button", { name: "Settings", exact: true }).click();
		await page.getByRole("menuitemcheckbox", { name: "Move visual", exact: true }).click();
		await page.keyboard.press("Escape");
		await toggleAutoArrange(page);
		const card = page.locator('[data-issue-key="PAY-118"] [draggable]').first();
		await card.click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		const action = page.getByRole("button", { name: "Auto arrange", exact: true });
		await expect(action).toBeEnabled();
		await expect(page.locator("[data-auto-arrange-count]")).not.toHaveCount(0);
		const box = (await card.boundingBox())!;
		await page.mouse.move(box.x + 70, box.y + 30);
		await page.mouse.down();
		await page.mouse.move(box.x + 95, box.y + 40, { steps: 5 });
		await expect(page.locator("[data-issue-cohort-preview]")).toBeVisible();
		await expect(action).toBeEnabled();
		await page.keyboard.press("a");
		await page.mouse.up();
		await expect(page.locator("[data-issue-cohort-preview]")).toHaveCount(0);
		await expect(page.locator('[data-jira-kanban-column="To do"] [data-issue-key="PAY-118"]')).toHaveCount(0);
		await expect(page.locator('[data-board-agent-session-drop-zone="issue"][data-issue-key="PAY-118"]')).toHaveCount(1);
	});

}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`checkbox pointer movement toggles selection without picking up its card (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${origin}/jira-team-eu26`);
		await toggleAutoArrange(page);
		const card = (code: string) => page.locator(`[data-issue-key="${code}"] [draggable]`).first();
		await card("PAY-118").click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		const checkbox = page.getByRole("checkbox", { name: "Select PAY-124", exact: true });
		await expect(checkbox).not.toBeChecked();
		const bounds = (await checkbox.boundingBox())!;
		await page.mouse.move(bounds.x + 3, bounds.y + bounds.height / 2);
		await page.mouse.down();
		await expect(checkbox).toBeFocused();
		await expect(card("PAY-124")).toHaveAttribute("draggable", "true");
		await page.mouse.move(bounds.x + 11, bounds.y + bounds.height / 2, { steps: 4 });
		await expect(card("PAY-124")).not.toHaveAttribute("data-dragging", "true");
		await page.mouse.up();
		await expect(checkbox).toBeChecked();
		await expect(checkbox).toBeFocused();
		await expect(page.getByRole("checkbox", { name: "Select PAY-118", exact: true })).toBeChecked();
		await expect(page.locator('[data-jira-kanban-column="To do"] [data-issue-key="PAY-124"]')).toHaveCount(1);
		await page.screenshot({ path: `output/agent-browser/auto-arrange/checkbox-pointer-${reducedMotion}.png` });
	});

	for (const shortcut of ["a"] as const) {
		test(`auto arrange works after Select all retains focus (${shortcut}, ${reducedMotion})`, async ({ page }) => {
			await page.emulateMedia({ reducedMotion });
			await page.goto(`${origin}/jira-team-eu26`);
			await toggleAutoArrange(page);
			const sourceColumn = page.locator('[data-jira-kanban-column="To do"]');
			const sourceCards = sourceColumn.locator('[data-board-agent-session-drop-zone="issue"]');
			await expect(sourceCards.first()).toBeVisible();
			const codes = await sourceCards.evaluateAll(nodes => nodes.map(node => node.getAttribute("data-issue-key")!));
			await page.locator('[data-issue-key="PAY-118"] [draggable]').first().click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
			const selectAll = page.getByRole("button", { name: "Select all", exact: true });
			await selectAll.click();
			await expect(selectAll).toBeFocused();
			const action = page.getByRole("button", { name: "Auto arrange", exact: true });
			await expect(action).toBeEnabled();
			await expect(action).toHaveAttribute("aria-keyshortcuts", "a");
			await expect(action.locator('[data-slot="kbd"]')).toHaveText("A");
			for (const nativeShortcut of ["Enter", "Space", "Meta+Enter", "Control+Enter", "Control+a"]) {
				await page.keyboard.press(nativeShortcut);
				await expect(sourceCards).toHaveCount(codes.length);
			}
			await expect(selectAll).toBeFocused();
			await expect(sourceCards).toHaveCount(codes.length);
			await page.screenshot({ path: `output/agent-browser/auto-arrange/select-all-${shortcut.replace("+", "-")}-${reducedMotion}.png` });
			await page.keyboard.press(shortcut);
			for (const code of codes) {
				await expect(sourceColumn.locator(`[data-issue-key="${code}"]`)).toHaveCount(0);
				await expect(page.locator(`[data-board-agent-session-drop-zone="issue"][data-issue-key="${code}"]`)).toHaveCount(1);
			}
		});
	}

	test(`single-card movement shows the Auto arrange toolbar and keeps A available (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.setViewportSize({ width: reducedMotion === "reduce" ? 1440 : 1800, height: 1100 });
		await page.goto(`${origin}/jira-team-eu26`);
		await toggleAutoArrange(page);
		const card = page.locator('[data-issue-key="PAY-118"] [draggable]').first();
		await expect(card).toBeVisible();
		await expect(page.locator('[data-slot="jira-toolbar-positioner"]')).toHaveCount(0);
		const source = (await card.boundingBox())!;
		await page.mouse.move(source.x + 70, source.y + 30);
		await page.mouse.down();
		await page.mouse.move(source.x + 95, source.y + 40, { steps: 5 });
		await expect(page.locator('[data-issue-cohort-preview]')).toBeVisible();
		const toolbar = page.getByRole("region", { name: "Move card. Auto arrange available.", exact: true });
		await expect(toolbar).toBeVisible();
		await expect(toolbar.getByRole("button", { name: "Auto arrange", exact: true })).toBeEnabled();
		await expect(toolbar.getByRole("button")).toHaveCount(1);
		await expect(page.locator('[data-auto-arrange-count]')).not.toHaveCount(0);
		await page.keyboard.press("Enter");
		await expect(page.locator('[data-issue-cohort-preview]')).toBeVisible();
		await expect(toolbar).toBeVisible();
		await page.screenshot({ path: `output/agent-browser/auto-arrange/single-card-${reducedMotion}.png` });
		await page.keyboard.press("a");
		await page.mouse.up();
		await expect(page.locator('[data-issue-cohort-preview]')).toHaveCount(0);
		await expect(page.locator('[data-jira-kanban-column="To do"] [data-issue-key="PAY-118"]')).toHaveCount(0);
		await expect(page.locator('[data-board-agent-session-drop-zone="issue"][data-issue-key="PAY-118"]')).toHaveCount(1);
		await expect(page.locator('[data-slot="jira-toolbar-positioner"]')).toHaveCount(0);
	});

	test(`board search keeps A from arranging the ready selection (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${origin}/jira-team-eu26`);
		await toggleAutoArrange(page);
		const sourceCards = page.locator('[data-jira-kanban-column="To do"] [data-board-agent-session-drop-zone="issue"]');
		await page.locator('[data-issue-key="PAY-118"] [draggable]').first().click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await page.getByRole("button", { name: "Select all", exact: true }).click();
		await expect(page.getByRole("button", { name: "Auto arrange", exact: true })).toBeEnabled();
		const search = page.getByRole("textbox", { name: "Search board", exact: true });
		await search.focus();
		await page.keyboard.type("a");
		await expect(search).toBeFocused();
		await expect(sourceCards).toHaveCount(4);
		await expect(page.getByRole("region", { name: "4 cards selected. Bulk actions available." })).toBeVisible();
	});

	test(`auto arrange matches toolbar size and settles its detection sparkle (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${origin}/jira-team-eu26`);
		await toggleAutoArrange(page);
		if (reducedMotion === "no-preference") {
			await page.evaluate(() => {
				const probe: SparkleProbe = { readyAt: 0, staticAt: 0, waveEndAt: 0, waveObserved: false };
				window.autoArrangeSparkleProbe = probe;
				const sample = (now: number) => {
					const symbol = document.querySelector('[data-auto-arrange-sparkle-phase]');
					const phase = symbol?.getAttribute("data-auto-arrange-sparkle-phase");
					if (phase === "playing" && !probe.readyAt) probe.readyAt = now;
					if (phase === "static" && probe.readyAt && !probe.staticAt) probe.staticAt = now;
					const wave = document.querySelector("[data-auto-arrange-shimmer]");
					const running = wave ? [...wave.querySelectorAll('[aria-hidden="true"]')].some(node => parseFloat(getComputedStyle(node).opacity) > 0.001) : false;
					if (running) probe.waveObserved = true;
					if (probe.waveObserved && !running && !probe.waveEndAt) probe.waveEndAt = now;
					if (!probe.staticAt || !probe.waveEndAt) requestAnimationFrame(sample);
				};
				requestAnimationFrame(sample);
			});
		}
		const card = page.locator('[data-issue-key="PAY-118"] [draggable]').first();
		await card.click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		const action = page.getByRole("button", { name: /^(Preparing auto arrange|Auto arrange)$/u });
		const selectAll = page.getByRole("button", { name: "Select all", exact: true });
		await expect(action).toBeDisabled();
		await expect(action).toHaveCSS("height", "32px");
		await expect(selectAll).toHaveCSS("height", "32px");
		await expect(action).toBeEnabled();
		const animated = action.locator('[data-slot="animated-icon"]');
		await expect(animated).toHaveCount(1);
		const mountedIcon = await animated.elementHandle();
		if (reducedMotion === "no-preference") {
			await expect(animated).toHaveCount(1);
			await expect(animated.locator("foreignObject")).toHaveCount(1);
			await expect.poll(() => animated.locator("svg > g").first().evaluate((node) => getComputedStyle(node).transform)).not.toBe("none");
			// Capture screenshots after the timing window so rendering does not skew it.
		}
		await expect(action.locator("[data-auto-arrange-sparkle-phase]")).toHaveAttribute("data-auto-arrange-sparkle-phase", "static");
		expect(await animated.evaluate((node, mounted) => node === mounted, mountedIcon)).toBe(true);
		if (reducedMotion === "no-preference") {
			await expect.poll(() => page.evaluate(() => window.autoArrangeSparkleProbe?.waveEndAt ?? 0)).toBeGreaterThan(0);
			const probe = await page.evaluate(() => window.autoArrangeSparkleProbe!);
			await test.info().attach("sparkle-shimmer-timing", { body: JSON.stringify(probe), contentType: "application/json" });
			console.log("Auto arrange motion:", JSON.stringify({ durationMs: probe.staticAt - probe.readyAt, finishGapMs: Math.abs(probe.staticAt - probe.waveEndAt) }));
			expect(Math.abs(probe.staticAt - probe.waveEndAt)).toBeLessThanOrEqual(50);
			expect(probe.staticAt - probe.readyAt).toBeGreaterThan(1150);
			expect(probe.staticAt - probe.readyAt).toBeLessThan(1500);
		}
		const sparkle = animated.locator("svg");
		await expect(sparkle).toHaveCSS("width", "12px");
		await expect(sparkle).toHaveCSS("height", "12px");
		await expect(sparkle.locator(":scope > g").first()).toHaveCSS("transform", "none");
		await expect(sparkle.locator(":scope > g > path").first()).toHaveCSS("opacity", "1");
		await expect(sparkle.locator(":scope > g > g")).toHaveCSS("opacity", "0");
		const peerIcon = selectAll.locator("svg");
		await expect(sparkle).toHaveCSS("width", await peerIcon.evaluate(node => getComputedStyle(node).width));
		await expect(sparkle.locator(":scope > g > path").first()).toHaveCSS("fill", await peerIcon.evaluate(node => getComputedStyle(node).color));
		await expect(action.locator('[data-auto-arrange-static-sparkle]')).toHaveCount(0);
		await expect(action).toHaveCSS("height", "32px");
		await action.hover();
		await expect(animated).toHaveCount(1);
		await expect(sparkle.locator(":scope > g").first()).toHaveCSS("transform", "none");
		await page.screenshot({ path: `output/agent-browser/auto-arrange/settled-${reducedMotion}.png` });
		if (reducedMotion === "reduce") {
			await action.focus();
			await page.keyboard.press("Enter");
		} else {
			await action.click();
		}
		await expect(page.locator('[data-jira-kanban-column="To do"] [data-issue-key="PAY-118"]')).toHaveCount(0);
		await expect(page.locator('[data-issue-key="PAY-118"]')).toHaveCount(1);
	});
}
