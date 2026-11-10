import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

test("Jira suggestion actions meet the touch target minimum", async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/jira-suggestion"));

	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	const sizes = await dialog.getByRole("button").evaluateAll((buttons) =>
		buttons.map((button) => {
			const { width, height } = button.getBoundingClientRect();
			return { label: button.getAttribute("aria-label") ?? button.textContent?.trim(), width, height };
		}),
	);

	expect(sizes.length).toBeGreaterThan(0);
	expect(sizes.filter(({ width, height }) => width < 32 || height < 32)).toEqual([]);
});
