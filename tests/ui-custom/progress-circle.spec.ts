import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const URL = appUrl("/components/ui-custom/progress-circle#filled-controlled");

test.use({ ignoreHTTPSErrors: true });

test("the segmented example plays and replays the checks completion sequence", async ({ page }) => {
	await page.goto(appUrl("/components/ui-custom/progress-circle#segmented"));
	const states = page.getByRole("group", { name: "Check states" });
	const demo = page.locator("#segmented");
	const progress = demo.getByRole("progressbar", { name: "CI checks", exact: true });
	await expect(progress).toHaveAttribute("aria-valuenow", "2");
	await expect(progress).toHaveAttribute("aria-valuemax", "3");
	await demo.getByRole("button", { name: "Play checks sequence" }).click();
	await expect(demo.getByText("Rechecking the failed check")).toBeVisible();
	await expect(demo.getByText("All 3 checks passed")).toBeVisible();
	await expect(progress).toHaveAttribute("aria-valuenow", "3");
	await expect(progress.locator("path.text-icon-success")).toBeVisible();
	await demo.getByRole("button", { name: "Replay checks sequence" }).click();
	await expect(demo.getByText("2 of 3 checks passed · 1 failed")).toBeVisible();
	await states.getByRole("button", { name: "Passed", exact: true }).click();
	await expect(progress).toHaveAttribute("aria-valuenow", "3");
	await states.getByRole("button", { name: "Failed", exact: true }).click();
	await expect(progress).toHaveAttribute("aria-valuenow", "2");
	await demo.getByRole("switch", { name: "Segmented mode" }).click();
	await expect(demo.getByRole("progressbar", { name: "Progress", exact: true })).toHaveAttribute("aria-valuenow", "75");
});

test("the segmented completion check scales in after the ring closes", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/components/ui-custom/progress-circle#segmented"));
	const demo = page.locator("#segmented");
	const progress = demo.getByRole("progressbar", { name: "CI checks", exact: true });
	await progress.scrollIntoViewIfNeeded();
	const samples = progress.evaluate((element) => new Promise<{ opacity: number; scale: number }[]>((resolve) => {
		const frames: { opacity: number; scale: number }[] = [];
		let started = 0;
		const sample = (time: number) => {
			const icon = element.querySelector("svg:has(path.text-icon-success)");
			const layer = icon?.parentElement?.parentElement;
			if (layer) {
				started ||= time;
				const style = getComputedStyle(layer);
				frames.push({ opacity: Number.parseFloat(style.opacity), scale: new DOMMatrixReadOnly(style.transform).a });
				if (time - started >= 1000) return resolve(frames);
			}
			requestAnimationFrame(sample);
		};
		requestAnimationFrame(sample);
	}));
	await demo.getByRole("button", { name: "Passed", exact: true }).click();
	const frames = await samples;
	expect(frames.some(({ opacity, scale }) => opacity > 0.01 && scale < 0.9)).toBe(true);
	expect(frames.at(-1)?.scale).toBeCloseTo(1, 2);
});

test("progress colors can be toggled independently of dashed animation", async ({ page }) => {
	await page.goto(URL);
	const progress = page.getByRole("progressbar", { name: "Filled progress", exact: true });
	const dashes = progress.locator('[data-slot="progress-circle-dashes"]');
	const toggle = page.getByRole("switch", { name: "Color by progress" });
	await expect(toggle).toBeChecked();
	await expect(dashes).toHaveClass(/text-icon-subtle/);
	const grey = await dashes.evaluate((el) => getComputedStyle(el).color);
	for (const [value, color] of [[25, "information"], [50, "information"], [75, "discovery"]] as const) {
		await page.getByRole("button", { name: `${value}%`, exact: true }).click();
		await expect(dashes).toHaveClass(new RegExp(`text-icon-${color}`));
		const currentColor = await dashes.evaluate((el) => getComputedStyle(el).color);
		expect(currentColor).not.toBe(grey);
		await expect(progress.locator('[data-slot="progress-circle-solid"]')).toHaveCSS("color", currentColor);
		await expect(progress.locator("svg > path")).toHaveCSS("color", currentColor);
		await toggle.focus();
		await toggle.press("Space");
		await expect(dashes).toHaveCSS("color", grey);
		await expect(progress).toHaveAttribute("aria-valuenow", String(value));
		await expect(dashes).toHaveCSS("animation-play-state", "running");
		await toggle.press("Space");
		await expect(dashes).toHaveCSS("color", currentColor);
	}
	await page.getByRole("switch", { name: "Animate dashed border" }).click();
	await expect(dashes).toHaveClass(/text-icon-discovery/);
	await expect(dashes).toHaveCSS("animation-play-state", "paused");
	await toggle.click();
	await page.getByRole("button", { name: "100%", exact: true }).click();
	await expect(progress.locator('svg[viewBox="0 0 16 16"] .text-icon-success')).toBeVisible();
});

test("filled progress keeps a solid completed arc and a pausable dashed remainder", async ({ page }) => {
	await page.goto(URL);
	const progress = page.getByRole("progressbar", { name: "Filled progress", exact: true });
	const dashes = progress.locator('[data-slot="progress-circle-dashes"]');
	const solid = progress.locator('[data-slot="progress-circle-solid"]');
	const radius = Number(await solid.getAttribute("r"));
	await progress.scrollIntoViewIfNeeded();
	await expect(progress).toHaveAttribute("aria-valuenow", "0");
	const zeroPattern = (await dashes.getAttribute("stroke-dasharray"))!.split(" ").map(Number);
	expect(zeroPattern[0]).toBeCloseTo(zeroPattern[1] * 3);

	for (const value of [25, 50, 75]) {
		await page.getByRole("button", { name: `${value}%`, exact: true }).click();
		await expect(progress).toHaveAttribute("aria-valuenow", String(value));
		await expect.poll(async () => Number.parseFloat(await solid.evaluate((el) => getComputedStyle(el).strokeDashoffset)))
			.toBeCloseTo(2 * Math.PI * radius * (1 - value / 100), 2);
		const pattern = (await dashes.getAttribute("stroke-dasharray"))!.split(" ").map(Number);
		expect(pattern[0]).toBeCloseTo(zeroPattern[1]);
		expect(pattern[1]).toBeCloseTo(zeroPattern[1]);
	}

	const transform = () => dashes.evaluate((el) => getComputedStyle(el).transform);
	const moving = await transform();
	await expect.poll(transform).not.toBe(moving);
	const toggle = page.getByRole("switch", { name: "Animate dashed border" });
	await toggle.focus();
	await toggle.press("Space");
	await expect(toggle).not.toBeChecked();
	await expect(dashes).toHaveCSS("animation-play-state", "paused");
	const paused = await transform();
	await page.waitForTimeout(150); // Compare two frames while explicitly paused.
	expect(await transform()).toBe(paused);
	await expect(progress).toHaveAttribute("aria-valuenow", "75");
	await toggle.press("Space");
	await expect.poll(transform).not.toBe(paused);

	await page.getByRole("button", { name: "100%", exact: true }).click();
	await expect(progress).toHaveAttribute("aria-valuenow", "100");
	await expect(progress.locator('svg[viewBox="0 0 16 16"] .text-icon-success')).toBeVisible();
	await expect(dashes).toHaveCount(0);
	await page.getByRole("button", { name: "0%", exact: true }).click();
	await expect(dashes).toBeVisible();
	await expect(progress.locator('svg[viewBox="0 0 16 16"] .text-icon-success')).toHaveCount(0);
});

test("the sequence visits every step before showing completion", async ({ page }) => {
	await page.goto(URL);
	const progress = page.getByRole("progressbar", { name: "Filled progress", exact: true });
	await page.getByRole("button", { name: "Play sequence", exact: true }).click();
	for (const value of [0, 25, 50, 75, 100]) {
		await expect(progress).toHaveAttribute("aria-valuenow", String(value));
	}
	await expect(progress.locator('svg[viewBox="0 0 16 16"] .text-icon-success')).toBeVisible();
	await page.getByRole("button", { name: "Replay", exact: true }).click();
	await expect(progress).toHaveAttribute("aria-valuenow", "0");
	await page.getByRole("button", { name: "Pause", exact: true }).click();
	await page.waitForTimeout(1700); // Longer than one step: a paused sequence must not advance.
	await expect(progress).toHaveAttribute("aria-valuenow", "0");
});

test("reduced motion keeps dashes static and controls fit a narrow viewport", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(URL);
	await page.getByRole("button", { name: "Close sidebar", exact: true }).click();
	const progress = page.getByRole("progressbar", { name: "Filled progress", exact: true });
	await progress.scrollIntoViewIfNeeded();
	await expect(progress.locator('[data-slot="progress-circle-dashes"]')).toHaveCSS("animation-name", "none");
	const slider = page.getByRole("slider", { name: "Filled progress percentage" });
	await slider.focus();
	await slider.press("ArrowRight");
	await expect(progress).toHaveAttribute("aria-valuenow", "25");
	for (const value of [0, 25, 50, 75, 100]) {
		const bounds = await page.getByRole("button", { name: `${value}%`, exact: true }).boundingBox();
		expect(bounds!.x).toBeGreaterThanOrEqual(0);
		expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
	}
	await page.getByRole("button", { name: "100%", exact: true }).click();
	await expect(progress.locator('svg[viewBox="0 0 16 16"] .text-icon-success')).toBeVisible();
});

test("live reduced-motion changes stop indeterminate spinners", async ({ page }) => {
	await page.goto(URL);
	const spinner = page.locator('[role="progressbar"]:not([aria-valuenow]) svg').first();
	await expect(spinner).toHaveCSS("animation-name", "spin");
	await page.emulateMedia({ reducedMotion: "reduce" });
	await expect(spinner).toHaveCSS("animation-name", "none");
});
