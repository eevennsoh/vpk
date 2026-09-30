import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const PAGE_HEADER_URL = appUrl("/components/ui/page-header");

test("page headers fill flex preview containers without squashing content", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto(PAGE_HEADER_URL, { waitUntil: "load" });

	const pageHeaders = page.locator('[data-slot="page-header"]');
	await expect(pageHeaders).toHaveCount(3);

	for (let index = 0; index < 3; index += 1) {
		const pageHeader = pageHeaders.nth(index);
		const parent = pageHeader.locator("..");
		const title = pageHeader.getByRole("heading", { level: 1 });
		const [headerBox, parentBox, titleBox] = await Promise.all([
			pageHeader.boundingBox(),
			parent.boundingBox(),
			title.boundingBox(),
		]);

		if (!headerBox || !parentBox || !titleBox) {
			throw new Error(`Expected Page Header ${index + 1} to have measurable layout bounds.`);
		}

		expect(headerBox.width).toBeGreaterThan(0);
		expect(Math.abs(headerBox.width - parentBox.width)).toBeLessThanOrEqual(1);
		expect(titleBox.x).toBeGreaterThanOrEqual(headerBox.x - 1);
		expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(
			headerBox.x + headerBox.width + 1,
		);
		expect(
			await pageHeader.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
		).toBe(true);
	}
});
