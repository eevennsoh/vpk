import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("suggestion sources show only their titles, without clipping", async ({ page }) => {
	await page.setViewportSize({ width: 1235, height: 1100 });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	await page.getByRole("button", { name: /\d+ suggestions$/ }).click();
	await page.getByRole("button", { name: "Show as list" }).click();
	await page.getByRole("button", { name: "Why parent was suggested" }).click();
	const explanation = page.getByRole("dialog", { name: "Four sibling onboarding items already sit under this epic." });
	const sources = explanation.getByRole("region", { name: "Sources" });
	const title = sources.getByText("PAY-100 has 4 related onboarding children", { exact: true });
	await expect(title).toBeVisible();
	await expect(sources.locator("blockquote")).toHaveCount(0);
	await expect(sources.getByText("PAY-961, PAY-972, PAY-988, PAY-990")).toHaveCount(0);
	await explanation.evaluate((element) => { element.style.width = "180px"; });
	const overflow = await title.evaluate((element) => {
		const row = element.parentElement!.getBoundingClientRect();
		return element.getBoundingClientRect().right - row.right;
	});
	expect(overflow).toBeLessThanOrEqual(1);
});
