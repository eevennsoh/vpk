import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

async function startClaude(page: Page) {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	const card = page.locator('[data-issue-key="PAY-999"][data-board-column-title]');
	await card.locator('[data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await item.getByRole("button", { name: /suggestions$/ }).click();
	await page.getByRole("button", { name: "Accept all" }).click();
	await page.getByRole("button", { name: "Close suggestions" }).click();
	await item.getByRole("button", { name: "Add agent", exact: true }).click();
	await page.getByRole("combobox", { name: "Search agents" }).fill("Claude");
	await page.getByRole("option", { name: /^Claude/ }).first().click();
	await page.getByRole("menu", { name: "Run Claude on" }).getByRole("menuitem", { name: "Run on cloud" }).click();
	return { card, item };
}

test("Claude acknowledges after Venn's activity snapshots", async ({ page }) => {
	const { item } = await startClaude(page);
	const activity = item.getByRole("region", { name: "Activity" });
	const acknowledgment = activity.locator('[data-jira-activity-entry-id^="merchant-started-"]');
	await expect(activity).toContainText("updated description");
	await expect(activity).toContainText("Venn added Claude and self-assigned the issue");
	await expect(acknowledgment).toHaveCount(0);
	await expect(acknowledgment).toContainText("I'm looking into this issue now", { timeout: 6_000 });
	await expect(acknowledgment).toHaveCount(1);
	await expect.poll(async () => activity.locator('[data-jira-activity-entry-id^="merchant-started-"], [data-jira-activity-entry-id^="merchant-status-"], [data-jira-activity-entry-id^="merchant-agent-added-"], [data-jira-activity-entry-id="butter-accepted-suggestions"]').evaluateAll((entries) => entries.map((entry) => entry.getAttribute("data-jira-activity-entry-id")))).toEqual([
		await acknowledgment.getAttribute("data-jira-activity-entry-id"),
		await activity.locator('[data-jira-activity-entry-id^="merchant-status-"]').getAttribute("data-jira-activity-entry-id"),
		await activity.locator('[data-jira-activity-entry-id^="merchant-agent-added-"]').getAttribute("data-jira-activity-entry-id"),
		"butter-accepted-suggestions",
	]);
	await activity.getByRole("heading", { name: "Activity" }).hover();
	await activity.getByRole("button", { name: "Filter activity" }).click();
	await expect(page.getByRole("menuitemradio", { name: "Oldest first" })).toHaveCount(0);
});

test("the acknowledgment arrives after closing and reopening the work item", async ({ page }) => {
	const { card, item } = await startClaude(page);
	await expect(item.locator('[data-jira-activity-entry-id^="merchant-started-"]')).toHaveCount(0);
	await item.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(card).toHaveAttribute("data-board-column-title", "In progress");
	await card.locator('[data-slot="jira-issue-card"]').click();
	await expect(item.locator('[data-jira-activity-entry-id^="merchant-started-"]')).toHaveCount(1, { timeout: 6_000 });
});

test("replying to Claude keeps the agent mention as a chip when reopening the draft", async ({ page }) => {
	const { item } = await startClaude(page);
	const acknowledgment = item.locator('[data-jira-activity-entry-id^="merchant-started-"]');
	await expect(acknowledgment).toHaveCount(1, { timeout: 6_000 });
	// Comment actions reveal on hover or keyboard focus.
	await acknowledgment.hover();
	const reply = acknowledgment.getByRole("button", { name: "Reply", exact: true });
	await reply.click();
	const editor = acknowledgment.getByRole("textbox", { name: "Leave a reply..." });
	const mention = editor.locator('[data-mention-category="subagent"]');
	await expect(mention).toHaveText("Claude");
	const tag = mention.locator('[data-slot="tag"]');
	await expect(tag.locator('[data-slot="avatar"][data-shape="hexagon"]')).toBeVisible();
	await expect.poll(async () => tag.evaluate((element) => getComputedStyle(element).fontSize)).toBe(await editor.evaluate((element) => getComputedStyle(element).fontSize));
	await editor.pressSequentially("Please include the sandbox checklist");
	await expect(mention).toHaveCount(1);
	await reply.click();
	await reply.click();
	await expect(mention).toHaveText("Claude");
	await expect(editor).toContainText("Please include the sandbox checklist");
	await editor.press("Enter");
	await expect(acknowledgment).toContainText("Please include the sandbox checklist");
	await expect(editor).toHaveCount(0);
});

test("resetting the journey cancels a pending acknowledgment", async ({ page }) => {
	const { card, item } = await startClaude(page);
	await item.getByRole("button", { name: "Close Project butter work item" }).click();
	await page.getByRole("button", { name: "Reset", exact: true }).click();
	await card.locator('[data-slot="jira-issue-card"]').click();
	await expect(item.locator('[data-jira-activity-entry-id^="merchant-started-"]')).toHaveCount(0);
	await page.waitForTimeout(3_500);
	await expect(item.locator('[data-jira-activity-entry-id^="merchant-started-"]')).toHaveCount(0);
});
