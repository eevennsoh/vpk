import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("the failed PR flyout offers Fix PR beside Review", async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/pull-request"));
	await page.getByRole("button", { name: "Flyout", exact: true }).click();
	await page.getByRole("button", { name: "Failed", exact: true }).click();
	const card = page.getByRole("group", { name: "Pull request #1306: Add guest checkout to the storefront" });
	const review = card.getByRole("link", { name: "Review" });
	const fix = card.getByRole("button", { name: "Fix PR" });
	await expect(review).toBeVisible();
	await expect(fix).toBeEnabled();
	const [reviewBox, fixBox] = await Promise.all([review.boundingBox(), fix.boundingBox()]);
	if (!reviewBox || !fixBox) throw new Error("The PR actions did not render");
	expect(Math.abs(reviewBox.y - fixBox.y)).toBeLessThan(1);
	expect(fixBox.x).toBeGreaterThan(reviewBox.x);
	await fix.click();
	await expect(card.getByRole("button", { name: "Fix PR" })).toHaveCount(0);
	await expect(card.getByRole("button", { name: /checks running/ })).toBeVisible();
});
