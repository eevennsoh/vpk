import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

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
	const copyPrompt = panel.getByRole("button", { name: "Copy prompt" });
	const emptyPositions = await startCoding.evaluate((element) => {
		const icon = element.querySelector("svg");
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
		let text = walker.nextNode();
		while (text && !text.textContent?.trim()) text = walker.nextNode();
		const range = document.createRange();
		if (text) range.selectNodeContents(text);
		return { icon: icon?.getBoundingClientRect().left, label: text ? range.getBoundingClientRect().left : undefined };
	});
	const copyPositions = await copyPrompt.evaluate((element) => ({
		icon: element.querySelector("svg")?.getBoundingClientRect().left,
		label: element.querySelector<HTMLElement>(":scope > span:last-child")?.getBoundingClientRect().left,
	}));
	await page.evaluate(() => {
		Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => { document.documentElement.dataset.copiedPrompt = text; } } });
	});
	await copyPrompt.click();
	await expect(panel.getByRole("button", { name: "Prompt copied" })).toBeVisible();
	await expect(page.locator("html")).toHaveAttribute("data-copied-prompt", "PAY-999: Improve merchant onboarding for Payments SDK v2");
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
	expect(copyPositions.icon).toBeCloseTo(positions[0].icon, 0);
	expect(copyPositions.label).toBeCloseTo(positions[0].label, 0);
	for (const position of positions) {
		expect(position.iconSlot).toBeCloseTo(heading.x, 0);
		expect(position.icon).toBeCloseTo(positions[0].icon, 0);
		expect(position.label).toBeCloseTo(positions[0].label, 0);
	}
	await page.evaluate(() => { delete document.documentElement.dataset.copiedPrompt; });
	const pullRequestCopy = panel.getByRole("button", { name: "Copy prompt" });
	const pullRequestCopyPositions = await pullRequestCopy.evaluate((element) => ({
		icon: element.querySelector("svg")?.getBoundingClientRect().left,
		label: element.querySelector<HTMLElement>(":scope > span:last-child")?.getBoundingClientRect().left,
	}));
	expect(pullRequestCopyPositions.icon).toBeCloseTo(positions[0].icon, 0);
	expect(pullRequestCopyPositions.label).toBeCloseTo(positions[0].label, 0);
	await pullRequestCopy.click();
	await expect(panel.getByRole("button", { name: "Prompt copied" })).toBeVisible();
	await expect(page.locator("html")).toHaveAttribute("data-copied-prompt", "PAY-999: Improve merchant onboarding for Payments SDK v2");
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

test("development settings surfaces match the start coding menu inset", async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/development-panel"));
	await page.getByRole("button", { name: "Pull requests created" }).click();
	await page.getByRole("button", { name: "Start coding" }).click();
	const menu = page.getByRole("menu", { name: "Start coding" });
	const inset = await menu.evaluate((element) => getComputedStyle(element).padding);
	await page.keyboard.press("Escape");
	for (const name of ["Pull request settings", "Development settings"]) {
		await page.getByRole("button", { name, exact: true }).click();
		const settings = page.getByRole("dialog", { name });
		await expect(settings).toHaveCSS("padding", inset);
		await page.keyboard.press("Escape");
	}
});

test("pull request settings work in both development panel states", async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/development-panel"));
	const panel = page.getByRole("region", { name: "Development" });
	const settingsButton = panel.getByRole("button", { name: "Pull request settings" });
	await settingsButton.click();
	const settings = page.getByRole("dialog", { name: "Pull request settings" });
	for (const name of ["Auto-fix", "Merge when ready", "Auto-archive on merge or close"]) {
		const option = settings.getByRole("switch", { name });
		const row = option;
		await expect(option).not.toBeChecked();
		await row.hover({ position: { x: 4, y: 20 } });
		await expect(row).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
		await row.click({ position: { x: 150, y: 20 } });
		await expect(option).toBeChecked();
		const rowBox = await row.boundingBox();
		if (!rowBox) throw new Error("Settings row did not render");
		await row.click({ position: { x: rowBox.width - 14, y: 20 } });
		await expect(option).not.toBeChecked();
		await row.click({ position: { x: 150, y: 20 } });
		await expect(option).toBeChecked();
	}
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "Pull requests created" }).click();
	await settingsButton.click();
	for (const name of ["Auto-fix", "Merge when ready", "Auto-archive on merge or close"]) {
		await expect(settings.getByRole("switch", { name })).toBeChecked();
	}
	await settings.getByRole("switch", { name: "Auto-fix" }).focus();
	await page.keyboard.press("Space");
	await expect(settings.getByRole("switch", { name: "Auto-fix" })).not.toBeChecked();
	await expect(settings.getByRole("switch", { name: "Merge when ready" })).toBeChecked();
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
