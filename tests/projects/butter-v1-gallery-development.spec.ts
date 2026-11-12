import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ actionTimeout: 7000, ignoreHTTPSErrors: true });

test("the Development panel gallery item shows the populated interactive panel", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.clock.install();
	await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 100));
	await page.getByRole("button", { name: "Select Development panel" }).click();
	const panel = page.getByRole("region", { name: "Pull request development" });
	await expect(panel).toHaveAttribute("data-project-butter-development", "failed");
	await expect(panel.getByRole("button", { name: /#284 Add merchant onboarding quickstart/ })).toBeVisible();
	await panel.getByRole("button", { name: /#284 Add merchant onboarding quickstart/ }).click();
	const fix = page.getByRole("button", { name: "Fix PR" });
	await expect(fix).toBeEnabled();
	const initial = await panel.boundingBox();
	if (!initial) throw new Error("Development panel has no bounds");
	await page.clock.fastForward(4000);
	await expect(panel).toHaveAttribute("data-project-butter-development", "failed");
	for (const phase of ["fixing", "passed"]) {
		await page.clock.fastForward(phase === "fixing" ? 1000 : 5000);
		await expect(panel).toHaveAttribute("data-project-butter-development", phase);
		if (phase === "fixing") {
			await expect(fix).toBeDisabled();
			await expect(fix).toHaveAttribute("aria-busy", "true");
			await expect(fix.locator('[data-slot="spinner"]')).toBeVisible();
		} else {
			await expect(fix).toHaveCount(0);
		}
		const current = await panel.boundingBox();
		if (!current) throw new Error(`Development panel has no bounds in ${phase}`);
		expect(Math.abs(current.x - initial.x)).toBeLessThanOrEqual(1);
		expect(Math.abs(current.y - initial.y)).toBeLessThanOrEqual(1);
	}
	await page.clock.fastForward(1999);
	await expect(panel).toHaveAttribute("data-project-butter-development", "passed");
	await page.clock.fastForward(1);
	await expect(panel).toHaveAttribute("data-project-butter-development", "merged");
	await expect(fix).toHaveCount(0);
	const merged = await panel.boundingBox();
	if (!merged) throw new Error("Development panel has no bounds in merged");
	expect(Math.abs(merged.x - initial.x)).toBeLessThanOrEqual(1);
	expect(Math.abs(merged.y - initial.y)).toBeLessThanOrEqual(1);
	await expect(page.getByText("payments-platform/payments").first()).toBeVisible();
});

test("the Development panel waits for manual merge when automation is disabled", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.setViewportSize({ width: 1600, height: 1200 });
	await page.goto(appUrl("/butter-v1"));
	await page.clock.install();
	await page.getByRole("button", { name: "Select Development panel" }).click();
	const panel = page.getByRole("region", { name: "Pull request development" });
	await panel.getByRole("button", { name: "Configure", exact: true }).click();
	await page.getByRole("menuitemcheckbox", { name: "Merge when ready" }).click();
	await page.keyboard.press("Escape");
	await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 100));
	await page.clock.fastForward(5000);
	await expect(panel).toHaveAttribute("data-project-butter-development", "fixing");
	await page.clock.fastForward(5000);
	await expect(panel).toHaveAttribute("data-project-butter-development", "passed");
	await page.clock.fastForward(5000);
	await expect(panel).toHaveAttribute("data-project-butter-development", "passed");
	await panel.getByRole("button", { name: "Merge pull request" }).click();
	await expect(panel).toHaveAttribute("data-project-butter-development", "merged");
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`CI summary resolves to a filled success check with ${reducedMotion} motion`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("button", { name: "Select Development panel" }).click();
		const panel = page.getByRole("region", { name: "Pull request development" });
		await expect(panel).toHaveAttribute("data-project-butter-development", "failed");
		await panel.getByRole("button", { name: /#284 Add merchant onboarding quickstart/ }).click();
		const flyout = page.getByRole("group", { name: "Pull request #284: Add merchant onboarding quickstart" });
		const indicator = flyout.locator('[data-slot="progress-circle"]').first();
		await expect(indicator.locator("circle")).not.toHaveCount(0);
		await expect(indicator.locator("circle.text-icon-danger")).toHaveCount(1);
		const completionFrames = flyout.evaluate((element) => new Promise<{ time: number; fraction: number; successOpacity: number; successScale: number }[]>((resolve) => {
			const frames: { time: number; fraction: number; successOpacity: number; successScale: number }[] = [];
			let started = 0;
			const sample = (time: number) => {
				if (document.querySelector('[data-project-butter-development="passed"]')) {
					started ||= time;
					const arc = element.querySelector("circle.text-icon-accent-lime");
					const values = arc ? getComputedStyle(arc).strokeDasharray.match(/[\d.]+/gu)?.map(Number) : undefined;
					const icon = element.querySelector("svg:has(path.text-icon-success)");
					const iconLayer = icon?.parentElement?.parentElement;
					const successOpacity = icon && iconLayer ? Number.parseFloat(getComputedStyle(icon).opacity) * Number.parseFloat(getComputedStyle(iconLayer).opacity) : 0;
					const successScale = iconLayer ? new DOMMatrixReadOnly(getComputedStyle(iconLayer).transform).a : 1;
					frames.push({ time, fraction: values && values.length >= 2 ? values[0] / (values[0] + values[1]) : 0, successOpacity, successScale });
					if (time - started >= 1000) return resolve(frames);
				}
				requestAnimationFrame(sample);
			};
			requestAnimationFrame(sample);
		}));
		const failureOpacities = indicator.evaluate((element) => new Promise<number[]>((resolve) => {
			const samples: number[] = [];
			const sample = () => {
				const failed = element.querySelector("circle.text-icon-danger");
				if (!failed) return resolve(samples);
				samples.push(Number.parseFloat(getComputedStyle(failed).opacity));
				requestAnimationFrame(sample);
			};
			requestAnimationFrame(sample);
		}));
		const completionOpacities = flyout.evaluate((element) => new Promise<number[]>((resolve) => {
			const samples: number[] = [];
			let started = 0;
			const sample = (time: number) => {
				const icon = element.querySelector("svg:has(path.text-icon-success)");
				if (icon) {
					started ||= time;
					const iconLayer = icon.parentElement?.parentElement;
					samples.push(iconLayer ? Number.parseFloat(getComputedStyle(iconLayer).opacity) : 0);
					if (time - started >= 800) return resolve(samples);
				}
				requestAnimationFrame(sample);
			};
			requestAnimationFrame(sample);
		}));
		await expect(panel).toHaveAttribute("data-project-butter-development", "fixing", { timeout: 10_000 });
		const failed = await failureOpacities;
		if (reducedMotion === "reduce") expect(failed.every((opacity) => opacity === 1)).toBe(true);
		else expect(failed.some((opacity) => opacity < 0.99)).toBe(true);
		await expect(panel).toHaveAttribute("data-project-butter-development", "passed", { timeout: 15_000 });
		await expect(flyout.getByRole("button", { name: /3\/3 builds passed/ })).toBeVisible();
		await expect(flyout.locator('[data-slot="progress-circle"] path.text-icon-success')).toBeVisible();
		await expect(indicator.locator("circle.text-icon-accent-lime")).toHaveCount(1);
		const opacities = await completionOpacities;
		const frames = await completionFrames;
		if (reducedMotion === "reduce") {
			expect(opacities.every((opacity) => opacity === 1)).toBe(true);
			expect(frames.every(({ successScale }) => successScale === 1)).toBe(true);
		}
		else {
			expect(opacities.some((opacity) => opacity < 0.99)).toBe(true);
			expect(frames.some(({ successOpacity, successScale }) => successOpacity > 0.01 && successScale < 0.9)).toBe(true);
			expect(frames.some(({ fraction, successOpacity }) => fraction > 0.99 && successOpacity < 0.01)).toBe(true);
			const ringCompleted = frames.find(({ fraction }) => fraction > 0.999);
			const checkAppeared = frames.find(({ successOpacity }) => successOpacity > 0.01);
			if (!ringCompleted || !checkAppeared) throw new Error("Completion sequence did not finish");
			expect(checkAppeared.time - ringCompleted.time).toBeGreaterThanOrEqual(180);
		}
	});
}
