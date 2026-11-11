import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test.use({ ignoreHTTPSErrors: true });

test("standalone selected agents keep a 4px gap between favorite and check", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/agent-selector#standalone-picker"));
	const examples = page.locator("#standalone-picker [data-agent-selector-demo=standalone]");
	for (const [index, agentId] of ["github-copilot", "ai-insights-agent"].entries()) {
		const row = examples.nth(index).locator(`[data-slot=command-item][data-value="${agentId}"]`);
		const favorite = row.locator("[data-favorite-id]");
		const check = row.locator(":scope > div > [data-slot=icon-tile]");
		await expect(row).toBeVisible();
		const [starBounds, checkBounds] = await Promise.all([favorite.boundingBox(), check.boundingBox()]);
		if (!starBounds || !checkBounds) throw new Error("Selected agent controls are not rendered");
		expect(checkBounds.x - starBounds.x - starBounds.width).toBe(4);
	}
});

test("Rovo CLI configures its directory separately from selecting the agent", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.addInitScript(() => {
		window.localStorage.removeItem("jira-local-agent-last-used");
		window.localStorage.removeItem("butter-local-agent-workspaces");
	});
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent & app selector" }).click();
	const local = page.getByRole("region", { name: "Jira Local Agent" });
	const row = local.getByRole("button", { name: "Rovo CLI", exact: true });
	await row.hover();
	await expect(page.getByRole("dialog", { name: "Rovo CLI local options" })).toHaveCount(0);
	const configure = local.getByRole("button", { name: "Configure Rovo CLI" });
	await configure.focus();
	await page.keyboard.press("Enter");
	const menu = page.getByRole("dialog", { name: "Rovo CLI local options" });
	const directory = menu.getByRole("textbox", { name: "Choose your directory" });
	await expect(directory).toBeVisible();
	await page.keyboard.press("Tab");
	await expect(directory).toBeFocused();
	await expect(menu.getByRole("button", { name: "Open in Rovo CLI" })).toHaveCount(0);
	expect(await page.evaluate(() => window.localStorage.getItem("jira-local-agent-last-used"))).toBeNull();
	await directory.fill("/tmp/rovo-config-test");
	await directory.press("ArrowLeft");
	await expect(menu).toBeVisible();
	await directory.press("Enter");
	await page.keyboard.press("Escape");
	await expect(page.getByRole("dialog", { name: "Codebase workspaces" })).toHaveCount(0);
	await page.keyboard.press("Escape");
	await expect(menu).toHaveCount(0);
	await expect(configure).toBeFocused();
	await configure.click();
	await expect(page.getByRole("textbox", { name: "Choose your directory" })).toHaveValue("/tmp/rovo-config-test");
	await page.keyboard.press("Escape");
	await row.evaluate((element) => element.setAttribute("data-test-preserved", "yes"));
	await row.click();
	const copied = local.getByRole("button", { name: "Command copied", exact: true });
	const success = copied.locator(".text-icon-success svg");
	await expect(copied).toBeVisible();
	await expect(copied).toHaveAttribute("data-test-preserved", "yes");
	await expect(success).toHaveCSS("width", "16px");
	await expect(success).toHaveCSS("height", "16px");
	await expect.poll(async () => {
		const bounds = await success.boundingBox();
		return bounds ? [Math.round(bounds.width), Math.round(bounds.height)] : null;
	}).toEqual([16, 16]);
	await expect.poll(() => page.evaluate(() => window.localStorage.getItem("jira-local-agent-last-used"))).toContain("rovo-cli");
	await expect(page.getByRole("dialog", { name: "Rovo CLI local options" })).toHaveCount(0);
});

test("Rovo CLI copy feedback reaches its full size with reduced motion", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent & app selector" }).click();
	const local = page.getByRole("region", { name: "Jira Local Agent" });
	await local.getByRole("button", { name: "Rovo CLI", exact: true }).click();
	const success = local.getByRole("button", { name: "Command copied", exact: true }).locator(".text-icon-success svg");
	await expect(success).toHaveCSS("width", "16px");
	await expect(success).toHaveCSS("height", "16px");
	await expect.poll(async () => {
		const bounds = await success.boundingBox();
		return bounds ? [Math.round(bounds.width), Math.round(bounds.height)] : null;
	}).toEqual([16, 16]);
});

for (const presentation of ["submenu", "inline"] as const) {
	test(`Rovo CLI ${presentation} workspace icons use their intended sizes`, async ({ page }) => {
		await page.addInitScript(() => window.localStorage.setItem("butter-local-agent-workspaces", JSON.stringify(JSON.stringify({ paths: ["/example/project"], selected: null }))));
		await page.goto(appUrl("/components/blocks/jira-local-agent"));
		if (presentation === "inline") await page.getByRole("button", { name: "Inline expand" }).click();
		await page.getByRole("button", { name: "Open local agent" }).click();
		const local = page.getByRole("dialog", { name: "Local software agents" });
		if (presentation === "inline") await local.getByRole("button", { name: "Rovo CLI", exact: true }).click();
		else await local.getByRole("button", { name: "Configure Rovo CLI" }).click();
		const menu = page.locator("[data-butter-local-menu]");
		if (presentation === "inline") {
			const screen = menu.getByRole("button", { name: "Open in Rovo CLI" }).locator("svg").first();
			await expect(screen).toHaveCSS("width", "16px");
			await expect(screen).toHaveCSS("height", "16px");
		} else {
			await expect(menu.getByRole("button", { name: "Open in Rovo CLI" })).toHaveCount(0);
		}
		const chevron = menu.locator("[data-slot=input-group-addon] svg");
		await menu.getByRole("textbox", { name: "Choose your directory" }).click();
		const workspaces = page.getByRole("dialog", { name: "Codebase workspaces" });
		const add = workspaces.getByRole("button", { name: "Add workspace" }).locator("svg");
		const noWorkspace = workspaces.getByRole("button", { name: "No workspace" });
		const savedWorkspace = workspaces.getByRole("button", { name: "/example/project", exact: true });
		const remove = workspaces.locator('[aria-label="Remove /example/project"] svg');
		for (const icon of [add, noWorkspace.locator("svg").nth(0), savedWorkspace.locator("svg"), remove]) {
			await expect(icon).toHaveCSS("width", "16px");
			await expect(icon).toHaveCSS("height", "16px");
		}
		await expect(chevron).toHaveCSS("width", "12px");
		await expect(chevron).toHaveCSS("height", "12px");
		await expect(noWorkspace.locator("svg").nth(1)).toHaveCSS("width", "12px");
		await expect(noWorkspace.locator("svg").nth(1)).toHaveCSS("height", "12px");
		await savedWorkspace.click();
		await menu.getByRole("textbox", { name: "Choose your directory" }).click();
		const selected = workspaces.getByRole("button", { name: "/example/project", exact: true });
		await expect(selected).toHaveAttribute("aria-current", "true");
		await expect(selected.locator("..").locator(":scope > span svg")).toHaveCSS("width", "12px");
		await expect(selected.locator("..").locator(":scope > span svg")).toHaveCSS("height", "12px");
	});
}

test("selected workspace delete control and checkmark do not overlap", async ({ page }) => {
	const path = "/Users/example/a-very-long-workspace-name-for-checking-the-layout";
	await page.addInitScript((workspace) => window.localStorage.setItem("butter-local-agent-workspaces", JSON.stringify(JSON.stringify({ paths: [workspace], selected: workspace }))), path);
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent & app selector" }).click();
	await page.getByRole("button", { name: "Configure Rovo CLI" }).click();
	await page.getByRole("textbox", { name: "Choose your directory" }).click();
	const menu = page.getByRole("dialog", { name: "Codebase workspaces" });
	const selected = menu.getByRole("button", { name: path, exact: true });
	await selected.hover();
	const remove = menu.getByRole("button", { name: `Remove ${path}` });
	const check = selected.locator("..").locator(":scope > span svg");
	await expect(selected).toHaveAttribute("aria-current", "true");
	await expect(selected).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
	await expect(selected.locator("..")).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
	await expect(remove).toBeVisible();
	await expect(check).toBeVisible();
	const [removeBounds, checkBounds] = await Promise.all([remove.boundingBox(), check.boundingBox()]);
	if (!removeBounds || !checkBounds) throw new Error("Selected workspace controls are not rendered");
	expect(checkBounds.x).toBeGreaterThanOrEqual(removeBounds.x + removeBounds.width);
	await remove.focus();
	await page.keyboard.press("Enter");
	await expect(selected).toHaveCount(0);
});

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

for (const recentAgent of [false, true]) {
	test(`local agent heading matches the cloud heading${recentAgent ? " with a recent agent" : ""}`, async ({ page }) => {
		await page.addInitScript((recent) => {
			if (recent) window.localStorage.setItem("jira-local-agent-last-used", JSON.stringify("claude-code"));
			else window.localStorage.removeItem("jira-local-agent-last-used");
		}, recentAgent);
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("button", { name: "Select Agent & app selector" }).click();
		const cloud = page.getByRole("region", { name: "Project Butter agent selector" });
		const local = page.getByRole("region", { name: "Jira Local Agent" });
		const style = (element: Element) => {
			const computed = getComputedStyle(element);
			return { padding: computed.padding, lineHeight: computed.lineHeight, height: element.getBoundingClientRect().height };
		};
		const reference = await cloud.getByText("Other agents", { exact: true }).evaluate(style);
		const heading = local.getByRole("heading", { name: "Open in" });
		await expect(heading).toHaveCount(1);
		expect(await heading.evaluate(style)).toEqual(reference);
	});
}

test("Jira Local Agent keeps the recent agent close to its separator", async ({ page }) => {
	await page.addInitScript(() => window.localStorage.setItem("jira-local-agent-last-used", JSON.stringify("claude-code")));
	await page.goto(appUrl("/components/blocks/jira-local-agent"));
	await page.getByRole("button", { name: "Open local agent" }).click();
	const popup = page.getByRole("dialog", { name: "Local software agents" });
	const gaps = await popup.evaluate((menu) => {
		const options = menu.querySelectorAll('[data-agent-id]');
		const separator = menu.querySelector("hr");
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
		const lastAgent = Array.from(menu.querySelectorAll('[data-agent-id]')).at(-1);
		const separator = Array.from(menu.querySelectorAll("hr")).at(-1);
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


test("agent selector exposes its native scrollbar when the list overflows", async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/agent-selector"));
	const list = page.locator("[data-slot=command-list]");
	await expect(list).toBeVisible();
	const before = await list.evaluate((element) => ({
		clientHeight: element.clientHeight,
		scrollHeight: element.scrollHeight,
		scrollbarWidth: getComputedStyle(element).scrollbarWidth,
	}));
	expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);
	expect(before.scrollbarWidth).not.toBe("none");
	await list.hover();
	await page.mouse.wheel(0, 240);
	await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});
