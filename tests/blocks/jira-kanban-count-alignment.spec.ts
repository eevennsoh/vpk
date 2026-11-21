import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("collapsed and expanded board column counts share a centerline", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Filter board", exact: true }).click();
	await page.getByRole("menuitemcheckbox", { name: "Needs input", exact: true }).click();
	await page.keyboard.press("Escape");
	const collapsed = page.locator('[data-jira-kanban-column="To do"]');
	const expanded = page.locator('[data-jira-kanban-column="In progress"]');
	await expect(collapsed).toHaveAttribute("data-collapsed", "true");
	const collapsedCount = collapsed.getByRole("button", { name: "Expand To do column" }).locator("..").locator(":scope > span");
	const expandedCount = expanded.locator("[data-board-column-count]");
	await expect(collapsedCount).toHaveText("0");
	await expect(expandedCount).toBeVisible();
	await expect.poll(async () => {
		const [left, right] = await Promise.all([collapsedCount.boundingBox(), expandedCount.boundingBox()]);
		return left && right ? Math.abs(left.y + left.height / 2 - right.y - right.height / 2) : Infinity;
	}).toBeLessThan(0.5);
});
