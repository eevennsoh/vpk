import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

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
