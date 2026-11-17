import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test("viewer status glyphs are centered in their 16px footprint", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1200 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	await page.getByRole("button", { name: "Team session", exact: true }).click();
	const viewer = page.getByRole("region", { name: "Cloud (Viewer) sessions" });
	for (const [title, status] of [
		["Hand off the off-road suspension controls to engineering", "Finished"],
		["Active air suspension roadmap", "Needs input"],
	] as const) {
		await viewer.locator("article").filter({ hasText: title }).click();
		const cue = page.getByRole("group", { name: "Session owner and status" }).getByRole("img", { name: status });
		await expect(cue).toHaveCSS("width", "16px");
		await expect(cue).toHaveCSS("height", "16px");
		await expect.poll(() => cue.evaluate((element) => {
			const glyph = element.querySelector("svg");
			if (!glyph) return null;
			const slot = element.getBoundingClientRect();
			const icon = glyph.getBoundingClientRect();
			return Math.max(Math.abs((slot.left + slot.right - icon.left - icon.right) / 2), Math.abs((slot.top + slot.bottom - icon.top - icon.bottom) / 2));
		})).toBeLessThanOrEqual(0.5);
	}
});
