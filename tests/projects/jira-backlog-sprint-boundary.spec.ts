import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("Backlog create separators match List thickness, position, and color", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1050 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("tab", { name: "List", exact: true }).click();
	const list = page.getByTestId("jira-list");
	const listControl = list.getByRole("button", { name: "Create work item after PAY-118", exact: true });
	await listControl.focus();
	const listCell = list.locator('[data-insertion-line="before"]').first();
	await expect(listCell).toBeAttached();
	const listLine = await listCell.evaluate((cell) => {
		const style = getComputedStyle(cell, "::after");
		const rect = cell.getBoundingClientRect();
		return { height: parseFloat(style.height), color: style.backgroundColor, center: rect.top + parseFloat(style.top) + parseFloat(style.height) / 2, rowTop: cell.closest("tr")!.getBoundingClientRect().top };
	});

	await page.getByRole("tab", { name: "Backlog", exact: true }).click();
	const table = page.getByRole("table", { name: "Backlog work items", exact: true });
	const parent = table.getByRole("button", { name: "PAY-118", exact: true });
	const row = parent.locator("xpath=ancestor::tr");
	await expect(parent).toBeVisible();
	const bounds = await row.boundingBox();
	if (!bounds) throw new Error("Expected a visible backlog row");
	await page.mouse.move(bounds.x + 200, bounds.y + bounds.height - 2);
	const backlogControl = page.getByRole("button", { name: "Create work item after PAY-118", exact: true });
	await expect(backlogControl).toHaveCSS("opacity", "1");
	const backlogLine = table.locator('[data-insertion-line="before"]').first();
	await expect(backlogLine).toBeAttached();
	const line = await backlogLine.evaluate((element) => {
		const style = getComputedStyle(element, "::after");
		const rect = element.getBoundingClientRect();
		return { height: parseFloat(style.height), color: style.backgroundColor, center: rect.top + parseFloat(style.top) + parseFloat(style.height) / 2 };
	});
	expect(line.height).toBe(listLine.height);
	expect(line.color).toBe(listLine.color);
	expect(Math.abs(line.center - (bounds.y + bounds.height))).toBeLessThanOrEqual(1);
	expect(Math.abs(listLine.center - listLine.rowTop)).toBeLessThanOrEqual(1);
});

test("the sprint separator keeps its split line and colors while dragging", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1050 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("tab", { name: "Backlog", exact: true }).click();
	const handle = page.getByRole("button", { name: "Move work items between sprint and backlog" });
	const preview = page.getByTestId("sprint-boundary-preview");
	const rules = handle.locator('[data-slot="sprint-boundary-rule"]');
	await expect(handle).toBeVisible();
	await page.getByRole("button", { name: "Add agent to PAY-118" }).hover();
	const tooltip = page.locator('[data-slot="tooltip-content"]').filter({ hasText: "Add agent" });
	await expect(tooltip).toBeVisible();
	const measureTooltip = (element: Element) => {
		const style = getComputedStyle(element);
		return {
			background: style.backgroundColor,
			color: style.color,
			fontSize: style.fontSize,
			padding: style.padding,
			radius: style.borderRadius,
			shadow: style.boxShadow,
		};
	};
	const tooltipAppearance = await tooltip.evaluate(measureTooltip);
	const colors = await handle.evaluate((element) => {
		const style = getComputedStyle(element);
		const resolve = (variable: string) => {
			const probe = document.createElement("span");
			probe.style.color = `var(${variable})`;
			element.append(probe);
			const color = getComputedStyle(probe).color;
			probe.remove();
			return color;
		};
		return { background: style.backgroundColor, border: resolve("--ds-border"), iconDisabled: resolve("--ds-icon-disabled"), subtlest: resolve("--ds-icon-subtlest") };
	});
	await expect(rules).toHaveCount(2);
	for (const rule of await rules.all()) {
		await expect(rule).toHaveCSS("background-color", colors.border);
		await expect(rule).toHaveCSS("mask-image", /repeating-linear-gradient\(.*3px.*9px\)/u);
	}
	await expect(handle.locator('[data-slot="icon"] svg')).toHaveCSS("color", colors.iconDisabled);
	await handle.hover();
	for (const rule of await rules.all()) await expect(rule).toHaveCSS("mask-image", "none");
	await expect(handle.locator('[data-slot="icon"] svg')).toHaveCSS("color", colors.subtlest);
	await page.mouse.move(0, 0);
	for (const rule of await rules.all()) await expect(rule).toHaveCSS("mask-image", /repeating-linear-gradient\(.*3px.*9px\)/u);
	await expect(handle.locator('[data-slot="icon"] svg')).toHaveCSS("color", colors.iconDisabled);
	expect(colors.background).toBe("rgba(0, 0, 0, 0)");
	const handleBox = await handle.boundingBox();
	const backlogRow = page.getByRole("table", { name: "Backlog work items" }).getByRole("button", { name: "PAY-118", exact: true });
	const rowBox = await backlogRow.boundingBox();
	if (!handleBox || !rowBox) throw new Error("Expected a visible separator and backlog row");
	const x = handleBox.x + handleBox.width / 2;
	await page.mouse.move(x, handleBox.y + handleBox.height / 2);
	await page.mouse.down();
	await page.mouse.move(x, rowBox.y + rowBox.height, { steps: 12 });
	await expect(preview).toBeVisible();
	const label = preview.locator("span").filter({ hasText: "work items in sprint" });
	await expect(label).toBeVisible();
	expect(await label.evaluate(measureTooltip)).toEqual(tooltipAppearance);
	expect(tooltipAppearance.shadow).toBe("none");
	await expect(handle).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
	await expect(handle).toHaveCSS("opacity", "0");
	const previewRules = preview.locator('[data-slot="sprint-boundary-rule"]');
	await expect(previewRules).toHaveCount(2);
	await expect(previewRules.nth(0)).toHaveCSS("background-color", colors.subtlest);
	await expect(previewRules.nth(1)).toHaveCSS("background-color", colors.subtlest);
	const [left, icon, right] = await Promise.all([
		previewRules.nth(0).boundingBox(),
		preview.locator('[data-slot="icon"]').boundingBox(),
		previewRules.nth(1).boundingBox(),
	]);
	if (!left || !icon || !right) throw new Error("Expected a split preview with a centered icon");
	expect(left.x + left.width).toBeLessThan(icon.x);
	expect(right.x).toBeGreaterThan(icon.x + icon.width);
	expect(left.height).toBe(1);
	await page.mouse.up();
	await expect(preview).toBeHidden();
	await expect(page.getByRole("table", { name: "Payments SDK sprint work items" }).getByRole("button", { name: "PAY-118", exact: true })).toBeVisible();
});
