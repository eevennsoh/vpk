import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("dismissing suggestions keeps the reviewed count visible", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	await page.getByRole("button", { name: /\d+ suggestions$/ }).click();
	const footer = page.getByRole("dialog", { name: "Work item suggestions", exact: true }).locator("footer");
	await expect(footer).toContainText("0 of 5 reviewed");
	await page.getByRole("button", { name: "Dismiss description" }).click();
	await expect(footer).toContainText("1 of 5 reviewed");
	await expect(footer).not.toContainText("Description dismissed");
	await page.getByRole("button", { name: "Dismiss due date" }).click();
	await expect(footer).toContainText("2 of 5 reviewed");
	await expect(footer).not.toContainText("Due Date dismissed");
	await page.getByRole("button", { name: "Undo dismissing Due Date" }).click();
	await expect(footer).toContainText("1 of 5 reviewed");
});
