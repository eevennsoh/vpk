import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const HEATMAP_URL = appUrl("/components/visual/heatmap");

test("a live reduced-motion preference freezes the mounted Heatmap preview", async ({ page }) => {
	await page.goto(HEATMAP_URL, { waitUntil: "domcontentloaded" });

	const canvas = page.locator('main .h-80 [data-heatmap="true"] canvas');
	await expect(canvas).toBeVisible();

	const movingFrame = await canvas.screenshot();
	await page.waitForTimeout(800);
	expect((await canvas.screenshot()).equals(movingFrame)).toBe(false);

	await page.emulateMedia({ reducedMotion: "reduce" });
	await expect.poll(() => page.evaluate(() =>
		window.matchMedia("(prefers-reduced-motion: reduce)").matches,
	)).toBe(true);
	await page.evaluate(() => new Promise<void>((resolve) =>
		requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
	));
	await page.waitForTimeout(250);

	const frozenFrame = await canvas.screenshot();
	await page.waitForTimeout(1_200);
	expect((await canvas.screenshot()).equals(frozenFrame)).toBe(true);
});
