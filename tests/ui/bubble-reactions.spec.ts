import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test.use({ ignoreHTTPSErrors: true });

test("reaction buttons keep neutral, rounded surfaces and respond to activation", async ({ page }) => {
	await page.goto(appUrl("/components/ui/bubble#reactions-buttons"));
	const example = page.locator("#reactions-buttons");
	const reactions = example.locator('[data-slot="bubble-reactions"]');
	await expect(reactions).toHaveCount(3);
	const backgrounds = await reactions.evaluateAll((elements) =>
		elements.map((element) => getComputedStyle(element).backgroundColor),
	);
	expect(backgrounds[0]).toBe(backgrounds[1]);
	expect(backgrounds[2]).not.toBe(backgrounds[0]);

	const action = example.getByRole("button", { name: "Yes, run it" });
	await expect(action).toBeVisible();
	await expect.poll(() => action.evaluate((element) => Number.parseFloat(getComputedStyle(element).borderRadius))).toBeGreaterThanOrEqual(12);
	await action.focus();
	await page.keyboard.press("Enter");
	await expect(page.getByText("You clicked yes, running command...")).toBeVisible();
	await expect(example.getByRole("button", { name: "Celebrate" })).toBeVisible();
	await expect(example.getByRole("button", { name: "Thumbs up" })).toBeVisible();
	await expect(example.getByRole("button", { name: "Thumbs down" })).toBeVisible();
});
