import { expect, test, type Locator } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

type RowGeometry = Readonly<{ x: number; y: number; width: number; height: number }>;

// The row's box relative to its menu, once it holds still for two frames. Late demos above the menu
// and the page scroll that hover() may cause move the menu and the row together, so they do not count.
async function rowGeometryInMenu(row: Locator): Promise<RowGeometry> {
	return row.evaluate((element) => new Promise<RowGeometry>((resolve) => {
		const menu = element.closest(".rich-text-command-menu")!;
		const read = () => {
			const box = element.getBoundingClientRect();
			const frame = menu.getBoundingClientRect();
			const round = (value: number) => Math.round(value * 100) / 100;
			return { x: round(box.x - frame.x), y: round(box.y - frame.y), width: round(box.width), height: round(box.height) };
		};
		let previous = JSON.stringify(read());
		const next = () => {
			const geometry = read();
			const key = JSON.stringify(geometry);
			if (key === previous) resolve(geometry);
			else {
				previous = key;
				requestAnimationFrame(next);
			}
		};
		requestAnimationFrame(next);
	}));
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`byline rows release idle layers and retain hover and keyboard behavior (${reducedMotion})`, { tag: "@smoke" }, async ({ page }) => {
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
		const resting = await rowGeometryInMenu(row);

		await row.hover();
		await expect(byline).toHaveCSS("opacity", "1");
		// The byline fades in without resizing the row or moving it within its menu.
		expect(await rowGeometryInMenu(row)).toEqual(resting);
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
