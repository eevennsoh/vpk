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

test("the reviewed list uses the same caught-up state as the stack", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	await page.getByRole("button", { name: /\d+ suggestions$/ }).click();
	await page.getByRole("button", { name: "Show as list" }).click();
	const panel = page.getByRole("dialog", { name: "Work item suggestions", exact: true });
	await panel.getByRole("list", { name: "Suggestions" }).getByRole("button", { name: "Accept description" }).click();
	await panel.getByRole("button", { name: "Dismiss all" }).click();
	await expect(panel.getByText("All caught up", { exact: true })).toBeVisible();
	await expect(panel.getByText("1 added · 4 dismissed")).toBeVisible();
	await expect(panel.getByRole("button", { name: "Check again", exact: true })).toBeVisible();
	await expect(panel.getByRole("button", { name: "Check again", exact: true })).toBeFocused();
	await expect(panel.getByRole("button", { name: /^Undo/ })).toHaveCount(1);
	await expect(panel.getByRole("list", { name: "Suggestions" })).toHaveCount(0);
	await panel.getByRole("button", { name: "Check again", exact: true }).click();
	await expect(panel.getByText("Nothing new since you last checked")).toBeVisible();
	await panel.getByRole("button", { name: /^Undo/ }).click();
	await expect(panel.getByRole("button", { name: "Accept due date" })).toBeVisible();
});

test("dismissing the stack shows the same caught-up state and can be undone", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	await page.getByRole("button", { name: /\d+ suggestions$/ }).click();
	const panel = page.getByRole("dialog", { name: "Work item suggestions", exact: true });
	await panel.getByRole("button", { name: "Dismiss all" }).click();
	await expect(panel.getByText("All caught up", { exact: true })).toBeVisible();
	await expect(panel.getByText("5 dismissed")).toBeVisible();
	await expect(panel.getByRole("button", { name: "Check again" })).toBeVisible();
	await panel.getByRole("button", { name: /^Undo/ }).click();
	await expect(panel.getByRole("button", { name: "Accept description" })).toBeVisible();
});
