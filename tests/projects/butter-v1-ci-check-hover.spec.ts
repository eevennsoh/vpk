import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ actionTimeout: 7000, ignoreHTTPSErrors: true });

test("read-only CI checks do not highlight on hover", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1200 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Pull request" }).click();
	await page.getByRole("button", { name: "Merged PR" }).click();
	await page.locator("[data-butter-gallery-pull-request]").getByText("Improve merchant onboarding for Payments SDK v2", { exact: true }).click();
	await page.getByRole("button", { name: "#284 Add merchant onboarding quickstart Merged" }).click();
	const preview = page.getByRole("group", { name: "Pull request #284: Add merchant onboarding quickstart" });
	await preview.getByRole("button", { name: "3/3 builds passed" }).click();
	const rows = preview.locator("[data-jira-work-item-pull-request-checks] li");
	await expect(rows).toHaveCount(3);
	for (const row of await rows.all()) {
		const background = await row.evaluate((element) => getComputedStyle(element).backgroundColor);
		await row.hover();
		await expect(row).toHaveCSS("background-color", background);
		await expect(row).not.toHaveAttribute("role", "link");
	}
});
