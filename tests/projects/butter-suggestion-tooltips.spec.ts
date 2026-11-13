import { expect, test, type Locator } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

async function expectTooltipAbovePanel(tooltip: Locator, panel: Locator) {
	await expect(tooltip).toBeVisible();
	const panelBox = await panel.boundingBox();
	const tooltipBox = await tooltip.boundingBox();
	if (!panelBox || !tooltipBox) throw new Error("Suggestion panel or tooltip is not visible");
	const left = Math.max(panelBox.x, tooltipBox.x);
	const right = Math.min(panelBox.x + panelBox.width, tooltipBox.x + tooltipBox.width);
	const top = Math.max(panelBox.y, tooltipBox.y);
	const bottom = Math.min(panelBox.y + panelBox.height, tooltipBox.y + tooltipBox.height);
	expect(right).toBeGreaterThan(left);
	expect(bottom).toBeGreaterThan(top);
	await expect.poll(() => tooltip.evaluate((element, point) => element.contains(document.elementFromPoint(point.x, point.y)), { x: (left + right) / 2, y: (top + bottom) / 2 })).toBe(true);
}

test("suggestion tooltips remain above the panel on hover and keyboard focus", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	await expect(page.getByRole("button", { name: /^\d+ suggestions$/ })).toHaveAttribute("aria-expanded", "true");
	const panel = page.locator('[aria-label="Work item suggestions"]');
	await expect(panel).toBeVisible();
	const tooltip = page.locator('[data-slot="tooltip-content"]');
	for (const [name, label] of [["Check for new suggestions", "Check again"], ["Show as list", "Show all"], ["Close suggestions", "Close"]] as const) {
		await page.getByRole("button", { name }).hover();
		await expect(tooltip).toHaveText(label);
		await expectTooltipAbovePanel(tooltip, panel);
	}
	await page.mouse.move(0, 0);
	await page.getByRole("button", { name: "Show as list" }).focus();
	await page.keyboard.press("Tab");
	await expect(page.getByRole("button", { name: "Check for new suggestions" })).toBeFocused();
	await expect(tooltip).toHaveText("Check again");
	await expectTooltipAbovePanel(tooltip, panel);
	await page.getByRole("button", { name: "Show as list" }).click();
	await page.getByRole("list", { name: "Suggestions" }).getByRole("button", { name: "Dismiss description" }).hover();
	await expect(tooltip).toHaveText("Dismiss");
	await expectTooltipAbovePanel(tooltip, panel);
});
