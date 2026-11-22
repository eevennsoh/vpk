import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ ignoreHTTPSErrors: true });

for (const view of ["List", "Backlog"] as const) {
	test(`${view} selects a group independently, including when collapsed`, async ({ page }) => {
		await page.setViewportSize({ width: 1800, height: 1100 });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("tab", { name: view, exact: true }).click();
		await page.getByRole("button", { name: "Group", exact: true }).click();
		await page.getByRole("menuitemradio", { name: "Assignee", exact: true }).click();
		const header = page.getByRole("button", { name: "Collapse Diego Santos", exact: true }).first();
		const tableIndex = await header.evaluate((element) => [...document.querySelectorAll("table")].indexOf(element.closest("table")!));
		const table = page.locator("table").nth(tableIndex);
		const group = table.getByRole("checkbox", { name: "Select all work items in Diego Santos", exact: true });
		const first = table.getByRole("checkbox", { name: "Select PAY-118", exact: true });
		const second = table.getByRole("checkbox", { name: "Select PAY-130", exact: true });
		const other = table.getByRole("checkbox", { name: "Select PAY-127", exact: true });
		const [groupBox, selectAllBox] = await Promise.all([group.boundingBox(), table.getByRole("checkbox", { name: /Select all work items/ }).first().boundingBox()]);
		if (!groupBox || !selectAllBox) throw new Error("Expected visible selection controls");
		expect(Math.abs(groupBox.x - selectAllBox.x)).toBeLessThanOrEqual(1);
		await page.mouse.move(0, 0);
		await expect(group).toHaveCSS("opacity", "0");
		await header.hover();
		await expect(group).toHaveCSS("opacity", "1");
		await other.check();
		await group.check();
		await expect(first).toBeChecked();
		await expect(second).toBeChecked();
		await expect(other).toBeChecked();
		await page.mouse.move(0, 0);
		await expect(group).toHaveCSS("opacity", "0");
		await header.focus();
		await page.keyboard.press("Shift+Tab");
		await expect(group).toBeFocused();
		await expect(group).toHaveCSS("opacity", "1");
		await first.uncheck();
		await expect(group).toHaveAttribute("aria-checked", "mixed");
		await header.click();
		await group.click();
		await expect(group).toBeChecked();
		await group.click();
		await expect(group).not.toBeChecked();
		await table.getByRole("button", { name: "Expand Diego Santos", exact: true }).click();
		await expect(first).not.toBeChecked();
		await expect(second).not.toBeChecked();
		await expect(other).toBeChecked();
	});
}
