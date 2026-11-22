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

test("the Agent swimlane header shares the session count's vertical center", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.setViewportSize({ width: 960, height: 900 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Group", exact: true }).click();
	await page.getByRole("menuitemradio", { name: "Agent", exact: true }).click();

	const sessionCount = page.locator("[data-agent-session-column-count]");
	const laneHeader = page.locator("[data-board-swimlane]").first().getByRole("button", { name: /, \d+ work items?$/ });
	await expect(sessionCount).toBeVisible();
	await expect(laneHeader).toBeVisible();
	const centerOffset = async () => {
		const [count, header] = await Promise.all([sessionCount.boundingBox(), laneHeader.boundingBox()]);
		return count && header ? Math.abs(count.y + count.height / 2 - header.y - header.height / 2) : Infinity;
	};
	await expect.poll(centerOffset).toBeLessThan(0.5);

	const board = page.locator("[data-jira-kanban-scrollport]");
	await board.evaluate((element) => {
		element.scrollLeft = element.scrollWidth;
		element.scrollTop = 100;
	});
	const railSurface = page.locator("[data-agent-session-column-surface]").filter({ has: sessionCount });
	await expect(railSurface).toHaveClass(/\bbg-surface-overlay\b/);
	await expect.poll(centerOffset).toBeLessThan(0.5);
});
