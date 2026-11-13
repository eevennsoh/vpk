import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ ignoreHTTPSErrors: true });

test("story point editing uses the custom stepper without native arrows", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List" }).click();
	await page.getByRole("button", { name: "Edit story points for PAY-118, 3" }).click();
	const input = page.getByRole("spinbutton", { name: "Story points for PAY-118" });
	await input.fill("4");
	await input.hover();
	await expect(input).toHaveCSS("appearance", "textfield");
	await input.press("Enter");
	await page.getByRole("button", { name: "Increase story points for PAY-118" }).click();
	await expect(page.getByRole("button", { name: "Edit story points for PAY-118, 5" })).toBeVisible();
});
