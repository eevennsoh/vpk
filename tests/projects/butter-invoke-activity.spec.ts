import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("jumping to Pull request shows the accepted suggestions in Activity", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.getByRole("button", { name: "Pull request", exact: true }).click();
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	const activity = item.getByRole("region", { name: "Activity" });
	const accepted = activity.locator('[data-jira-activity-entry-id="butter-accepted-suggestions"]');
	await expect(accepted).toHaveCount(1);
	const summary = accepted.getByRole("button", { name: /Venn\s*updated description, due date, parent, labels, and story points/ });
	await expect(summary).toBeVisible();
	if (await summary.getAttribute("aria-expanded") !== "true") await summary.click();
	await expect(accepted).toContainText("PAY-100 Payments SDK v2 migration");
	await expect(accepted).toContainText("onboarding, sdk-v2");
});

test("Jumping ahead does not duplicate activity when the suggestions were really accepted", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await item.getByRole("button", { name: /suggestions$/ }).click();
	await page.getByRole("button", { name: "Accept all" }).click();
	const accepted = item.locator('[data-jira-activity-entry-id="butter-accepted-suggestions"]');
	await expect(accepted).toHaveCount(1);
	await item.getByRole("button", { name: "Close Project butter work item" }).click();
	await page.getByRole("button", { name: "Pull request", exact: true }).click();
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	await expect(accepted).toHaveCount(1);
	await expect(accepted.getByRole("button", { name: /Venn\s*updated description, due date, parent, labels, and story points/ })).toBeVisible();
});
