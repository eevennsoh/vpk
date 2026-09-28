import { expect, test, type Page } from "@playwright/test";

const codes = ["PAY-105", "PAY-107", "PAY-123", "PAY-130"];
const issue = (page: Page, code: string) => page.locator(`[data-jira-kanban-scrollport] [data-issue-key="${code}"] [draggable]`).first();
const origin = () => {
	if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Set PLAYWRIGHT_BASE_URL to the verified worktree origin");
	return process.env.PLAYWRIGHT_BASE_URL;
};
declare global { interface Window { solitaireDropAnimations: Animation[]; } }
test.use({ viewport: { width: 1800, height: 1200 }, ignoreHTTPSErrors: true });

async function prepare(page: Page, count: number, reducedMotion: "reduce" | "no-preference", pause = true) {
	await page.addInitScript((pause) => {
		window.solitaireDropAnimations = [];
		const animate = Element.prototype.animate;
		Element.prototype.animate = function (frames, options) {
			const animation = animate.call(this, frames, options);
			const timing = animation.effect!.getTiming();
			const reveal = timing.duration === 420 - Number(timing.delay) && Number(timing.delay) > 0;
			const trace = this.closest("[data-issue-drop-trace]") !== null;
			if (reveal || trace) {
				window.solitaireDropAnimations.push(animation);
				if (pause) { animation.pause(); animation.currentTime = 0; }
			}
			return animation;
		};
	}, pause);
	await page.emulateMedia({ reducedMotion });
	await page.goto(`${origin()}/components/blocks/jira-dragging`);
	await expect(page.locator("[data-jira-dragging]")).toHaveAttribute("data-variant", "experimental");
	if (count > 1) {
		await issue(page, codes[0]).click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await issue(page, codes[count - 1]).click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
	}
	await issue(page, codes[0]).scrollIntoViewIfNeeded();
	const source = (await issue(page, codes[0]).boundingBox())!;
	await page.mouse.move(source.x + 70, source.y + 30);
	await page.mouse.down();
	await page.mouse.move(source.x + 95, source.y + 35, { steps: 5 });
	await expect(issue(page, codes[0])).toHaveAttribute("data-dragging", "true");
	await expect(page.locator("[data-issue-cohort-preview]")).toHaveAttribute("data-issue-cohort-count", String(count));
	await expect(page.locator("[data-issue-deck-layer]")).toHaveCount(Math.min(count, 3) - 1);
	await expect.poll(() => page.locator("[data-issue-source-ghost-placeholder]").evaluateAll((nodes) => nodes.filter((node) => getComputedStyle(node).opacity === "1").length)).toBe(count);
}

async function drop(page: Page, title = "Done") {
	const destination = page.locator(`[data-jira-kanban-column="${title}"]`);
	const target = (await destination.locator("[data-jira-kanban-column-content]").boundingBox())!;
	await page.mouse.move(target.x + 90, target.y + 30, { steps: 12 });
	await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
	await page.mouse.up();
	return destination;
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	for (const count of [1, 2, 3, 4]) {
		test(`${count} issues commit atomically and unfold into Done (${reducedMotion})`, async ({ page }) => {
			await prepare(page, count, reducedMotion);
			const done = await drop(page);
			await expect(done.locator("[data-issue-key]")).toHaveCount(count);
			await expect(page.locator("[data-issue-cohort-preview], [data-issue-drop-flight]")).toHaveCount(0);
			await expect(done.locator("[data-jira-creating-arrival=true]")).toHaveCount(0);
			expect(await done.locator("[data-issue-key]").evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.issueKey))).toEqual(codes.slice(0, count));
			if (reducedMotion === "reduce") {
				expect(await page.evaluate(() => window.solitaireDropAnimations.length)).toBe(0);
				await expect(page.locator("[data-issue-drop-trace]")).toHaveCount(0);
			} else {
				await expect(page.locator("[data-issue-drop-trace]")).toHaveCount(1);
				for (const outline of await page.locator("[data-issue-drop-trace] g rect").all()) await expect(outline).toHaveAttribute("stroke", "var(--ds-border-success)");
				const evidence = await page.evaluate(() => window.solitaireDropAnimations.map((animation) => {
					const effect = animation.effect as KeyframeEffect;
					const timing = effect.getTiming();
					const frames = effect.getKeyframes();
					const travel = new DOMMatrix(String(frames.at(-1)!.transform)).m42 - new DOMMatrix(String(frames[0].transform)).m42;
					return { timing, trace: effect.target?.closest("[data-issue-drop-trace]") !== null, travel };
				}));
				const trace = evidence.find((item) => item.trace)!;
				const expectedDuration = count === 1 ? 500 : 620;
				expect(Number(trace.timing.duration)).toBeCloseTo(expectedDuration, 3);
				const reveals = evidence.filter((item) => !item.trace);
				expect(reveals).toHaveLength(count - 1);
				for (const [index, reveal] of reveals.entries()) {
					expect(reveal.timing.delay).toBe(Math.min((index + 1) * 24, 72));
					expect(Number(reveal.timing.duration) + Number(reveal.timing.delay)).toBe(420);
					expect(reveal.timing.fill).toBe("backwards");
				}
				const tops = await done.locator("[data-issue-key]").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().top));
				for (const top of tops) expect(top).toBeCloseTo(tops[0], 1);
				await page.evaluate(() => window.solitaireDropAnimations.forEach((animation) => { animation.currentTime = 160; }));
				const unfolding = await done.locator("[data-issue-key]").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().top));
				expect(unfolding[0]).toBe(tops[0]);
				for (const top of unfolding.slice(1)) expect(top).toBeGreaterThan(tops[0]);
				await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
				const outlinesFollowCards = await done.locator("[data-issue-key]").evaluateAll((nodes) => {
					const outlines = [...document.querySelectorAll("[data-issue-drop-trace] g rect")];
					return nodes.every((node, index) => {
						const surface = node.querySelector('[data-slot="jira-issue-surface"]')!.getBoundingClientRect();
						const outline = outlines[index].getBoundingClientRect();
						return Math.abs(outline.left - surface.left - 0.5) < 0.1 && Math.abs(outline.top - surface.top - 0.5) < 0.1;
					});
				});
				expect(outlinesFollowCards).toBe(true);
				await page.evaluate(() => window.solitaireDropAnimations.forEach((animation) => animation.finish()));
				await expect(page.locator("[data-issue-drop-trace]")).toHaveCount(0);
			}
			expect(await done.locator("[data-issue-key]").evaluateAll((nodes) => nodes.every((node) => {
				const style = (node.parentElement as HTMLElement).style;
				return style.zIndex === "" && style.willChange === "" && style.transform === "";
			}))).toBe(true);
		});
	}
}

test("other destinations sweep a brand-blue border, and Escape leaves the source intact", async ({ page }) => {
	await prepare(page, 2, "no-preference");
	await page.keyboard.press("Escape"); await page.mouse.up();
	await expect(page.locator("[data-issue-cohort-preview]")).toHaveCount(0);
	await expect(page.locator('[data-jira-kanban-column="To do"] [data-issue-key]')).toHaveCount(4);
	await prepare(page, 2, "no-preference");
	const review = await drop(page, "In review");
	await expect(review.locator("[data-issue-key]")).toHaveCount(2);
	const trace = page.locator("[data-issue-drop-trace]");
	await expect(trace).toHaveCount(1);
	for (const outline of await trace.locator("g rect").all()) await expect(outline).toHaveAttribute("stroke", "var(--ds-border-brand)");
	await page.evaluate(() => {
		for (const animation of window.solitaireDropAnimations) {
			const target = (animation.effect as KeyframeEffect).target;
			if (target?.closest("[data-issue-drop-trace]")) animation.currentTime = 240;
			else animation.currentTime = 420;
		}
	});
	await page.screenshot({ path: "output/agent-browser/solitaire-reference/brand-blue-trace.png" });
	await page.evaluate(() => window.solitaireDropAnimations.forEach((animation) => animation.cancel()));
	await expect(review.locator("[data-created-card-arrival-id]")).toHaveCount(0);
	await expect(page.locator("[data-issue-drop-trace]")).toHaveCount(0);
});

test("changing to reduced motion cancels the reveal and trace without undoing the drop", async ({ page }) => {
	await prepare(page, 4, "no-preference");
	const done = await drop(page);
	await expect(page.locator("[data-issue-drop-trace]")).toHaveCount(1);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await expect(page.locator("[data-issue-drop-trace]")).toHaveCount(0);
	await expect(done.locator("[data-issue-key]")).toHaveCount(4);
	expect(await page.evaluate(() => window.solitaireDropAnimations.every((animation) => animation.playState === "idle"))).toBe(true);
});

test("record the four-issue solitaire handoff at native speed", async ({ browser }) => {
	const context = await browser.newContext({ viewport: { width: 1800, height: 1200 }, ignoreHTTPSErrors: true,
		recordVideo: { dir: "output/agent-browser/solitaire-reference/replay", size: { width: 1800, height: 1200 } } });
	const page = await context.newPage(); const video = page.video()!;
	try {
		await prepare(page, 4, "no-preference", false);
		const done = await drop(page);
		await expect(done.locator("[data-issue-key]")).toHaveCount(4);
		await expect(page.locator("[data-issue-drop-trace]")).toHaveCount(0);
		await page.screenshot({ path: "output/agent-browser/solitaire-reference/replayed-settled.png" });
	} finally {
		await context.close();
		await video.saveAs("output/agent-browser/solitaire-reference/solitaire-replay.webm");
	}
});

test("a narrow dark board keeps the cohort intact through horizontal scrolling", async ({ page }) => {
	await page.setViewportSize({ width: 1100, height: 950 });
	await page.goto(`${origin()}/components/blocks/jira-dragging`);
	await page.getByRole("button", { name: "Light theme", exact: true }).click();
	await expect(page.getByRole("button", { name: "Dark theme", exact: true })).toBeVisible();
	await prepare(page, 2, "no-preference");
	await page.mouse.wheel(900, 0);
	const content = page.locator('[data-jira-kanban-column="Done"] [data-jira-kanban-column-content]');
	await expect.poll(async () => (await content.boundingBox())!.x).toBeLessThan(850);
	const done = await drop(page);
	await expect(done.locator("[data-issue-key]")).toHaveCount(2);
	await page.evaluate(() => window.solitaireDropAnimations.forEach((animation) => { animation.currentTime = 160; }));
	await page.screenshot({ path: "output/agent-browser/solitaire-reference/narrow-dark-drop.png" });
	await page.evaluate(() => window.solitaireDropAnimations.forEach((animation) => animation.finish()));
	await expect(page.locator("[data-issue-drop-trace]")).toHaveCount(0);
});
