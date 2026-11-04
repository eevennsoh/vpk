import { expect, test, type Locator } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

async function expectJourneyActivityOrder(activity: Locator) {
	const entries = activity.locator("[data-jira-activity-entry-id]");
	await expect(entries).toHaveCount(3);
	const ids = await entries.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-jira-activity-entry-id")));
	expect(ids[0]).toMatch(/^merchant-started-/);
	expect(ids[1]).toMatch(/^merchant-agent-added-/);
	expect(ids[2]).toBe("butter-accepted-suggestions");
	await expect(entries.first().getByRole("group", { name: "Replies" })).toContainText("opened PR #284");
}

test("jumping to Pull request shows the accepted suggestions in Activity", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.getByRole("button", { name: "Pull request", exact: true }).click();
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	const activity = item.getByRole("region", { name: "Activity" });
	await expectJourneyActivityOrder(activity);
	const accepted = activity.locator('[data-jira-activity-entry-id="butter-accepted-suggestions"]');
	await expect(accepted).toHaveCount(1);
	const summary = accepted.getByRole("button", { name: /Venn\s*updated description, due date, parent, labels, and story points/ });
	await expect(summary).toBeVisible();
	if (await summary.getAttribute("aria-expanded") !== "true") await summary.click();
	await expect(accepted).toContainText("PAY-100 Payments SDK v2 migration");
	await expect(accepted).toContainText("onboarding, sdk-v2");
	await activity.getByRole("button", { name: "More activity actions" }).click();
	await page.getByRole("menuitemradio", { name: "Oldest first" }).click();
	await expect(activity.locator("[data-jira-activity-entry-id]").first()).toHaveAttribute("data-jira-activity-entry-id", "butter-accepted-suggestions");
	if (await summary.getAttribute("aria-expanded") === "true") await summary.click();
	await expect(accepted.locator("dd").first()).toBeHidden();
	const nextSnapshot = activity.locator('[data-jira-activity-entry-id^="merchant-agent-added-"] p');
	const [updateBox, nextBox] = await Promise.all([summary.boundingBox(), nextSnapshot.boundingBox()]);
	if (!updateBox || !nextBox) throw new Error("Activity snapshots are not visible");
	expect(nextBox.y - (updateBox.y + updateBox.height)).toBeLessThanOrEqual(12);
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
	await expectJourneyActivityOrder(item.getByRole("region", { name: "Activity" }));
});

test("the live journey keeps acceptance before invocation and the PR update", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await item.getByRole("button", { name: /suggestions$/ }).click();
	await page.getByRole("button", { name: "Accept all" }).click();
	await page.getByRole("button", { name: "Close suggestions" }).click();
	await item.getByRole("button", { name: /\. Add agent$/ }).click();
	await page.getByRole("combobox", { name: "Search agents" }).fill("Claude");
	await page.getByRole("option", { name: /^Claude/ }).first().click();
	await page.getByRole("menu", { name: "Run Claude on" }).getByRole("menuitem", { name: "Run on cloud" }).click();
	await item.getByRole("button", { name: "Close Project butter work item" }).click();
	await page.getByRole("button", { name: "Pull request", exact: true }).click();
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	await expect(item).toBeVisible();
	await expectJourneyActivityOrder(item.getByRole("region", { name: "Activity" }));
});

test("Claude keeps progress in the acknowledgment thread and posts the merged PR separately", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.getByRole("button", { name: "Pull request", exact: true }).click();
	const card = page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]');
	await card.click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	const thread = item.locator('[data-jira-activity-entry-id^="merchant-started-"]');
	await expect(thread).toHaveCount(1);
	await expect(thread.getByRole("group", { name: "Replies" })).toContainText("opened PR #284");
	await item.getByRole("button", { name: "Close Project butter work item" }).click();
	await page.getByRole("button", { name: "Done", exact: true }).click();
	await card.click();
	await expect(thread).toHaveCount(1);
	const replies = thread.getByRole("group", { name: "Replies" });
	await expect(replies).toContainText("opened PR #284");
	await expect(replies).toContainText("pushed a fix");
	await expect(replies).toContainText("checks passed after the fix");
	await expect(replies).not.toContainText("PR #284 merged");
	const finalComment = item.locator('[data-jira-activity-entry-id="merchant-merged"]');
	await expect(finalComment).toHaveCount(1);
	await expect(finalComment).toContainText("PR #284 merged. PAY-999 is ready for the Done column.");
	await expect(item.getByRole("region", { name: "Activity" }).locator("[data-jira-activity-entry-id]").first()).toHaveAttribute("data-jira-activity-entry-id", "merchant-merged");
	await expect(item.locator('[data-jira-activity-entry-id="merchant-pr"], [data-jira-activity-entry-id="merchant-fix"], [data-jira-activity-entry-id="merchant-passed"]')).toHaveCount(0);
});
