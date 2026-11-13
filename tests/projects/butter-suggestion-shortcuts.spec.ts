import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("suggestion shortcuts work from the panel and after the last decision", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await expect(item.getByRole("button", { name: /^\d+ suggestions$/ })).toHaveAttribute("aria-expanded", "true");
	await page.getByRole("group", { name: /Right arrow accepts/ }).focus();
	const description = item.getByRole("textbox", { name: "Work item description" });
	await page.keyboard.press("ArrowRight");
	await expect(description).toContainText("guided quickstart");
	await page.keyboard.press("ControlOrMeta+z");
	await expect(description).not.toContainText("guided quickstart");
	await page.keyboard.press("ArrowLeft");
	await expect(page.getByRole("button", { name: "Accept due date" })).toBeVisible();
	await page.keyboard.press("ControlOrMeta+z");
	await expect(page.getByRole("button", { name: "Accept description" })).toBeVisible();
	await page.getByRole("button", { name: "Accept all" }).click();
	await page.getByRole("button", { name: "Check again" }).focus();
	await page.keyboard.press("ControlOrMeta+z");
	await expect(page.getByRole("button", { name: "Accept description" })).toBeVisible();
	await page.keyboard.press("ArrowRight");
	await expect(description).toContainText("guided quickstart");
});
