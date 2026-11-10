import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`byline rows release idle layers and retain hover and keyboard behavior (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/components/blocks/editor-palette"));
		const menu = page.locator('.rich-text-command-menu[data-row-variant="with-byline"]').filter({
			has: page.getByRole("listbox", { name: "Subagents", exact: true }),
		});
		const row = menu.getByRole("option", { name: /^Pipeline Troubleshooter/ });
		await row.scrollIntoViewIfNeeded();
		const title = row.locator(".menu-row-title");
		const byline = row.locator(".menu-row-byline");
		await expect(byline).toHaveCSS("opacity", "0");
		await expect(title).toHaveCSS("will-change", "auto");
		await expect(byline).toHaveCSS("will-change", "auto");
		await expect(row.locator('[data-slot="avatar"]')).toHaveCSS("will-change", "auto");
		const restingBox = await row.boundingBox();

		await row.hover();
		await expect(byline).toHaveCSS("opacity", "1");
		expect(await row.boundingBox()).toEqual(restingBox);
		await menu.getByRole("button", { name: "Back", exact: true }).hover();
		await expect(byline).toHaveCSS("opacity", "0");
		await expect(title).toHaveCSS("will-change", "auto");

		await menu.getByRole("option", { name: /^Code Reviewer/ }).focus();
		await page.keyboard.press("Tab");
		await expect(row).toBeFocused();
		await expect(byline).toHaveCSS("opacity", "1");
		await menu.getByRole("option", { name: /^Work Item Planner/ }).focus();
		await page.keyboard.press("Tab");
		const lastRow = menu.getByRole("option", { name: /^Unit Test Creator/ });
		await expect(lastRow).toBeFocused();
		await expect(lastRow).toBeInViewport();
		await expect(lastRow.locator(".menu-row-byline")).toHaveCSS("opacity", "1");
	});
}
