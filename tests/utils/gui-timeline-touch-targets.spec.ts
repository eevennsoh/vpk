import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const COMPACT_CONTROLS = [
	".dialkit-toolbar-add",
	".dialkit-timeline-chevron",
	".dialkit-timeline-popover-close",
	".dialkit-preset-delete",
	".dialkit-timeline-group-toggle",
].join(", ");

test.describe("GUI timeline compact controls on a coarse pointer", () => {
	test.use({ hasTouch: true, isMobile: true, viewport: { height: 844, width: 390 } });

	test("keep at least a 32px target (DESIGN.md touch targets)", async ({ page }) => {
		await page.goto(appUrl("/components/utility/gui#timeline"), { waitUntil: "networkidle" });
		await expect.poll(() => page.evaluate(() => matchMedia("(any-pointer: coarse)").matches)).toBe(true);
		const controls = page.locator(`.vpk-gui-timeline :is(${COMPACT_CONTROLS})`);
		await expect(controls.first()).toBeVisible();
		const sizes = await controls.evaluateAll((elements) => elements
			.filter((element) => element.getClientRects().length > 0)
			.map((element) => {
				const { height, width } = element.getBoundingClientRect();
				return { height, label: element.getAttribute("aria-label") ?? element.className, width };
			}));
		expect(sizes.length).toBeGreaterThan(0);
		for (const size of sizes) {
			expect(size.width, size.label).toBeGreaterThanOrEqual(32);
			expect(size.height, size.label).toBeGreaterThanOrEqual(32);
		}
	});
});

test("GUI timeline compact controls keep their desktop size on a fine pointer", async ({ page }) => {
	await page.goto(appUrl("/components/utility/gui#timeline"), { waitUntil: "networkidle" });
	const chevron = page.locator(".vpk-gui-timeline .dialkit-timeline-chevron").first();
	await expect(chevron).toBeVisible();
	const box = await chevron.boundingBox();
	expect(box?.height).toBe(28);
});
