import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test.use({ ignoreHTTPSErrors: true });

for (const slug of [
	"app-sidebar",
	"sidebar-01",
	"sidebar-02",
	"sidebar-03",
	"sidebar-04",
	"sidebar-05",
	"sidebar-06",
	"sidebar-07",
	"sidebar-08",
	"sidebar-09",
	"sidebar-10",
	"sidebar-11",
	"sidebar-12",
	"sidebar-15",
	"sidebar-16",
	"dashboard",
]) {
	test(`${slug} header separator is centered beside its sidebar trigger`, async ({ page }) => {
		await page.goto(appUrl(`/preview/blocks/${slug}`));
		const separator = page.locator('header [data-slot="separator"][data-orientation="vertical"]');
		await expect(separator).toBeVisible();
		await expect(separator).toHaveCSS("height", "16px");

		const centerOffset = () => separator.evaluate((element) => {
			const header = element.closest("header");
			const trigger = header?.querySelector('[data-sidebar="trigger"], button');
			if (!trigger) throw new Error("Expected a sidebar trigger beside the separator.");
			const separatorBounds = element.getBoundingClientRect();
			const triggerBounds = trigger.getBoundingClientRect();
			return Math.abs(
				separatorBounds.y + separatorBounds.height / 2
				- triggerBounds.y - triggerBounds.height / 2,
			);
		});

		await expect.poll(centerOffset).toBeLessThanOrEqual(1);
		if (slug === "sidebar-07") {
			await page.locator('header [data-sidebar="trigger"]').click();
			await expect(page.locator('[data-slot="sidebar"][data-state="collapsed"]')).toBeVisible();
			await expect.poll(centerOffset).toBeLessThanOrEqual(1);
		}
	});
}
