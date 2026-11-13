import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

test("Claude invocation keeps Venn assigned on the board", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	const card = page.locator('[data-issue-key="PAY-999"][data-board-column-title]');
	await card.locator('[data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await item.getByRole("group", { name: "Agents field" }).getByRole("button", { name: "Add agent" }).click();
	await page.getByRole("dialog", { name: "Add agent" }).getByRole("button", { name: "Claude", exact: true }).click();
	await expect(item.getByRole("region", { name: "Activity" })).toContainText("self-assigned");
	await item.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(card).toHaveAttribute("data-board-column-title", "In progress");
	await expect(card.getByRole("img", { name: "Venn", exact: true })).toBeVisible();
});

test("the In progress journey step shows Venn as assignee", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.getByRole("button", { name: "In progress", exact: true }).click();
	const card = page.locator('[data-issue-key="PAY-999"][data-board-column-title]');
	await expect(card).toHaveAttribute("data-board-column-title", "In progress");
	await expect(card.getByRole("img", { name: "Venn", exact: true })).toBeVisible();
});

test("an explicit unassignment after Claude starts is preserved", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	const card = page.locator('[data-issue-key="PAY-999"][data-board-column-title]');
	await card.locator('[data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await item.getByRole("group", { name: "Agents field" }).getByRole("button", { name: "Add agent" }).click();
	await page.getByRole("dialog", { name: "Add agent" }).getByRole("button", { name: "Claude", exact: true }).click();
	await expect(item.getByRole("region", { name: "Activity" })).toContainText("self-assigned");
	await item.getByRole("button", { name: "Change assignee" }).click();
	await page.getByRole("option", { name: "Unassigned", exact: true }).click();
	await item.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(card).toHaveAttribute("data-board-column-title", "In progress");
	await expect(card.getByRole("img", { name: "Unassigned person" })).toBeVisible();
});
