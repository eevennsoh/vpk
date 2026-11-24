import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

test("Butter v1 child and linked work status controls have no leading icons", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	await page.getByRole("button", { name: "15 child work items" }).click();
	await page.getByRole("button", { name: "8 linked work items" }).click();
	for (const label of ["Child work items", "Linked work"]) {
		const table = page.getByRole("table", { name: label });
		const statusButtons = table.locator('button[aria-label^="Edit status for "]');
		await expect(statusButtons.first()).toBeVisible();
		await expect(statusButtons.locator('[data-slot="progress-circle"]')).toHaveCount(0);
		const row = table.locator("tbody tr[data-related-id]").first();
		const firstCell = row.locator("td").first();
		const lastCell = row.locator("td").last();
		await row.hover();
		await expect(firstCell).toHaveCSS("border-top-left-radius", await table.locator("thead th").first().evaluate((cell) => getComputedStyle(cell).borderTopLeftRadius));
		await expect(lastCell).toHaveCSS("border-top-right-radius", await table.locator("thead th").last().evaluate((cell) => getComputedStyle(cell).borderTopRightRadius));
		await expect(firstCell).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
		await expect(lastCell).toHaveCSS("background-color", await firstCell.evaluate((cell) => getComputedStyle(cell).backgroundColor));
	}
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`child status changes without a leading icon (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/butter"));
		await page.locator('[data-issue-key="PAY-118"][data-board-column-title] [data-slot="jira-issue-card"]').click();
		await page.getByRole("button", { name: "3 child work items" }).click();
		const child = page.getByRole("button", { name: "Edit status for PAY-201, To do" });
		await expect(child).toBeVisible();
		await expect(child.locator('[data-slot="progress-circle"]')).toHaveCount(0);
		await child.click();
		await page.getByRole("menuitem", { name: "In progress", exact: true }).click();
		const updated = page.getByRole("button", { name: "Edit status for PAY-201, In progress" });
		await expect(updated.locator('[data-slot="progress-circle"]')).toHaveCount(0);
		await updated.click();
		await page.getByRole("menuitem", { name: "Done", exact: true }).click();
		await expect(page.getByRole("button", { name: "Edit status for PAY-201, Done" }).locator('[data-slot="progress-circle"]')).toHaveCount(0);
	});
}
