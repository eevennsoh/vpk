import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("group labels add space after content but not after a separator", async ({ page }) => {
	await page.goto(appUrl("/components/ui/select"));
	await page.locator("#grouped").getByRole("combobox").click();
	const labels = page.locator('[data-slot="select-content"][data-open] [data-slot="select-label"]');
	await expect(labels.nth(0)).toHaveCSS("margin-top", "0px");
	await expect(labels.nth(1)).toHaveCSS("margin-top", "6px");
	await page.keyboard.press("Escape");

	await page.locator("#with-groups-and-labels").getByRole("combobox").click();
	await expect(labels.nth(0)).toHaveCSS("margin-top", "0px");
	await expect(labels.nth(1)).toHaveCSS("margin-top", "0px");
});
