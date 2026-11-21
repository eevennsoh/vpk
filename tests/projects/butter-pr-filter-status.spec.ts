import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("pull request filters follow the board status order and colors", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Filter board", exact: true }).click();
	await page.getByRole("menuitem", { name: "Pull request Open submenu", exact: true }).hover();
	const menu = page.getByRole("menu", { name: "Pull request filter options" });
	const rows = menu.getByRole("menuitemcheckbox");
	await expect(rows).toHaveText(["Draft", "Open", "Failed", "Merged"]);
	const icons = rows.locator("svg");
	await expect(icons).toHaveCount(4);
	const presentations = await icons.evaluateAll((elements) => elements.map((element) => ({
		color: getComputedStyle(element).color,
		shape: element.innerHTML,
	})));
	const tokenColors = await menu.evaluate((element) => {
		const probe = document.createElement("span");
		element.appendChild(probe);
		const colors = ["--ds-icon-subtle", "--ds-icon-accent-lime", "--ds-icon-danger", "--ds-icon-accent-purple"].map((token) => {
			probe.style.color = `var(${token})`;
			return getComputedStyle(probe).color;
		});
		probe.remove();
		return colors;
	});
	expect(presentations.map(({ color }) => color)).toEqual(tokenColors);
	expect(presentations[0].shape).toBe(presentations[1].shape);
	expect(presentations[2].shape).not.toBe(presentations[1].shape);
	expect(presentations[3].shape).not.toBe(presentations[2].shape);
});
