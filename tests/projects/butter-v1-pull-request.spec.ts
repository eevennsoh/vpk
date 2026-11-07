import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ actionTimeout: 10000, ignoreHTTPSErrors: true, viewport: { width: 1600, height: 1000 } });

test("Pull request tile opens the PAY-999 work item with its PR", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("group", { name: "Gallery items" }).getByRole("button", { name: "Select Pull request" }).click();
	const board = page.getByRole("region", { name: "Pull request Kanban board" });
	await expect(board).toBeVisible();
	const stageBounds = await page.locator("[data-butter-gallery-pull-request]").boundingBox();
	const columnBounds = await board.locator("[data-jira-kanban-column]").boundingBox();
	if (!stageBounds || !columnBounds) throw new Error("Pull request board has no bounds");
	expect(Math.abs((stageBounds.y + stageBounds.height / 2) - (columnBounds.y + columnBounds.height / 2))).toBeLessThan(16);
	await expect(board.locator('[data-issue-key]')).toHaveCount(1);
	const card = board.locator('[data-issue-key="PAY-999"]');
	await expect(card).toContainText("Improve merchant onboarding for Payments SDK v2");
	const pullRequest = card.getByRole("button", { name: /Pull request.*#284/ });
	await expect(pullRequest).toBeVisible();
	await pullRequest.click();
	await expect(page.getByText("Add merchant onboarding quickstart", { exact: false }).first()).toBeVisible();
	await page.keyboard.press("Escape");
	await card.locator('[data-slot="jira-issue-card"]').click();
	const workItem = page.getByRole("dialog", { name: "Project butter" });
	await expect(workItem).toBeVisible();
	await expect(workItem.getByRole("heading", { name: "Improve merchant onboarding for Payments SDK v2" })).toBeVisible();
	await expect(workItem.getByRole("region", { name: "Pull request development" })).toContainText("Add merchant onboarding quickstart");
	await workItem.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(workItem).toBeHidden();
	await expect(card).toBeVisible();
});
