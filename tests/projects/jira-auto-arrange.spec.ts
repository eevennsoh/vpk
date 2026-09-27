import { expect, test } from "@playwright/test";

const origin = process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost";
test.use({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });

type SparkleProbe = { readyAt: number; staticAt: number; waveEndAt: number; waveObserved: boolean };
declare global {
	interface Window { autoArrangeSparkleProbe?: SparkleProbe; }
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`auto arrange matches toolbar size and settles its detection sparkle (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${origin}/jira-team-eu26`);
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
			await page.screenshot({ path: "output/agent-browser/auto-arrange/detection-sparkle.png" });
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
