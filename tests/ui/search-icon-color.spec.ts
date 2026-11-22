import { expect, test, type Locator } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

async function expectSubtlest(icon: Locator) {
	await expect(icon).toBeVisible();
	const colors = await icon.evaluate((element) => {
		const style = getComputedStyle(element);
		const context = document.createElement("canvas").getContext("2d");
		if (!context) throw new Error("Cannot compare icon colors");
		context.fillStyle = style.getPropertyValue("--ds-icon-subtlest").trim();
		const token = context.fillStyle;
		context.fillStyle = style.color;
		return { token, actual: context.fillStyle };
	});
	expect(colors.actual).toBe(colors.token);
}

for (const theme of ["light", "dark"] as const) {
	test(`board navigation, filter, and agent picker use subtlest search icons (${theme})`, async ({ page }) => {
		await page.goto(appUrl("/butter-v1"));
		if (theme === "dark") await page.getByRole("button", { name: "Cycle theme, current theme: Light" }).click();
		for (const name of ["Search", "Search board"]) {
			const input = page.getByRole("searchbox", { name, exact: true });
			const group = input.locator('xpath=ancestor::div[@data-slot="input-group"][1]');
			await expectSubtlest(group.locator('[data-slot="input-group-addon"][data-align="inline-start"] svg').first());
		}
		await page.getByRole("button", { name: "Filter board", exact: true }).click();
		const filterSearch = page.getByRole("textbox", { name: "Add filter" });
		await expectSubtlest(filterSearch.locator('xpath=ancestor::div[@data-slot="dropdown-menu-search"][1]').locator('[data-slot="dropdown-menu-search-icon"] svg').first());
		await filterSearch.press("Escape");
		const issue = page.locator('[data-issue-key="PAY-107"][data-board-column-title]');
		await issue.getByText("Move retry and backoff out of LegacyGatewayAdapter", { exact: true }).hover();
		await issue.getByRole("button", { name: "Add agent to PAY-107" }).click();
		const agentSearch = page.getByRole("dialog", { name: "Agents" }).getByRole("textbox", { name: "Search agents" });
		await expectSubtlest(agentSearch.locator('xpath=ancestor::div[@data-slot="dropdown-menu-search"][1]').locator('[data-slot="dropdown-menu-search-icon"] svg').first());
	});
}

test("editor palette uses the subtlest search icon and retains the Rovo logo", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/editor-palette#search"));
	const search = page.locator("#search").getByRole("textbox", { name: "Search tools" });
	await expectSubtlest(search.locator('xpath=ancestor::div[@data-slot="dropdown-menu-search"][1]').locator('[data-slot="dropdown-menu-search-icon"] svg').first());
	const rovo = page.getByRole("textbox", { name: "Ask Rovo" }).first().locator('xpath=ancestor::div[@data-slot="dropdown-menu-search"][1]').locator('[data-slot="dropdown-menu-search-icon"] svg');
	const fills = await rovo.locator("path").evaluateAll((paths) => [...new Set(paths.map((path) => path.getAttribute("fill")))]);
	expect(fills.length).toBeGreaterThan(1);
});
