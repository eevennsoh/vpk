import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("Claude's status change appears once throughout the working journey", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	const card = page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]');
	await page.getByRole("button", { name: "In progress", exact: true }).click();
	await card.click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	const statusChange = item.locator('[data-jira-activity-entry-id^="merchant-status-"]');
	await expect(statusChange).toHaveCount(1);
	await expect(statusChange).toContainText("Claude changed status from To do to In progress");
	await item.getByRole("button", { name: "Close Project butter work item" }).click();
	await page.getByRole("button", { name: "Pull request", exact: true }).click();
	await card.click();
	await expect(statusChange).toHaveCount(1);
	await item.getByRole("button", { name: "Close Project butter work item" }).click();
	await page.getByRole("button", { name: "Prepare & invoke", exact: true }).click();
	await expect(statusChange).toHaveCount(0);
});
