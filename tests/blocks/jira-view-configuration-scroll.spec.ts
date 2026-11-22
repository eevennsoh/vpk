import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test.use({ ignoreHTTPSErrors: true });

test("field options scroll to the menu edge while keeping the last row inset", async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/jira-view-configuration"));
	await page.getByRole("combobox", { name: "Fields" }).click();
	const popup = page.locator('[data-slot="combobox-content"]');
	const list = page.locator('[data-slot="combobox-list"]');
	await expect.poll(() => list.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
	const gap = await list.evaluate((element) => {
		const surface = element.closest('[data-slot="combobox-content"]')!;
		return surface.getBoundingClientRect().bottom - element.getBoundingClientRect().bottom;
	});
	expect(gap).toBeLessThanOrEqual(1);
	await list.evaluate((element) => { element.scrollTop = element.scrollHeight; });
	const last = page.getByRole("option", { name: "Labels" });
	await expect(last).toBeInViewport();
	const bottomInset = await last.evaluate((element) => {
		const surface = element.closest('[data-slot="combobox-content"]')!;
		return surface.getBoundingClientRect().bottom - element.getBoundingClientRect().bottom;
	});
	expect(bottomInset).toBeGreaterThanOrEqual(5);
	await page.getByRole("combobox", { name: "Fields" }).fill("Labels");
	await expect(page.getByRole("option", { name: "Labels" })).toBeVisible();
	const shortInset = await popup.evaluate((element) => {
		const last = element.querySelector('[role="option"]')!;
		return element.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom;
	});
	expect(shortInset).toBeGreaterThanOrEqual(5);
});
