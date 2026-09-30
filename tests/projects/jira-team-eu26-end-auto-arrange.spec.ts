import { expect, test } from "@playwright/test";

import { withDesignVariants } from "@/tests/helpers/design-variants";
import { appUrl } from "@/tests/helpers/origin";

// Bulk-drag tests run with Auto arrange off (no toolbar button); the rest drive that button.
const AUTO_ARRANGE_BOARD_ROUTE = withDesignVariants("/jira-team-eu26-end", { autoArrange: true });
const MANUAL_ARRANGE_BOARD_ROUTE = withDesignVariants("/jira-team-eu26-end", { autoArrange: false });
test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

test("Done keeps its scrollbar outside the shader and excludes it from the shader print", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 720 });
	await page.addInitScript(() => {
		const counts: number[] = [];
		Object.assign(window, { finaleColumnScrollbarCopies: counts });
		new MutationObserver(records => {
			for (const record of records) for (const node of record.addedNodes) {
				if (!(node instanceof HTMLElement) || node.style.left !== "-30000px") continue;
				const column = node.querySelector('[data-jira-kanban-column="Done"]');
				if (column) counts.push(column.querySelectorAll('[data-slot="scroll-area-scrollbar"]').length);
			}
		}).observe(document, { childList: true, subtree: true });
	});
	await page.goto(appUrl(AUTO_ARRANGE_BOARD_ROUTE), { waitUntil: "networkidle" });
	for (const code of ["TEU-1", "TEU-2", "TEU-3"]) {
		await page.locator(`[data-issue-key="${code}"] [draggable]`).first().click({ modifiers: ["Meta"] });
	}
	await page.getByRole("button", { name: "Auto arrange", exact: true }).click();
	const done = page.locator('[data-jira-kanban-column="Done"]');
	const viewport = done.locator("[data-jira-kanban-card-list]");
	const scrollbar = done.locator('[data-slot="scroll-area-scrollbar"]');
	await expect(done.locator("[data-issue-key]")).toHaveCount(3);
	await viewport.hover();
	await expect(scrollbar).toHaveCSS("opacity", "1");
	await expect(scrollbar).toHaveCSS("visibility", "visible");
	await page.evaluate(() => (window as typeof window & { __jiraTeamEu26Finale: { hold: (time: number) => void } }).__jiraTeamEu26Finale.hold(0.3));
	const finale = page.locator("[data-jira-team-eu26-end-finale]");
	await expect(finale).toBeVisible({ timeout: 15000 });
	await expect(scrollbar).toHaveCSS("visibility", "hidden");
	await expect.poll(() => page.evaluate(() => (window as typeof window & { finaleColumnScrollbarCopies: number[] }).finaleColumnScrollbarCopies.length)).toBeGreaterThan(0);
	expect(await page.evaluate(() => (window as typeof window & { finaleColumnScrollbarCopies: number[] }).finaleColumnScrollbarCopies)).toEqual([0]);
	await page.screenshot({ path: "output/agent-browser/done-scrollbar/shader-only.png" });
	await page.keyboard.press("Escape");
	await expect(finale).toHaveCount(0);
	await viewport.hover();
	await expect(scrollbar).toHaveCSS("visibility", "visible");
	await expect(scrollbar).toHaveCSS("opacity", "1");
});

test("auto arrange unfolds full-size issue cards in their committed slots", async ({ page }) => {
	await page.addInitScript(() => {
		const samples: { code: string; width: number; height: number }[] = [];
		Object.assign(window, { fullSizeIssueDrops: samples });
		const animate = Element.prototype.animate;
		Element.prototype.animate = function (frames, options) {
			if (this.closest("[data-issue-drop-trace]")) {
				for (const node of document.querySelectorAll('[data-jira-kanban-column="Done"] [data-slot="jira-issue-card"]')) {
					const { width, height } = node.getBoundingClientRect();
					samples.push({ code: node.closest('[data-issue-key]')!.getAttribute("data-issue-key")!, width, height });
				}
			}
			return animate.call(this, frames, options);
		};
	});
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl(AUTO_ARRANGE_BOARD_ROUTE), { waitUntil: "networkidle" });
	const codes = ["TEU-1", "TEU-2", "TEU-3"];
	const expected = await page.locator('[data-jira-kanban-column="Context"] [data-slot="jira-issue-card"]').evaluateAll(nodes => nodes.map(node => {
		const { width, height } = node.getBoundingClientRect();
		return { code: node.closest('[data-issue-key]')!.getAttribute("data-issue-key")!, width, height };
	}));
	for (const code of codes) await page.locator(`[data-issue-key="${code}"] [draggable]`).first().click({ modifiers: ["Meta"] });
	await expect(page.locator('[data-issue-key="TEU-1"] [data-slot="jira-issue-cover"]')).toHaveCSS("clip-path", "inset(4px 4px 0px round 7px 7px 0px 0px)");
	await page.getByRole("button", { name: "Auto arrange", exact: true }).click();
	const done = page.locator('[data-jira-kanban-column="Done"]');
	await expect(done.locator("[data-issue-key]")).toHaveCount(codes.length);
	// Auto arrange may scroll the destination, which deliberately cancels its
	// decoration. Capture geometry when the drop effect starts, before that scroll.
	const cards = await page.evaluate(() => (window as typeof window & { fullSizeIssueDrops: { code: string; width: number; height: number }[] }).fullSizeIssueDrops);
	expect(cards.map(card => card.code)).toEqual(codes);
	for (const card of cards) {
		const source = expected.find(source => source.code === card.code)!;
		expect(card.width).toBeCloseTo(source.width, 1);
		expect(card.height).toBeCloseTo(source.height, 1);
	}
	await expect(page.locator("[data-issue-drop-flight]")).toHaveCount(0);
	await expect(page.locator("[data-issue-drop-trace]")).toHaveCount(0);
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`keynote auto arrange sends all work items to Done (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl(AUTO_ARRANGE_BOARD_ROUTE));
		await page.getByRole("button", { name: "Create in Context", exact: true }).click();
		const name = page.getByRole("textbox", { name: "Name this work item", exact: true });
		await name.fill("New keynote item");
		await name.press("Enter");
		await expect(page.locator('[data-jira-kanban-scrollport] [data-issue-key]')).toHaveCount(14);
		await page.locator('[data-issue-key="TEU-1"] [draggable]').first().click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		// Opposite outer corners span all columns before the scoped toolbar expansion.
		await page.locator('[data-issue-key="TEU-13"] [draggable]').first().click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await page.getByRole("button", { name: "Select all", exact: true }).click();
		const arrange = page.getByRole("button", { name: "Auto arrange", exact: true });
		await expect(arrange).toBeEnabled();
		await expect(page.locator('[data-jira-kanban-column="Done"] [data-auto-arrange-count]')).toHaveAttribute("data-auto-arrange-count", "14");
		await arrange.click();
		const done = page.locator('[data-jira-kanban-column="Done"]');
		await expect(done.locator("[data-issue-key]")).toHaveCount(14);
		for (const title of ["Context", "Collaboration", "Confidence"]) {
			await expect(page.locator(`[data-jira-kanban-column="${title}"] [data-issue-key]`)).toHaveCount(0);
		}
		await expect(done.getByText("New keynote item", { exact: true })).toBeVisible();
		await expect(page.locator("[data-issue-drop-flight]")).toHaveCount(0);
		await expect(arrange).toHaveCount(0);
		await page.screenshot({ path: `output/agent-browser/keynote-auto-arrange/done-${reducedMotion}.png` });
	});
}

for (const { reducedMotion, width, height } of [1800, 1024].flatMap(width => (["no-preference", "reduce"] as const).map(reducedMotion => ({ reducedMotion, width, height: width === 1800 ? 1100 : 768 })))) {
	test(`bulk drag traces visible Done cards before the finale (${reducedMotion}, ${width}px)`, async ({ page }, testInfo) => {
		await page.setViewportSize({ width, height });
		await page.addInitScript(() => {
			const probe = { traceAt: 0, traceFinishedAt: 0, traceCancelledAt: 0, confettiAt: 0, confettiFinishedAt: 0, confettiBursts: 0, confetti: {} as Record<string, unknown>, finaleAt: 0, outlines: 0, visibleCards: 0, duration: 0 };
			Object.assign(window, { keynoteDropProbe: probe });
			const animate = Element.prototype.animate;
			Element.prototype.animate = function (frames, options) {
				const animation = animate.call(this, frames, options);
				const trace = this.closest('[data-issue-drop-trace][data-board-column-title="Done"]');
				if (trace) {
					probe.traceAt = performance.now();
					probe.outlines = trace.querySelectorAll("rect[stroke]").length;
					probe.duration = Number(animation.effect!.getTiming().duration);
					const list = document.querySelector('[data-jira-kanban-column="Done"] [data-jira-kanban-card-list]')!;
					const clip = list.getBoundingClientRect();
					probe.visibleCards = [...list.querySelectorAll('[data-slot="jira-issue-surface"]')].filter(node => {
						const rect = node.getBoundingClientRect();
						return rect.bottom > Math.max(0, clip.top) && rect.top < Math.min(innerHeight, clip.bottom);
					}).length;
					animation.addEventListener("finish", () => { probe.traceFinishedAt = performance.now(); });
					animation.addEventListener("cancel", () => { probe.traceCancelledAt = performance.now(); });
				}
				return animation;
			};
			new MutationObserver(records => {
				for (const record of records) {
					for (const node of record.addedNodes) if (node instanceof HTMLElement && node.hasAttribute("data-finale-confetti")) {
						probe.confettiAt = performance.now();
						probe.confettiBursts++;
						// Capture the brief burst at insertion, before rasterisation or
						// test-driver round trips can consume its 1.2-second lifetime.
						probe.confetti = {
							ariaHidden: node.getAttribute("aria-hidden"),
							inert: node.inert,
							pointerEvents: getComputedStyle(node).pointerEvents,
							left: node.querySelectorAll('[data-confetti-corner="left"]').length,
							right: node.querySelectorAll('[data-confetti-corner="right"]').length,
							colors: [...new Set([...node.querySelectorAll<HTMLElement>("[data-confetti-corner]")].map(piece => piece.style.backgroundColor))].sort(),
						};
					}
					for (const node of record.removedNodes) if (node instanceof HTMLElement && node.hasAttribute("data-finale-confetti")) probe.confettiFinishedAt = performance.now();
				}
				if (!probe.finaleAt && document.querySelector("[data-jira-team-eu26-end-finale]")) probe.finaleAt = performance.now();
			}).observe(document, { childList: true, subtree: true });
		});
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl(MANUAL_ARRANGE_BOARD_ROUTE), { waitUntil: "networkidle" });
		const card = (code: string) => page.locator(`[data-issue-key="${code}"] [draggable]`).first();
		await card("TEU-1").click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await card("TEU-13").click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await page.getByRole("button", { name: "Select all", exact: true }).click();
		await expect(page.locator('[data-jira-issue-activation-control][aria-pressed="true"]')).toHaveCount(13);
		await expect(page.getByRole("button", { name: "Auto arrange", exact: true })).toHaveCount(0);
		await page.keyboard.press("a");
		await expect(page.locator('[data-jira-kanban-column="Done"] [data-issue-key]')).toHaveCount(0);
		await card("TEU-1").scrollIntoViewIfNeeded();
		if (width === 1024) await page.locator('[data-jira-kanban-column="Done"]').scrollIntoViewIfNeeded();
		const source = (await card("TEU-1").boundingBox())!;
		const done = (await page.locator('[data-jira-kanban-column="Done"]').boundingBox())!;
		const board = (await page.locator('[data-jira-kanban-scrollport]').boundingBox())!;
		const grabX = width === 1024 ? Math.max(board.x + 16, source.x + source.width - 50) : source.x + 70;
		const grabY = source.y + (width === 1024 ? 70 : 30);
		await page.mouse.move(grabX, grabY);
		await page.mouse.down();
		await page.mouse.move(grabX + 8, grabY + 10, { steps: 5 });
		await page.mouse.move(done.x + done.width / 2, done.y + 60, { steps: 5 });
		await page.mouse.up();
		await expect(page.locator('[data-jira-kanban-column="Done"] [data-issue-key]')).toHaveCount(13);
		await testInfo.attach("drop-start", { body: JSON.stringify(await page.evaluate(() => (window as typeof window & { keynoteDropProbe: unknown }).keynoteDropProbe)), contentType: "application/json" });
		if (reducedMotion === "no-preference") {
			await expect(page.locator("[data-issue-drop-trace]")).toBeVisible();
			await expect(page.locator("[data-jira-team-eu26-end-finale]")).toHaveCount(0);
			await page.screenshot({ path: `output/agent-browser/keynote-completion/bulk-green-trace-${width}.png` });
			await expect.poll(() => page.evaluate(() => (window as typeof window & { keynoteDropProbe: { confettiBursts: number } }).keynoteDropProbe.confettiBursts)).toBe(1);
			if (await page.locator("[data-finale-confetti]").count()) await page.screenshot({ path: `output/agent-browser/keynote-completion/confetti-${width}.png` });
		}
		await expect(page.locator("[data-jira-team-eu26-end-finale]")).toBeVisible({ timeout: 15000 });
		await expect(page.locator("[data-finale-confetti]")).toHaveCount(0);
		const probe = await page.evaluate(() => (window as typeof window & { keynoteDropProbe: { traceAt: number; traceFinishedAt: number; confettiAt: number; confettiFinishedAt: number; confettiBursts: number; confetti: Record<string, unknown>; finaleAt: number; outlines: number; visibleCards: number; duration: number } }).keynoteDropProbe);
		await testInfo.attach("completion-sequence", { body: JSON.stringify(probe), contentType: "application/json" });
		if (reducedMotion === "no-preference") {
			expect(probe.outlines).toBe(probe.visibleCards);
			expect(probe.outlines).toBeGreaterThan(0);
			expect(probe.outlines).toBeLessThan(13);
			expect(probe.duration).toBe(650);
			expect(probe.traceFinishedAt).toBeGreaterThan(probe.traceAt);
			expect(probe.confettiBursts).toBe(1);
			expect(probe.confetti).toEqual({ ariaHidden: "true", inert: true, pointerEvents: "none", left: 180, right: 180, colors: ["rgb(106, 154, 35)", "rgb(175, 89, 225)", "rgb(24, 104, 219)", "rgb(252, 167, 0)"] });
			expect(probe.confettiAt).toBeGreaterThanOrEqual(probe.traceFinishedAt);
			expect(probe.confettiFinishedAt - probe.confettiAt).toBeGreaterThan(1100);
			expect(probe.finaleAt).toBeGreaterThanOrEqual(probe.confettiFinishedAt);
		} else {
			expect(probe.traceAt).toBe(0);
			expect(probe.confettiBursts).toBe(0);
		}
		await page.screenshot({ path: `output/agent-browser/keynote-completion/finale-${reducedMotion}-${width}.png` });
	});
}

test("confetti launches while the shader column image is still preparing", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.addInitScript(() => {
		const probe = { pendingColumnImages: 0 };
		Object.assign(window, { confettiPrintProbe: probe });
		const decode = HTMLImageElement.prototype.decode;
		HTMLImageElement.prototype.decode = function () {
			const pending = decode.call(this);
			const host = this.closest<HTMLElement>("[inert]");
			if (!this.closest('[data-jira-kanban-column="Done"]') || host?.style.left !== "-30000px") return pending;
			probe.pendingColumnImages++;
			return pending.then(() => new Promise<void>((resolve) => window.setTimeout(() => {
				probe.pendingColumnImages--;
				resolve();
			}, 2000)));
		};
	});
	await page.goto(`${origin}/jira-team-eu26-end`, { waitUntil: "networkidle" });
	await page.getByRole("button", { name: "Settings", exact: true }).click();
	await page.getByRole("menuitem", { name: "Play closing", exact: true }).click();
	await expect(page.locator('[data-jira-kanban-column="Done"] [data-issue-key]')).toHaveCount(13);
	await expect.poll(() => page.evaluate(() => (window as typeof window & { confettiPrintProbe: { pendingColumnImages: number } }).confettiPrintProbe.pendingColumnImages)).toBeGreaterThan(0);
	await expect(page.locator("[data-finale-confetti]")).toBeVisible();
	await expect(page.locator("[data-jira-team-eu26-end-finale]")).toHaveCount(0);
	await expect(page.locator("[data-jira-team-eu26-end-finale]")).toBeVisible({ timeout: 15000 });
	await expect(page.locator("[data-finale-confetti]")).toHaveCount(0);
});

test("confetti gives a forceful broad diagonal burst with an early gradual fade", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.addInitScript(() => {
		const animate = Element.prototype.animate;
		Element.prototype.animate = function (frames, options) {
			const animation = animate.call(this, frames, options);
			if (this instanceof HTMLElement && this.hasAttribute("data-confetti-corner")) {
				// Motion finishes configuring and starts its native animation after
				// this factory returns. Pin the frame after that setup completes.
				queueMicrotask(() => {
					animation.pause();
					animation.currentTime = 450;
				});
			}
			return animation;
		};
	});
	await page.goto(`${origin}/jira-team-eu26-end`, { waitUntil: "networkidle" });
	await page.getByRole("button", { name: "Settings", exact: true }).click();
	await page.getByRole("menuitem", { name: "Play closing", exact: true }).click();
	const burst = page.locator("[data-finale-confetti]");
	await expect(burst).toBeVisible();
	const pieces = await burst.locator("[data-confetti-corner]").evaluateAll(nodes => nodes.map(node => {
		const rect = node.getBoundingClientRect();
		return { corner: (node as HTMLElement).dataset.confettiCorner, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, opacity: Number(getComputedStyle(node).opacity), width: innerWidth, height: innerHeight };
	}));
	expect(pieces).toHaveLength(360);
	for (const piece of pieces) {
		expect(piece.opacity).toBeGreaterThan(0.9);
		expect(piece.opacity).toBeLessThan(1);
	}
	for (const corner of ["left", "right"]) {
		const fan = pieces.filter(piece => piece.corner === corner);
		const nearOrigin = fan.filter(piece => (corner === "left" ? piece.x : piece.width - piece.x) >= 0 && (corner === "left" ? piece.x : piece.width - piece.x) < piece.width * 0.16 && piece.y > piece.height * 0.75 && piece.y < piece.height);
		expect(nearOrigin.length).toBeGreaterThan(20);
		expect(Math.max(...fan.map(piece => piece.x)) - Math.min(...fan.map(piece => piece.x))).toBeGreaterThan(fan[0].width * 0.25);
		expect(fan.some(piece => piece.y < piece.height * 0.5)).toBe(true);
		const rise = fan.reduce((sum, piece) => sum + piece.height - piece.y, 0);
		const travel = fan.reduce((sum, piece) => sum + (corner === "left" ? piece.x : piece.width - piece.x), 0);
		expect(rise).toBeGreaterThan(travel * 0.9);
	}
	await page.screenshot({ path: "output/agent-browser/keynote-completion/lower-spray-450ms.png" });
	await burst.evaluate(node => { for (const animation of node.getAnimations({ subtree: true })) animation.currentTime = 900; });
	const faded = await burst.locator("[data-confetti-corner]").evaluateAll(nodes => nodes.map(node => Number(getComputedStyle(node).opacity)));
	expect(faded.every(opacity => opacity > 0.3 && opacity < 0.4)).toBe(true);
	for (const corner of ["left", "right"]) {
		const nearOrigin = await burst.locator(`[data-confetti-corner="${corner}"]`).evaluateAll(nodes => nodes.filter(node => {
			const rect = node.getBoundingClientRect();
			const x = (node as HTMLElement).dataset.confettiCorner === "left" ? rect.x + rect.width / 2 : innerWidth - rect.x - rect.width / 2;
			const y = rect.y + rect.height / 2;
			return x >= 0 && x < innerWidth * 0.16 && y > innerHeight * 0.75 && y < innerHeight;
		}).length);
		expect(nearOrigin).toBeGreaterThan(20);
	}
	await page.screenshot({ path: "output/agent-browser/keynote-completion/lower-spray-fade-900ms.png" });
	await burst.evaluate(node => { for (const animation of node.getAnimations({ subtree: true })) animation.play(); });
	await expect(page.locator("[data-jira-team-eu26-end-finale]")).toBeVisible({ timeout: 15000 });
	await expect(burst).toHaveCount(0);
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`keyboard replay includes the confetti intro (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.addInitScript(() => {
			const probe = { events: [] as string[], boardVisibleAtBurst: [] as boolean[] };
			Object.assign(window, { finaleReplayProbe: probe });
			new MutationObserver(records => {
				for (const record of records) for (const node of record.addedNodes) {
					if (!(node instanceof HTMLElement)) continue;
					if (node.hasAttribute("data-finale-confetti")) {
						probe.events.push("confetti");
						const cards = document.querySelectorAll('[data-jira-kanban-column="Done"] [data-slot="jira-issue-card"]');
						probe.boardVisibleAtBurst.push(cards.length === 13 && [...cards].every(card => getComputedStyle(card).visibility === "visible"));
					}
					if (node.hasAttribute("data-jira-team-eu26-end-finale")) probe.events.push("finale");
				}
			}).observe(document, { childList: true, subtree: true });
		});
		await page.goto(`${origin}/jira-team-eu26-end`, { waitUntil: "networkidle" });
		await page.getByRole("button", { name: "Settings", exact: true }).click();
		await page.getByRole("menuitem", { name: "Play closing", exact: true }).click();
		const finale = page.locator("[data-jira-team-eu26-end-finale]");
		await expect(finale).toBeVisible({ timeout: 15000 });
		const expected = reducedMotion === "reduce" ? ["finale"] : ["confetti", "finale"];
		for (const key of ["r", "R"]) {
			// Replay from the final scene, when the original board cards are hidden.
			await page.evaluate(() => (window as typeof window & { __jiraTeamEu26Finale: { hold: (time: number) => void } }).__jiraTeamEu26Finale.hold(20));
			await expect(page.locator('[data-jira-kanban-column="Done"] [data-slot="jira-issue-card"]').first()).toHaveCSS("visibility", "hidden");
			await page.keyboard.press(key);
			expected.push(...(reducedMotion === "reduce" ? ["finale"] : ["confetti", "finale"]));
			await expect.poll(() => page.evaluate(() => (window as typeof window & { finaleReplayProbe: { events: string[] } }).finaleReplayProbe.events), { timeout: 15000 }).toEqual(expected);
			await expect(finale).toBeVisible();
			await expect(page.locator("[data-finale-confetti]")).toHaveCount(0);
		}
		const visibleAtBurst = await page.evaluate(() => (window as typeof window & { finaleReplayProbe: { boardVisibleAtBurst: boolean[] } }).finaleReplayProbe.boardVisibleAtBurst);
		expect(visibleAtBurst).toEqual(reducedMotion === "reduce" ? [] : [true, true, true]);
	});
}
