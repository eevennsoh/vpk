import { expect, test, type Locator } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

async function expectJourneyActivityOrder(activity: Locator) {
	const entries = activity.locator('[data-jira-activity-entry-id^="merchant-started-"], [data-jira-activity-entry-id^="merchant-agent-added-"], [data-jira-activity-entry-id="butter-accepted-suggestions"]');
	await expect(entries).toHaveCount(3);
	const ids = await entries.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-jira-activity-entry-id")));
	expect(ids[0]).toMatch(/^merchant-started-/);
	expect(ids[1]).toMatch(/^merchant-agent-added-/);
	expect(ids[2]).toBe("butter-accepted-suggestions");
	await expect(entries.first().getByRole("group", { name: "Replies" }).getByRole("link", { name: /#284: Add merchant onboarding quickstart.*Open/ })).toBeVisible();
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
	await activity.getByRole("button", { name: "Filter activity" }).click();
	await page.getByRole("menuitemcheckbox", { name: "Expand change details" }).click();
	await expect(summary).toHaveAttribute("aria-expanded", "true");
	if (await summary.getAttribute("aria-expanded") === "true") await summary.click();
	await expect(accepted.locator("dd").first()).toBeHidden();
	const nextSnapshot = activity.locator('[data-jira-activity-entry-id^="merchant-agent-added-"] p');
	const [updateBox, nextBox] = await Promise.all([summary.boundingBox(), nextSnapshot.boundingBox()]);
	if (!updateBox || !nextBox) throw new Error("Activity snapshots are not visible");
	expect(nextBox.y - (updateBox.y + updateBox.height)).toBeLessThanOrEqual(12);
});

test("Claude's PR and fix updates contain the pull request Smart Link", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.getByRole("button", { name: "Fix checks", exact: true }).click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	const replies = item.locator('[data-jira-activity-entry-id^="merchant-started-"]').getByRole("group", { name: "Replies" });
	const links = replies.getByRole("link", { name: /#284: Add merchant onboarding quickstart.*Open/ });
	await expect(links).toHaveCount(2, { timeout: 12_000 });
	await expect(links.first()).toHaveAttribute("href", "#pull-request-284");
	await links.first().hover();
	const flyout = page.locator("#smart-link-card-butter-pr-284");
	await expect(flyout).toBeVisible();
	await expect(flyout).toContainText("rovo/pay-999-merchant-onboarding");
	await expect(flyout).toContainText("+186");
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
	await expect(thread.getByRole("group", { name: "Replies" }).getByRole("link", { name: /#284: Add merchant onboarding quickstart.*Open/ })).toBeVisible();
	await item.getByRole("button", { name: "Close Project butter work item" }).click();
	await page.getByRole("button", { name: "Done", exact: true }).click();
	await card.click();
	await expect(thread).toHaveCount(1);
	const replies = thread.getByRole("group", { name: "Replies" });
	await expect(replies.getByRole("link", { name: /#284: Add merchant onboarding quickstart.*Merged/ })).toHaveCount(2);
	await expect(replies).toContainText("pushed a fix");
	await expect(replies).toContainText("checks passed after the fix");
	await expect(replies).not.toContainText("merged. PAY-999 is ready for the Done column.");
	const finalComment = item.locator('[data-jira-activity-entry-id="merchant-merged"]');
	await expect(finalComment).toHaveCount(1);
	await expect(finalComment.getByRole("link", { name: /#284: Add merchant onboarding quickstart.*Merged/ })).toBeVisible();
	await expect(finalComment).toContainText("merged. PAY-999 is ready for the Done column.");
	await expect(item.getByRole("region", { name: "Activity" }).locator("[data-jira-activity-entry-id]").first()).toHaveAttribute("data-jira-activity-entry-id", "merchant-merged");
	await expect(item.locator('[data-jira-activity-entry-id="merchant-pr"], [data-jira-activity-entry-id="merchant-fix"], [data-jira-activity-entry-id="merchant-passed"]')).toHaveCount(0);
});
