import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test("the development panel omits Open in in both states", async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/development-panel"));
	const panel = page.getByRole("region", { name: "Development" });
	for (const state of ["Before setup", "Pull requests created"]) {
		await page.getByRole("button", { name: state }).click();
		await expect(panel.getByRole("button", { name: "Open in", exact: true })).toHaveCount(0);
		await expect(panel.getByRole("button", { name: "Start coding" })).toBeAttached();
	}
});

test("start coding opens the same menu before and after pull requests are created", async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/development-panel"));
	const panel = page.getByRole("region", { name: "Development" });
	const items = ["Bitbucket Cloud", "GitHub", "Copy create branch command", "Copy create commit command", "Copy work item key"];
	for (const state of ["Before setup", "Pull requests created"]) {
		await page.getByRole("button", { name: state }).click();
		const trigger = panel.getByRole("button", { name: "Start coding" });
		await trigger.click();
		const menu = page.getByRole("menu", { name: "Start coding" });
		await expect(menu).toBeVisible();
		await expect(menu).toHaveCSS("border-radius", "8px");
		for (const name of items) await expect(menu.getByRole("menuitem", { name, exact: true })).toBeVisible();
		await expect(menu.getByRole("menuitem", { name: "Branch name settings" })).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(menu).not.toBeVisible();
		await expect(trigger).toBeFocused();
	}
});

test("development rows align their icons and labels with the heading", async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/development-panel"));
	const panel = page.getByRole("region", { name: "Development" });
	const startCoding = panel.getByRole("button", { name: "Start coding" });
	await expect(panel.getByRole("button", { name: "Copy prompt" })).toHaveCount(0);
	const emptyPositions = await startCoding.evaluate((element) => {
		const icon = element.querySelector("svg");
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
		let text = walker.nextNode();
		while (text && !text.textContent?.trim()) text = walker.nextNode();
		const range = document.createRange();
		if (text) range.selectNodeContents(text);
		return { icon: icon?.getBoundingClientRect().left, label: text ? range.getBoundingClientRect().left : undefined };
	});
	await page.getByRole("button", { name: "Pull requests created" }).click();

	const heading = await panel.getByRole("heading", { name: "Development" }).boundingBox();
	const rows = panel.getByRole("button").filter({ hasText: /#\d+|View development activity/ });
	await expect(rows).toHaveCount(4);
	const positions = await rows.evaluateAll((elements) => elements.map((element) => {
		const icon = element.querySelector("svg");
		const iconSlot = element.querySelector<HTMLElement>('[data-slot="icon"]');
		const label = element.querySelector<HTMLElement>(":scope > span:last-child");
		return { icon: icon?.getBoundingClientRect().left, iconSlot: iconSlot?.getBoundingClientRect().left, label: label?.getBoundingClientRect().left };
	}));
	if (!heading || positions[0]?.icon == null || positions[0]?.label == null) throw new Error("Development rows did not render");
	expect(emptyPositions.icon).toBeCloseTo(positions[0].icon, 0);
	expect(emptyPositions.label).toBeCloseTo(positions[0].label, 0);
	for (const position of positions) {
		expect(position.iconSlot).toBeCloseTo(heading.x, 0);
		expect(position.icon).toBeCloseTo(positions[0].icon, 0);
		expect(position.label).toBeCloseTo(positions[0].label, 0);
	}
	await expect(panel.getByRole("button", { name: "Copy prompt" })).toHaveCount(0);
});

test("start coding menu uses compact icons and a GitHub app tile", async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/development-panel"));
	await page.getByRole("button", { name: "Pull requests created" }).click();
	await page.getByRole("button", { name: "Start coding" }).click();
	const menu = page.getByRole("menu", { name: "Start coding" });
	for (const name of ["Copy create branch command", "Copy create commit command", "Copy work item key", "Branch name settings"]) {
		const item = menu.getByRole("menuitem", { name });
		const slot = await item.locator(":scope > span:first-child").boundingBox();
		const icon = await item.locator(":scope > span:first-child svg").boundingBox();
		expect(slot?.width).toBeCloseTo(16, 1);
		expect(slot?.height).toBeCloseTo(16, 1);
		expect(icon?.width).toBeCloseTo(12, 1);
		expect(icon?.height).toBeCloseTo(12, 1);
	}
	const github = menu.getByRole("menuitem", { name: "GitHub", exact: true });
	const githubGeometry = await github.evaluate((row) => {
		const slot = row.querySelector(":scope > span:first-child");
		const tile = [...(slot?.querySelectorAll("span") ?? [])].find((span) => parseFloat(getComputedStyle(span).borderTopWidth) > 0);
		const icon = tile?.querySelector("svg");
		const rect = (element: Element | null | undefined) => {
			if (!element) return null;
			const bounds = element.getBoundingClientRect();
			return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, width: bounds.width, height: bounds.height };
		};
		return { row: rect(row), slot: rect(slot), tile: rect(tile), icon: rect(icon) };
	});
	const { row, slot, tile, icon } = githubGeometry;
	if (!row || !slot || !tile || !icon) throw new Error("GitHub logo did not render");
	expect(tile.width).toBeCloseTo(16, 1);
	expect(tile.height).toBeCloseTo(16, 1);
	for (const part of [slot, tile, icon]) {
		expect(part.x).toBeCloseTo(slot.x, 1);
		expect(part.y).toBeCloseTo(row.y, 1);
	}
});

test("Configure combines automation with the complete Connections submenu", async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/development-panel"));
	await page.getByRole("button", { name: "Pull requests created" }).click();
	await page.getByRole("button", { name: "Start coding" }).click();
	const menu = page.getByRole("menu", { name: "Start coding" });
	const inset = await menu.evaluate((element) => getComputedStyle(element).padding);
	await page.keyboard.press("Escape");
	await expect(page.getByRole("button", { name: "Pull request settings", exact: true })).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Development settings", exact: true })).toHaveCount(0);
	const configure = page.getByRole("button", { name: "Configure", exact: true });
	await expect(configure).toHaveCount(1);
	await configure.click();
	const settings = page.getByRole("menu", { name: "Configure", exact: true });
	await expect(settings).toHaveCSS("padding", inset);
	await expect(settings.getByRole("menuitemcheckbox")).toHaveText(["Auto-fix PR", "Merge when ready", "Auto-archive on merge or close"]);
	await expect(settings.getByRole("separator")).toHaveCount(1);
	const connections = settings.getByRole("menuitem", { name: "Connections", exact: true });
	await expect(connections.locator("svg")).toBeVisible();
	await connections.hover();
	const submenu = page.getByRole("dialog", { name: "Connections", exact: true });
	await expect(submenu).toBeVisible();
	await expect(submenu).toHaveCSS("padding", inset);
	for (const label of ["Code repositories", "Agents"]) {
		await expect(submenu.getByRole("heading", { name: label, exact: true })).toBeVisible();
	}
	for (const label of ["Bitbucket", "GitHub for Atlassian", "GitLab for Jira Cloud", "Jira Coding Agent", "GitHub Copilot for Jira", "Cursor", "Claude Agent for Jira"]) {
		const name = submenu.getByText(label, { exact: true });
		await expect(name).toBeVisible();
		await expect(name.locator("..")).toHaveCSS("height", "32px");
	}
	await expect(submenu.getByRole("img", { name: "Connected", exact: true })).toHaveCount(4);
	await expect(submenu.getByRole("button", { name: /^Request / })).toHaveCount(3);
	await submenu.getByRole("button", { name: "Request GitLab for Jira Cloud" }).hover();
	await expect(submenu).toBeVisible();
	await expect(submenu.getByRole("button", { name: "Manage connections" })).toBeVisible();
	await submenu.getByRole("button", { name: "Request GitLab for Jira Cloud" }).focus();
	await page.keyboard.press("Escape");
	await expect(submenu).toBeHidden();
	await expect(settings).toBeVisible();
	await expect(connections).toBeFocused();
	await page.keyboard.press("ArrowRight");
	await expect(submenu).toBeVisible();
	await page.keyboard.press("Tab");
	await expect(submenu.getByRole("button", { name: "Request GitLab for Jira Cloud" })).toBeFocused();
	await page.keyboard.press("Escape");
	await page.keyboard.press("Escape");
	await expect(settings).toBeHidden();
	await expect(configure).toBeFocused();
});

test("automation defaults are enabled and choices persist across development panel states", async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/development-panel"));
	const panel = page.getByRole("region", { name: "Development" });
	const settingsButton = panel.getByRole("button", { name: "Configure", exact: true });
	await settingsButton.click();
	const settings = page.getByRole("menu", { name: "Configure", exact: true });
	for (const name of ["Auto-fix PR", "Merge when ready", "Auto-archive on merge or close"]) {
		const defaultChecked = name !== "Auto-archive on merge or close";
		const option = settings.getByRole("menuitemcheckbox", { name });
		const row = option;
		await expect(row).toHaveCSS("height", "32px");
		await expect(option).toHaveAttribute("aria-checked", String(defaultChecked));
		await row.hover({ position: { x: 4, y: 20 } });
		await expect(row).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
		await row.click({ position: { x: 150, y: 20 } });
		await expect(option).toHaveAttribute("aria-checked", String(!defaultChecked));
		const rowBox = await row.boundingBox();
		if (!rowBox) throw new Error("Settings row did not render");
		await row.click({ position: { x: rowBox.width - 14, y: 20 } });
		await expect(option).toHaveAttribute("aria-checked", String(defaultChecked));
		await row.click({ position: { x: 150, y: 20 } });
		await expect(option).toHaveAttribute("aria-checked", String(!defaultChecked));
	}
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "Pull requests created" }).click();
	await settingsButton.press("Enter");
	for (const name of ["Auto-fix PR", "Merge when ready", "Auto-archive on merge or close"]) {
		await expect(settings.getByRole("menuitemcheckbox", { name })).toHaveAttribute("aria-checked", String(name === "Auto-archive on merge or close"));
	}
	await expect(settings.getByRole("menuitemcheckbox", { name: "Auto-fix PR" })).toBeFocused();
	await page.keyboard.press("Space");
	await expect(settings.getByRole("menuitemcheckbox", { name: "Auto-fix PR" })).toBeChecked();
	await expect(settings.getByRole("menuitemcheckbox", { name: "Merge when ready" })).not.toBeChecked();
});

test("non-merged pull requests show a compact CI summary without check details", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/preview/blocks/development-panel"));
	await page.getByRole("button", { name: "Pull requests created" }).click();
	const panel = page.getByRole("region", { name: "Development" });
	const open = panel.getByRole("button", { name: /#1306 Add guest checkout/u });
	const merged = panel.getByRole("button", { name: /#1847 Fix threaded/u });
	await expect(open).toContainText("1/3 builds passed");
	await expect(open).toContainText("checks running");
	await expect(open).not.toContainText("Lint and typecheck");
	const progress = open.locator('[data-slot="progress-circle"]');
	await expect(progress).toHaveCount(1);
	await expect(progress.locator("circle")).toHaveCount(2);
	const icon = await open.locator(':scope > [data-slot="icon"]').boundingBox();
	const text = await open.locator(":scope > span:last-child").boundingBox();
	if (!icon || !text) throw new Error("Pull request row did not render");
	expect(icon.y + icon.height / 2).toBeCloseTo(text.y + text.height / 2, 0);
	await expect(open.locator("svg animate")).toHaveCount(0);
	await expect(merged).not.toContainText("builds passed");
	await open.click();
	const flyout = page.getByRole("group", { name: "Pull request #1306: Add guest checkout to the storefront" });
	const wrapper = flyout.locator('..');
	await expect(wrapper).toHaveCSS("border-top-width", "0px");
	await expect(wrapper).toHaveCSS("box-shadow", /^(none|rgba\(0, 0, 0, 0\))/u);
	await expect(flyout).toHaveCSS("border-top-width", "0px");
	const flyoutChecks = page.getByRole("button", { name: /1\/3 builds passed/u }).last();
	await expect(flyoutChecks).toBeVisible();
	await flyoutChecks.click();
	await expect(page.getByText("Lint and typecheck")).toBeVisible();
});

test("CI checks follow the automation settings and allow manual repair and merge", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.clock.install();
	await page.goto(appUrl("/preview/blocks/development-panel"));
	await page.getByRole("button", { name: "Configure", exact: true }).click();
	const settings = page.getByRole("menu", { name: "Configure", exact: true });
	await settings.getByRole("menuitemcheckbox", { name: "Auto-fix PR" }).click();
	await settings.getByRole("menuitemcheckbox", { name: "Merge when ready" }).click();
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "Pull requests created" }).click();
	const request = page.getByRole("button", { name: /#1306 Add guest checkout/u });
	await expect(request).toContainText("1/3 builds passed");
	await page.clock.fastForward(5000);
	await expect(request).toContainText("2/3 builds passed · 1 failed");
	await request.click();
	const flyout = page.getByRole("group", { name: "Pull request #1306: Add guest checkout to the storefront" });
	await flyout.getByRole("button", { name: "Fix PR" }).click();
	await expect(request).toContainText("checks running");
	await page.clock.fastForward(5000);
	await expect(request).toContainText("3/3 builds passed");
	const completed = request.locator('[data-slot="progress-circle"]');
	const completedSlot = await completed.boundingBox();
	const completedIcon = await completed.locator("svg").filter({ has: page.locator("path.text-icon-success") }).boundingBox();
	if (completedSlot === null || completedIcon === null) throw new Error("Completed checks icon must be visible");
	expect(completedIcon.x + completedIcon.width / 2).toBeCloseTo(completedSlot.x + completedSlot.width / 2, 1);
	expect(completedIcon.y + completedIcon.height / 2).toBeCloseTo(completedSlot.y + completedSlot.height / 2, 1);
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "Merge pull request" }).click();
	await expect(request).toContainText("Merged");
	await page.getByRole("button", { name: "Before setup" }).click();
	await page.getByRole("button", { name: "Pull requests created" }).click();
	await expect(request).toContainText("1/3 builds passed");
});

test("CI checks automatically repair and merge when enabled", async ({ page }) => {
	await page.clock.install();
	await page.goto(appUrl("/preview/blocks/development-panel"));
	await page.getByRole("button", { name: "Pull requests created" }).click();
	const request = page.getByRole("button", { name: /#1306 Add guest checkout/u });
	for (const label of ["2/3 builds passed · 1 failed", "checks running", "3/3 builds passed", "Merged"]) {
		await page.clock.fastForward(5000);
		await expect(request).toContainText(label);
	}
});

test("the CI progress arc animates when another check finishes", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/preview/blocks/development-panel"));
	await page.getByRole("button", { name: "Pull requests created" }).click();
	const request = page.getByRole("button", { name: /#1306 Add guest checkout/u });
	await expect(request).toContainText("1/3 builds passed");
	const passedArc = request.locator('[data-slot="progress-circle"] circle.text-icon-accent-lime');
	const lengths = await passedArc.evaluate((circle) => new Promise<string[]>((resolve) => {
		const samples = new Set<string>();
		const started = performance.now();
		let changedAt = 0;
		const initial = getComputedStyle(circle).strokeDasharray;
		const sample = (time: number) => {
			const length = getComputedStyle(circle).strokeDasharray;
			samples.add(length);
			if (length !== initial && !changedAt) changedAt = time;
			if ((changedAt && time - changedAt >= 500) || time - started >= 8000) return resolve([...samples]);
			requestAnimationFrame(sample);
		};
		requestAnimationFrame(sample);
	}));
	await expect(request).toContainText("2/3 builds passed · 1 failed");
	expect(lengths.length).toBeGreaterThan(2);
});
