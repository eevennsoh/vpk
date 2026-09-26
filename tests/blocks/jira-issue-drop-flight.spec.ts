import { expect, test, type Page } from "@playwright/test";

const origin = process.env.PLAYWRIGHT_BASE_URL ?? "https://26b9.localhost";
const codes = ["PAY-105", "PAY-107", "PAY-123", "PAY-130"];
const issue = (page: Page, code: string) => page.locator(`[data-jira-kanban-scrollport] [data-issue-key="${code}"] [draggable="true"]`).first();

declare global {
	interface Window {
		issueDropAnimations: Animation[];
		issueDropEntrances: Animation[];
	}
}

test.use({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });

async function prepare(page: Page, count: number, reducedMotion: "reduce" | "no-preference") {
	await page.addInitScript(() => {
		window.issueDropAnimations = [];
		window.issueDropEntrances = [];
		const animate = Element.prototype.animate;
		Element.prototype.animate = function (keyframes, options) {
			const animation = animate.call(this, keyframes, options);
			const moveId = this.closest("[data-created-card-arrival-id]")?.getAttribute("data-created-card-arrival-id");
			const dropFlight = this.hasAttribute("data-issue-drop-flight");
			const entrance = this.getAttribute("data-slot") === "jira-creating-card" && moveId?.startsWith("-");
			if (dropFlight || entrance) {
				animation.pause();
				animation.currentTime = 0;
				(dropFlight ? window.issueDropAnimations : window.issueDropEntrances).push(animation);
			}
			return animation;
		};
	});
	await page.emulateMedia({ reducedMotion });
	await page.clock.install();
	await page.goto(`${origin}/preview/blocks/jira-dragging`);
	await page.waitForLoadState("networkidle");
	if (count > 1) {
		await issue(page, codes[0]).click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await issue(page, codes[count - 1]).click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
	}
	const grabbed = codes[count - 1];
	const source = (await issue(page, grabbed).boundingBox())!;
	await page.mouse.move(source.x + 70, source.y + 30);
	await page.mouse.down();
	await page.mouse.move(source.x + 95, source.y + 35, { steps: 5 });
	await expect(issue(page, grabbed)).toHaveAttribute("data-dragging", "true");
	await page.clock.pauseAt(new Date(Date.now() + 100));
	const done = page.locator('[data-jira-kanban-column="Done"]');
	const target = (await done.boundingBox())!;
	await page.mouse.move(target.x + 90, target.y + 100, { steps: 5 });
	await page.mouse.move(target.x + 91, target.y + 100);
	await page.clock.runFor(32);
	await page.mouse.up();
	await expect(done.locator("[data-board-agent-session-drop-zone=issue]")).toHaveCount(count);
	return { done, grabbed };
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	for (const count of [1, 2, 3, 4]) {
		test(`${count} issues share one Jira Linking drop (${reducedMotion})`, async ({ page }) => {
			const { done, grabbed } = await prepare(page, count, reducedMotion);
			const flights = page.locator("[data-issue-drop-flight]");
			const visible = 1;
			if (reducedMotion === "reduce") {
				await expect(flights).toHaveCount(0);
				await page.clock.runFor(500);
				await expect(done.locator("[data-jira-creating-arrival=true]")).toHaveCount(0);
			} else {
				await expect(flights).toHaveCount(visible);
				await expect(flights.first()).toHaveAttribute("data-issue-drop-flight", grabbed);
				await expect(flights.first()).toContainText(grabbed);
				for (const [index, flight] of (await flights.all()).entries()) {
					await expect(flight).toHaveAttribute("aria-hidden", "true");
					await expect(flight).toHaveAttribute("inert", "");
					await expect(flight).toHaveAttribute("data-issue-drop-flight-index", String(index));
				}
				const timings = await page.evaluate(() => window.issueDropAnimations.map((animation) => {
					const timing = animation.effect!.getTiming();
					const frames = (animation.effect as KeyframeEffect).getKeyframes();
					const start = new DOMMatrix(String(frames[0].transform));
					const apex = new DOMMatrix(String(frames[24].transform));
					const end = new DOMMatrix(String(frames.at(-1)!.transform));
					const dx = end.m41 - start.m41, dy = end.m42 - start.m42;
					const distance = Math.hypot(dx, dy);
					const positions = frames.map((frame) => new DOMMatrix(String(frame.transform)));
					return {
						duration: timing.duration, delay: timing.delay, distance,
						lift: Math.min(start.m42, end.m42) - apex.m42,
						rises: positions.slice(1, 25).every((point, index) => point.m42 < positions[index].m42),
						falls: positions.slice(25).every((point, index) => point.m42 > positions[index + 24].m42),
						converges: positions.every((point) => point.m41 >= Math.min(start.m41, end.m41) - 0.01 && point.m41 <= Math.max(start.m41, end.m41) + 0.01),
						finalScale: end.a, finalOpacity: Number(frames.at(-1)!.opacity),
					};
				}));
				expect(timings).toHaveLength(visible);
				for (const timing of timings) {
					expect(timing.duration).toBe(260);
					expect(timing.delay).toBe(0);
					// DOMMatrix exposes browser float precision; compare visible subpixel geometry.
					expect(timing.lift).toBeCloseTo(20, 2);
					expect(timing.rises).toBe(true);
					expect(timing.falls).toBe(true);
					expect(timing.converges).toBe(true);
					expect(timing.finalScale).toBeCloseTo(0.65, 5);
					expect(timing.finalOpacity).toBe(0);
				}
				// Even a nearby single-card release rises above both endpoints before falling.
				if (count === 1) expect(timings[0].distance).toBeLessThan(80);
				await expect(done.locator("[data-jira-creating-arrival=true]")).toHaveCount(visible);
				await expect(done.locator('[data-slot="jira-creating-slot"][aria-hidden="true"][inert]')).toHaveCount(visible);
				expect(await page.evaluate(() => window.issueDropEntrances.length)).toBe(0);
				// Target movement retargets the toss without restarting the flight.
				await page.evaluate(() => window.issueDropAnimations.forEach((animation) => { animation.currentTime = 90; }));
				await done.evaluate((node) => { node.style.transform = "translateY(30px)"; });
				await page.clock.runFor(100);
				expect(await page.evaluate(() => window.issueDropAnimations.map((animation) => animation.currentTime))).toEqual(Array.from({ length: visible }, () => 90));
				await page.evaluate(() => window.issueDropAnimations[0].finish());
				await expect(flights).toHaveCount(visible - 1);
				await expect(done.locator(`[data-issue-key="${grabbed}"] [data-slot="jira-creating-slot"]`)).not.toHaveAttribute("aria-hidden", "true");
				await expect(done.locator('[data-slot="jira-creating-slot"][aria-hidden="true"][inert]')).toHaveCount(visible - 1);
				await page.evaluate(() => window.issueDropAnimations.forEach((animation) => animation.finish()));
				await expect(flights).toHaveCount(0);
				await page.evaluate(() => window.issueDropEntrances.forEach((animation) => animation.finish()));
				await page.clock.runFor(1000);
				await expect(done.locator("[data-jira-creating-arrival=true]")).toHaveCount(0);
			}
			await expect(page.locator('[data-jira-kanban-column="To do"] [data-board-agent-session-drop-zone=issue]')).toHaveCount(4 - count);
			await expect(page.locator("[data-issue-cohort-preview], [data-issue-cohort-drag-image]")).toHaveCount(0);
			await page.clock.resume();
		});
	}
}

test("changing to reduced motion during delivery removes all flights", async ({ page }) => {
	const { done } = await prepare(page, 4, "no-preference");
	await expect(page.locator("[data-issue-drop-flight]")).toHaveCount(1);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await expect(page.locator("[data-issue-drop-flight]")).toHaveCount(0);
	await expect(done.locator("[data-jira-creating-arrival=true]")).toHaveCount(0);
	await expect(done.locator("[data-board-agent-session-drop-zone=issue]")).toHaveCount(4);
	await page.clock.resume();
});

test("a new gesture cancels the old delivery while preserving all committed issues", async ({ page }) => {
	const { done } = await prepare(page, 4, "no-preference");
	await expect(page.locator("[data-issue-drop-flight]")).toHaveCount(1);
	// Other selected issues are at rest and can immediately start another gesture.
	const source = (await issue(page, "PAY-123").boundingBox())!;
	await page.mouse.move(source.x + 70, source.y + 30);
	await page.mouse.down();
	await page.mouse.move(source.x + 95, source.y + 35, { steps: 5 });
	await expect(page.locator("[data-issue-drop-flight]")).toHaveCount(0);
	await expect(done.locator("[data-board-agent-session-drop-zone=issue]")).toHaveCount(4);
	await page.keyboard.press("Escape");
	await page.mouse.up();
	await expect(page.locator("[data-issue-cohort-preview]")).toHaveCount(0);
	await page.clock.resume();
});

test("record one drop effect for a four-issue move", async ({ browser }) => {
	const context = await browser.newContext({
		viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true,
		recordVideo: { dir: "output/agent-browser/jira-dragging/delivery-recording", size: { width: 1600, height: 1000 } },
	});
	const page = await context.newPage();
	const video = page.video()!;
	try {
		await page.goto(`${origin}/preview/blocks/jira-dragging`);
		await page.waitForLoadState("networkidle");
		await issue(page, codes[0]).click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await issue(page, codes[3]).click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		const source = (await issue(page, codes[0]).boundingBox())!;
		const done = page.locator('[data-jira-kanban-column="Done"]');
		const target = (await done.boundingBox())!;
		await page.mouse.move(source.x + 70, source.y + 30);
		await page.mouse.down();
		await page.mouse.move(source.x + 95, source.y + 35, { steps: 5 });
		await page.mouse.move(target.x + 90, target.y + 100, { steps: 12 });
		await page.mouse.move(target.x + 91, target.y + 100);
		await page.mouse.up();
		await expect(done.locator("[data-board-agent-session-drop-zone=issue]")).toHaveCount(4);
		await expect(page.locator("[data-issue-drop-flight]")).toHaveCount(1);
		await expect(page.locator("[data-issue-drop-flight]")).toHaveCount(0);
		await expect(done.locator("[data-jira-creating-arrival=true]")).toHaveCount(0);
		await page.screenshot({ path: "output/agent-browser/jira-dragging/delivered-four-issues.png" });
	} finally {
		await context.close();
		await video.saveAs("output/agent-browser/jira-dragging/single-drop-delivery.webm");
	}
});
