import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test.use({ ignoreHTTPSErrors: true });

for (const width of [1440, 1800]) {
	for (const reducedMotion of ["no-preference", "reduce"] as const) {
		test(`fitting columns lose their scrollbars after filtering at ${width}px (${reducedMotion})`, async ({ page }) => {
			await page.emulateMedia({ reducedMotion });
			await page.setViewportSize({ width, height: 900 });
			await page.goto(appUrl("/jira-team-eu26"));
			await expect(page.getByRole("heading", { name: "Jira Design", exact: true })).toBeVisible();
			const review = page.getByRole("region", { name: "In review work items", exact: true });
			await expect(review.locator("..").locator('[data-slot="scroll-area-scrollbar"]')).toHaveCount(1);
			const filter = page.getByRole("button", { name: "Filter board by Diego Santos", exact: true });
			await filter.click();
			await expect(filter).toHaveAttribute("aria-pressed", "true");

			for (const title of ["To do", "In progress", "In review", "Done"]) {
				const viewport = page.getByRole("region", { name: `${title} work items`, exact: true });
				await expect.poll(() => viewport.evaluate((element) => element.scrollHeight - element.clientHeight)).toBe(0);
				await expect(viewport.locator("..").locator('[data-slot="scroll-area-scrollbar"]')).toHaveCount(0);
			}
			await page.screenshot({ path: `output/agent-browser/scrollbars/fitting-${width}-${reducedMotion}.png` });

			await filter.click();
			const scrollbar = review.locator("..").locator('[data-slot="scroll-area-scrollbar"]');
			await review.hover();
			await expect(scrollbar).toHaveCSS("opacity", "1");
			await page.mouse.wheel(0, 180);
			await expect.poll(() => review.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
		});
	}
}

test("board scrollbars hide at rest and support hover, wheel, dragging, and keyboard", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(appUrl("/jira-team-eu26"));
	const heading = page.getByRole("heading", { name: "Jira Design", exact: true });
	await expect(heading).toBeVisible();
	const viewport = page.getByRole("region", { name: "In review work items", exact: true });
	const area = viewport.locator("..");
	const scrollbar = area.locator('[data-slot="scroll-area-scrollbar"]');
	const thumb = scrollbar.locator('[data-slot="scroll-area-thumb"]');
	const scrollTop = () => viewport.evaluate((element) => element.scrollTop);

	await heading.hover();
	await expect(viewport).toHaveCSS("scrollbar-width", "none");
	await expect(scrollbar).toHaveCSS("opacity", "0");
	await expect(scrollbar).toHaveCSS("pointer-events", "none");
	const idleWidth = await viewport.evaluate((element) => element.clientWidth);

	await viewport.hover();
	await expect(scrollbar).toHaveCSS("opacity", "1");
	await expect(scrollbar).toHaveCSS("pointer-events", "auto");
	expect(await viewport.evaluate((element) => element.clientWidth)).toBe(idleWidth);
	await page.mouse.wheel(0, 180);
	await expect.poll(scrollTop).toBeGreaterThan(0);

	const beforeDrag = await scrollTop();
	const bounds = await thumb.boundingBox();
	expect(bounds).not.toBeNull();
	await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
	await page.mouse.down();
	await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2 + 30, { steps: 5 });
	await page.mouse.up();
	await expect.poll(scrollTop).toBeGreaterThan(beforeDrag);

	await heading.hover();
	await expect(scrollbar).toHaveCSS("opacity", "0");
	await page.keyboard.press("Tab");
	await viewport.focus();
	await expect(scrollbar).toHaveCSS("opacity", "1");
	await expect(viewport).toHaveCSS("mask-image", "none");
	await page.screenshot({ path: "output/agent-browser/vpk-verify/jira-team-eu26-scrollbars/keyboard-focus.png" });
	await viewport.press("Tab");
	await expect(scrollbar).toHaveCSS("opacity", "1");
	await expect(viewport).toHaveCSS("mask-image", "none");
	await viewport.press("Home");
	await expect.poll(scrollTop).toBe(0);
	await viewport.press("PageDown");
	await expect.poll(scrollTop).toBeGreaterThan(0);
	await heading.click();
	await heading.hover();
	await expect(scrollbar).toHaveCSS("opacity", "0");
	await expect(viewport).not.toHaveCSS("mask-image", "none");

	// The thumb stays available while scrolling settles after the pointer leaves.
	await viewport.hover();
	await page.mouse.wheel(0, -60);
	await heading.hover();
	await expect(scrollbar).toHaveAttribute("data-scrolling", "");
	await expect(scrollbar).toHaveCSS("opacity", "1");
	await expect(scrollbar).toHaveCSS("opacity", "0");
});
