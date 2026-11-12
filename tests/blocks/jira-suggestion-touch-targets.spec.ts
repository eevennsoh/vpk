import { expect, test, type Locator } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test.use({ hasTouch: true, viewport: { width: 1280, height: 844 } });

async function expectTouchTargets(dialog: Locator) {
	await expect.poll(async () => {
		const sizes = await dialog.getByRole("button").evaluateAll((buttons) =>
			buttons.map((button) => {
				const { width, height } = button.getBoundingClientRect();
				return { label: button.getAttribute("aria-label") ?? button.textContent?.trim(), width, height };
			}),
		);
		return sizes.length === 0 ? ["No buttons"] : sizes.filter(({ width, height }) => width < 32 || height < 32);
	}).toEqual([]);
}

async function expectTouchTarget(button: Locator) {
	await expect(button).toBeVisible();
	await expect.poll(() => button.evaluate((element) => {
		const { width, height } = element.getBoundingClientRect();
		return width >= 32 && height >= 32;
	})).toBe(true);
}

test("Jira suggestion actions meet the touch target minimum in stack and list states", async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/jira-suggestion"));
	await expect.poll(() => page.evaluate(() => matchMedia("(any-pointer: coarse)").matches)).toBe(true);

	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	await expectTouchTargets(dialog);
	await dialog.getByRole("button", { name: "Show as list" }).click();
	const list = dialog.getByRole("list", { name: "Suggestions" });
	await expectTouchTarget(list.getByRole("button", { name: "Why description was suggested" }).first());
	await expectTouchTarget(list.getByRole("button", { name: "Dismiss description" }));
	await expectTouchTarget(list.getByRole("button", { name: "Accept description" }));
	await list.getByRole("button", { name: "Accept description" }).click();
	await expectTouchTarget(dialog.getByRole("button", { name: "Undo description" }));
});
