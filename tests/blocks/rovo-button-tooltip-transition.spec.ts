import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("review tooltip closes during the notification transition without console errors", async ({ page }) => {
	const errors: string[] = [];
	page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	const review = page.getByRole("button", { name: "Review suggestions", exact: true });
	const tooltip = page.locator('[data-slot="tooltip-content"]').filter({ hasText: "5 suggestions" });
	await review.hover();
	await expect(tooltip).toBeVisible();
	await review.click();
	const panel = page.getByRole("dialog", { name: /^Work item suggestions/ });
	await expect(panel.getByRole("list", { name: "Suggestions" })).toBeVisible();
	await expect(tooltip).toBeHidden();
	await panel.getByRole("button", { name: "Close suggestions" }).click();
	await expect(review).toBeVisible();
	await review.focus();
	await expect(tooltip).toBeVisible();
	expect(errors.filter((error) => /uncontrolled state of openProp|controlled state of openProp/u.test(error))).toEqual([]);
});
