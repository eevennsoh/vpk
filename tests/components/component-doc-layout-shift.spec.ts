import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

// Measured on the production export: every doc page has a 0.0024 shift from the site header, and
// demos settling inside their own preview frame add up to about 0.02. Editor Palette scored 0.61
// when its late demo pushed the sections below it down. 0.05 sits between the two, at half of
// Google's 0.1 limit for "good" CLS.
const MAX_LAYOUT_SHIFT = 0.05;

type ShiftWindow = Window & { docLayoutShifts: number[]; docLayoutShiftObserver: PerformanceObserver };

test("a component doc page does not jump when its preview demo loads", { tag: "@smoke" }, async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.addInitScript(() => {
		const shifts: number[] = [];
		const record = (entries: PerformanceEntryList) => {
			for (const entry of entries as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
				if (!entry.hadRecentInput) shifts.push(entry.value);
			}
		};
		const observer = new PerformanceObserver((list) => record(list.getEntries()));
		observer.observe({ type: "layout-shift", buffered: true });
		Object.assign(window, { docLayoutShifts: shifts, docLayoutShiftObserver: observer });
	});
	// Editor Palette has a tall demo that arrives after the page paints.
	await page.goto(appUrl("/components/blocks/editor-palette"));
	await expect(page.locator("#preview .rich-text-command-menu").first()).toBeVisible({ timeout: 15_000 });
	await expect(page.locator("[data-doc-preview-pending]")).toHaveCount(0);
	await expect(page.locator("#installation")).toBeVisible();
	const total = await page.evaluate(() => new Promise<number>((resolve) => {
		// Two frames let the demo's own layout land, then takeRecords() flushes entries not yet delivered.
		requestAnimationFrame(() => requestAnimationFrame(() => {
			const target = window as unknown as ShiftWindow;
			for (const entry of target.docLayoutShiftObserver.takeRecords() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
				if (!entry.hadRecentInput) target.docLayoutShifts.push(entry.value);
			}
			resolve(target.docLayoutShifts.reduce((sum, value) => sum + value, 0));
		}));
	}));
	expect(total).toBeLessThan(MAX_LAYOUT_SHIFT);
});
