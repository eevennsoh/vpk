import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("PAY-999 shows its creation after older comments in newest-first activity", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	const activity = page.getByRole("dialog", { name: "Project butter" }).getByRole("region", { name: "Activity" });
	await expect(activity.locator("[data-jira-activity-entry-id]")).toHaveCount(4);
	await expect.poll(() => activity.locator("[data-jira-activity-entry-id]").evaluateAll((entries) => entries.map((entry) => entry.getAttribute("data-jira-activity-entry-id")))).toEqual([
		"pay-999-production",
		"pay-999-challenge-flow",
		"pay-999-pilot-scope",
		"butter-empty-created",
	]);
});

test("PAY-999 keeps its creation event throughout the journey", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	const card = page.locator('[data-issue-key="PAY-999"][data-board-column-title]');
	const item = page.getByRole("dialog", { name: "Project butter" });
	const steps = page.getByRole("group", { name: "Merchant onboarding journey steps" });
	await card.locator('[data-slot="jira-issue-card"]').click();
	for (const step of [null, "In progress", "Pull request", "Fix checks", "Done"]) {
		if (step) {
			if (await item.isVisible()) await item.getByRole("button", { name: "Close Project butter work item" }).click();
			await steps.getByRole("button", { name: step, exact: true }).click();
			if (!(await item.isVisible())) await card.locator('[data-slot="jira-issue-card"]').click();
		}
		const activity = item.getByRole("region", { name: "Activity" });
		const created = activity.locator('[data-jira-activity-entry-id="butter-empty-created"]');
		await expect(created).toHaveCount(1);
		await expect(created).toContainText("Venn");
		await expect(created).toContainText("created this work item");
	}
});
