import { expect, test } from "@playwright/test";

const URL = `${process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk-rovo.localhost"}/components/ui-custom/progress-circle#filled-controlled`;

test.use({ ignoreHTTPSErrors: true });

test("progress colors can be toggled independently of dashed animation", async ({ page }) => {
	await page.goto(URL);
	const progress = page.getByRole("progressbar", { name: "Filled progress", exact: true });
	const dashes = progress.locator('[data-slot="progress-circle-dashes"]');
	const toggle = page.getByRole("switch", { name: "Color by progress" });
	await expect(toggle).toBeChecked();
	await expect(dashes).toHaveClass(/text-text-subtle/);
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
	await progress.scrollIntoViewIfNeeded();
	await expect(progress).toHaveAttribute("aria-valuenow", "0");
	const zeroPattern = (await dashes.getAttribute("stroke-dasharray"))!.split(" ").map(Number);
	expect(zeroPattern[0]).toBeCloseTo(zeroPattern[1] * 3);

	for (const value of [25, 50, 75]) {
		await page.getByRole("button", { name: `${value}%`, exact: true }).click();
		await expect(progress).toHaveAttribute("aria-valuenow", String(value));
		await expect.poll(async () => Number.parseFloat(await solid.evaluate((el) => getComputedStyle(el).strokeDashoffset)))
			.toBeCloseTo(2 * Math.PI * 10.5 * (1 - value / 100), 2);
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
