import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("creation and status events match the other activity event text", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.getByRole("button", { name: "In progress", exact: true }).click();
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	const activity = page.getByRole("dialog", { name: "Project butter" }).getByRole("region", { name: "Activity" });
	const selectors = [
		'[data-jira-activity-entry-id="butter-empty-created"] p',
		'[data-jira-activity-entry-id^="merchant-status-"] p',
		'[data-jira-activity-entry-id^="merchant-agent-added-"] p',
	];
	for (const selector of selectors) await expect(activity.locator(selector)).toHaveCount(1);
	const styles = await activity.evaluate((root, targets) => targets.map((selector) => {
		const element = root.querySelector(selector);
		if (!element) return null;
		const style = getComputedStyle(element);
		return { color: style.color, fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight };
	}), selectors);
	expect(styles[0]).toEqual(styles[2]);
	expect(styles[1]).toEqual(styles[2]);
});
