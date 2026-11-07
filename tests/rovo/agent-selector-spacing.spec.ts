import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test.use({ ignoreHTTPSErrors: true });

test("agent favorites reveal on hover or keyboard focus, not lingering pointer focus", async ({ page }) => {
	await page.goto(appUrl("/sandbox/agent-selector-canvas"));
	const favorite = page.locator('[data-favorite-id="jira-coding"]').first();
	const agent = favorite.locator("..").getByRole("button", { name: "Jira Coding Agent", exact: true });
	await agent.click();
	await page.mouse.move(0, 0);
	await expect(agent).toBeFocused();
	await expect(favorite).toHaveCSS("opacity", "0");
	await page.keyboard.press("Tab");
	await expect(favorite).toBeFocused();
	await expect(favorite).toHaveCSS("opacity", "1");
});

test("editor palette search uses a compact input with equal insets", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/editor-palette#search"));
	const search = page.getByRole("textbox", { name: "Search tools", exact: true });
	await expect(search).toBeVisible();
	const geometry = await search.evaluate((input) => {
		const menu = input.closest(".rich-text-command-menu");
		const row = menu?.querySelector("[role=option]");
		const header = input.parentElement;
		if (!menu || !row || !header) throw new Error("Missing search palette or first row");
		const bounds = menu.getBoundingClientRect();
		const field = header.getBoundingClientRect();
		const item = row.getBoundingClientRect();
		return {
			height: field.height,
			gaps: [item.top - field.bottom, field.left - bounds.left, bounds.right - field.right],
		};
	});
	expect(geometry).toEqual({ height: 32, gaps: [4, 4, 4] });
	await search.fill("Sentry");
	await expect(page.getByRole("listbox", { name: "Search tools" })).toContainText("Sentry");
});

for (const route of ["/components/projects/sidebar-chat", "/components/blocks/agent-selector"]) {
	test(`${route} uses palette search with equal row insets`, async ({ page }) => {
		await page.goto(appUrl(route));
		if (route.endsWith("sidebar-chat")) {
			await page.getByRole("button", { name: "Select Rovo agent" }).click();
		}
		const selector = page.locator("[data-slot=command]").first();
		const search = selector.locator(".rich-text-command-menu-search");
		await expect(search).toBeVisible();
		const gaps = await selector.evaluate((menu) => {
			const headerElement = menu.querySelector(".rich-text-command-menu-search");
			const rowElement = menu.querySelector("[cmdk-item]");
			if (!headerElement || !rowElement) throw new Error("Missing search or agent row");
			const header = headerElement.getBoundingClientRect();
			const row = rowElement.getBoundingClientRect();
			const bounds = menu.getBoundingClientRect();
			return [row.top - header.bottom, row.left - bounds.left, bounds.right - row.right];
		});
		expect(gaps).toEqual([4, 4, 4]);
		const input = search.getByPlaceholder("Search agents");
		await input.fill("Code Reviewer");
		await expect(selector.locator("[cmdk-item]")).toHaveCount(1);
		await input.press("ArrowDown");
		await input.press("Enter");
		if (route.endsWith("sidebar-chat")) {
			await expect(page.getByRole("button", { name: "Select Code Reviewer", exact: true })).toBeVisible();
		}
	});
}
