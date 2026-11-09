import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test.use({ ignoreHTTPSErrors: true });

test("inline Rovo CLI aligns its action and directory label to the agent avatar", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/jira-local-agent"));
	await page.getByRole("button", { name: "Inline expand" }).click();
	await page.getByRole("button", { name: "Open local agent" }).click();
	const agent = page.locator('[data-agent-id="rovo-cli"]');
	await agent.click();
	const menu = page.locator("[data-butter-local-menu]");
	const [avatar, icon, label] = await Promise.all([
		agent.locator('[aria-hidden="true"]').first().boundingBox(),
		menu.getByRole("button", { name: "Open in Rovo CLI" }).locator("svg").first().boundingBox(),
		menu.getByText("Choose your directory").boundingBox(),
	]);
	if (!avatar || !icon || !label) throw new Error("Missing Rovo CLI alignment elements");
	expect(Math.abs(label.x - avatar.x)).toBeLessThan(0.5);
	expect(Math.abs(icon.x + icon.width / 2 - avatar.x - avatar.width / 2)).toBeLessThan(0.5);
});

test("Jira Local Agent keeps the recent agent close to its separator", async ({ page }) => {
	await page.addInitScript(() => window.localStorage.setItem("jira-local-agent-last-used", JSON.stringify("claude-code")));
	await page.goto(appUrl("/components/blocks/jira-local-agent"));
	await page.getByRole("button", { name: "Open local agent" }).click();
	const popup = page.getByRole("dialog", { name: "Local software agents" });
	const gaps = await popup.evaluate((menu) => {
		const options = menu.querySelectorAll('[role="option"]');
		const separator = menu.querySelector('[role="separator"]');
		if (!options[0] || !options[1] || !separator) throw new Error("Missing recent agent or separator");
		return [separator.getBoundingClientRect().top - options[0].getBoundingClientRect().bottom, options[1].getBoundingClientRect().top - separator.getBoundingClientRect().bottom];
	});
	expect(gaps).toEqual([4, 4]);
});

test("Jira Local Agent footer has equal spacing around its separator", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/jira-local-agent"));
	await page.getByRole("button", { name: "Open local agent" }).click();
	const popup = page.getByRole("dialog", { name: "Local software agents" });
	const gaps = await popup.evaluate((menu) => {
		const lastAgent = Array.from(menu.querySelectorAll('[role="option"]')).at(-1);
		const separator = Array.from(menu.querySelectorAll('[role="separator"]')).at(-1);
		const copy = menu.querySelector('[aria-label="Copy prompt"]');
		if (!lastAgent || !separator || !copy) throw new Error("Missing local agent menu content");
		return [separator.getBoundingClientRect().top - lastAgent.getBoundingClientRect().bottom, copy.getBoundingClientRect().top - separator.getBoundingClientRect().bottom];
	});
	expect(gaps).toEqual([4, 4]);
	const copyIcon = popup.getByRole("button", { name: "Copy prompt" }).locator("svg").first();
	const size = await copyIcon.evaluate((icon) => {
		const { width, height } = icon.getBoundingClientRect();
		return { width, height };
	});
	expect(size).toEqual({ width: 16, height: 16 });
});

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
