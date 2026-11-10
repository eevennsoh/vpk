import { expect, test, type Locator } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ actionTimeout: 7000, ignoreHTTPSErrors: true });

const iconInkCenter = (locator: Locator) => locator.evaluate((element) => {
	if (!(element instanceof SVGSVGElement)) throw new Error("Expected an SVG icon");
	const bounds = element.getBoundingClientRect();
	const ink = element.getBBox();
	const viewBox = element.viewBox.baseVal;
	return bounds.x + (ink.x + ink.width / 2 - viewBox.x) * bounds.width / viewBox.width;
});

test("Butter v1 gallery shows the Project Butter agent selector", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const gallery = page.getByRole("group", { name: "Gallery items" });
	await gallery.getByRole("button", { name: "Select Agent selector" }).click();
	const picker = page.getByRole("region", { name: "Project Butter agent selector" });
	await expect(picker.getByRole("region", { name: "Software agents" })).toBeVisible();
	await expect(picker.getByRole("region", { name: "Other agents" })).toBeVisible();
	await expect(picker.getByText("Jira Coding Agent", { exact: true })).toBeVisible();
	await expect(picker.getByText("Claude", { exact: true })).toBeVisible();
	await expect(picker.getByText("Cursor", { exact: true })).toBeVisible();
	const search = picker.getByRole("textbox", { name: "Search agents" });
	await expect(picker.getByRole("button", { name: "Show more" })).toBeVisible();
	await expect(picker.getByRole("button", { name: "Codex", exact: true })).toHaveCount(0);
	await search.fill("Codex");
	await expect(picker.getByRole("button", { name: "Codex", exact: true })).toBeVisible();
	await search.fill("");
	await picker.getByRole("button", { name: "Show more" }).focus();
	await page.keyboard.press("Enter");
	await expect(picker.getByRole("button", { name: "Codex", exact: true })).toBeFocused();
	await expect(picker.getByRole("button", { name: "Show more" })).toHaveCount(0);
	const cursor = picker.getByRole("button", { name: "Cursor", exact: true });
	await cursor.click();
	await expect(picker.getByRole("status")).toHaveText("Start on Cloud · Cursor (preview)");
	await expect(cursor).not.toHaveAttribute("aria-expanded");
	await expect(picker.getByRole("button", { name: "Start a new session" })).toHaveCount(0);
	await expect(picker.getByRole("button", { name: "Open in Cursor" })).toHaveCount(0);
	await expect(picker.getByRole("button", { name: "Rovo CLI", exact: true })).toHaveCount(0);
	for (const name of ["Jira Coding Agent", "Claude", "Codex", "GitHub Copilot"]) {
		const agent = picker.getByRole("button", { name, exact: true });
		await agent.click();
		await expect(picker.getByRole("status")).toHaveText(`Start on Cloud · ${name} (preview)`);
		await expect(agent).not.toHaveAttribute("aria-expanded");
	}
	const local = page.getByRole("region", { name: "Jira Local Agent" });
	await local.getByRole("button", { name: "Configure Rovo CLI" }).click();
	await expect(page.getByRole("dialog", { name: "Rovo CLI local options" }).getByRole("textbox", { name: "Choose your directory" })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(picker.getByRole("button", { name: "Browse agents" })).toBeVisible();
	await expect(picker.getByRole("button", { name: "Create agent" })).toHaveCount(0);
	await expect(page.getByLabel("Project Butter issue card")).toHaveCount(0);
	await search.fill("Claude");
	await expect(picker.getByText("Claude", { exact: true })).toBeVisible();
	await expect(picker.getByText("Cursor", { exact: true })).toHaveCount(0);
	await gallery.getByRole("button", { name: "Select Work item" }).click();
	await expect(picker).toBeHidden();
	await gallery.getByRole("button", { name: "Select Agent selector" }).click();
	await expect(search).toHaveValue("Claude");
	await page.getByRole("button", { name: "Reset", exact: true }).click();
	await expect(search).toHaveValue("");
	await expect(picker.getByRole("button", { name: "Show more" })).toBeVisible();
});


test("Agent selector shows the local menu beside the selector without a separate gallery tile", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	const gallery = page.getByRole("group", { name: "Gallery items" });
	await gallery.getByRole("button", { name: "Select Agent selector" }).click();
	await expect(gallery.getByRole("button", { name: "Select Jira Local Agent" })).toHaveCount(0);
	const picker = page.getByRole("region", { name: "Project Butter agent selector" });
	const menu = page.getByRole("region", { name: "Jira Local Agent" });
	await expect(picker).toBeVisible();
	const pickerBounds = await picker.boundingBox();
	const menuBounds = await menu.boundingBox();
	if (!pickerBounds || !menuBounds) throw new Error("Agent menus are not visible");
	expect(menuBounds.x).toBeGreaterThanOrEqual(pickerBounds.x + pickerBounds.width);
	await expect(menu.getByText("Claude", { exact: true })).toBeVisible();
	await expect(menu.getByRole("button", { name: "Open local agent" })).toHaveCount(0);
	await expect(page.getByRole("group", { name: "Agent actions presentation" })).toHaveCount(0);
	await gallery.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await expect(menu).toBeHidden();
	await expect(page.getByRole("group", { name: "Agent actions presentation" })).toHaveCount(0);
});

test("workspace trash icon is 12px with a visible 4px gap before the checkmark", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent selector" }).click();
	await page.getByRole("region", { name: "Jira Local Agent" }).getByRole("button", { name: "Configure Rovo CLI" }).click();
	const directory = page.getByRole("textbox", { name: "Choose your directory" });
	await directory.fill("dadf");
	await page.getByRole("button", { name: "Create “dadf”" }).click();
	const workspace = page.getByRole("button", { name: "dadf", exact: true });
	await workspace.hover();
	const remove = page.getByRole("button", { name: "Remove dadf", exact: true });
	await expect(remove).toBeVisible();
	await expect(remove.locator("svg")).toHaveCSS("width", "12px");
	await expect(remove.locator("svg")).toHaveCSS("height", "12px");
	const inkEdge = (locator: Locator, edge: "left" | "right") => locator.evaluate((element, side) => {
		if (!(element instanceof SVGSVGElement)) throw new Error("Expected an SVG icon");
		const bounds = element.getBoundingClientRect();
		const ink = element.getBBox();
		const viewBox = element.viewBox.baseVal;
		return bounds.x + (ink.x + (side === "right" ? ink.width : 0) - viewBox.x) * bounds.width / viewBox.width;
	}, edge);
	await expect.poll(async () => {
		const [trashRight, checkLeft] = await Promise.all([
			inkEdge(remove.locator("svg"), "right"),
			inkEdge(workspace.locator("svg").last(), "left"),
		]);
		return Math.round(checkLeft - trashRight);
	}).toBe(4);
	await remove.click();
	await expect(workspace).toHaveCount(0);
});

test("local Copy prompt aligns its icon and label with agent rows and cloud actions", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent selector" }).click();
	const local = page.getByRole("region", { name: "Jira Local Agent" });
	const cloud = page.getByRole("region", { name: "Project Butter agent selector" });
	const agent = local.getByRole("button", { name: "Claude", exact: true });
	const copy = local.getByRole("button", { name: "Copy prompt" });
	const browse = cloud.getByRole("button", { name: "Browse agents" });
	const position = async (locator: typeof local, relativeTo: typeof local) => {
		const bounds = await locator.boundingBox();
		const container = await relativeTo.boundingBox();
		if (!bounds || !container) throw new Error("Menu element is not visible");
		return { x: bounds.x - container.x, width: bounds.width };
	};
	const avatar = await position(agent.locator(":scope > span").first(), local);
	const copySlot = await position(copy.locator(":scope > span").first(), local);
	const browseSlot = await position(browse.locator("[data-slot=icon]").first(), cloud);
	expect(copySlot).toEqual(avatar);
	expect(copySlot).toEqual(browseSlot);
	expect((await position(copy.getByText("Copy prompt").first(), local)).x).toBe(browseSlot.x + browseSlot.width + 12);
});

for (const reducedMotion of ["reduce", "no-preference"] as const) {
	test(`local Copy prompt shows a 16px success icon with ${reducedMotion} motion`, async ({ page }) => {
		await page.setViewportSize({ width: 1600, height: 1000 });
		await page.emulateMedia({ reducedMotion });
		await page.addInitScript(() => {
			Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => undefined } });
		});
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("button", { name: "Select Agent selector" }).click();
		const local = page.getByRole("region", { name: "Jira Local Agent" });
		await local.getByRole("button", { name: "Copy prompt" }).click();
		const copied = local.getByRole("button", { name: "Prompt copied" });
		await expect(copied).toBeVisible();
		const success = copied.locator("svg").nth(1);
		await expect(success).toHaveCSS("width", "16px");
		await expect(success).toHaveCSS("height", "16px");
		await expect.poll(async () => {
			const bounds = await success.boundingBox();
			return bounds ? [Math.round(bounds.width), Math.round(bounds.height)] : null;
		}).toEqual([16, 16]);
	});
}

test("single-line favorite buttons have equal trailing and vertical gaps", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	const checkGaps = async (row: ReturnType<typeof page.locator>, star: ReturnType<typeof page.locator>) => {
		await row.hover();
		const [rowBounds, starBounds] = await Promise.all([row.boundingBox(), star.boundingBox()]);
		if (!rowBounds || !starBounds) throw new Error("Agent row or favorite button is not visible");
		const top = starBounds.y - rowBounds.y;
		const bottom = rowBounds.y + rowBounds.height - starBounds.y - starBounds.height;
		const right = rowBounds.x + rowBounds.width - starBounds.x - starBounds.width;
		expect(right).toBeCloseTo(top, 1);
		expect(right).toBeCloseTo(bottom, 1);
	};

	await page.goto(appUrl("/preview/blocks/agent-selector"));
	let row = page.locator('[data-slot=command-item][data-value="release-notes-drafter"]');
	let star = row.locator('[data-favorite-id="release-notes-drafter"]');
	await checkGaps(row, star);
	await star.click();
	row = page.locator('[data-slot=command-item][data-value="release-notes-drafter"]');
	star = row.locator('[data-favorite-id="release-notes-drafter"]');
	await expect(star).toHaveAttribute("aria-pressed", "true");
	await checkGaps(row, star);

	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent selector" }).click();
	const inline = page.getByRole("region", { name: "Project Butter agent selector" });
	const inlineButton = inline.getByRole("button", { name: "Claude", exact: true });
	await checkGaps(inlineButton.locator("../.."), inline.getByRole("button", { name: "Add Claude to favorites" }));
	await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
	const duplicates = page.getByRole("region", { name: "Duplicative sessions agent selector" });
	const duplicateRow = duplicates.getByRole("option", { name: /^Jira Coding Agent/ });
	await checkGaps(duplicateRow, duplicates.getByRole("button", { name: "Add Jira Coding Agent to favorites" }));

	await page.goto(appUrl("/components/blocks/agent-selector#project-butter-submenu"));
	const submenu = page.getByRole("region", { name: "Submenu agent selector" });
	row = submenu.locator('[data-slot=command-item][data-value="release-notes-drafter"]');
	await checkGaps(row, row.locator('[data-favorite-id="release-notes-drafter"]'));
});

test("selected check and favorite star share an optical center", async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/agent-selector"));
	const selected = page.locator('[data-slot=command-item][data-value="github-copilot"]');
	const other = page.locator('[data-slot=command-item][data-value="release-notes-drafter"]');
	await other.hover();
	const star = other.locator('[data-favorite-id="release-notes-drafter"] svg');
	const check = selected.locator('[data-slot=icon-tile] svg');
	expect(await iconInkCenter(check)).toBeCloseTo(await iconInkCenter(star), 0);
});

test("submenu chevrons align with the trailing favorite star", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.goto(appUrl("/components/blocks/agent-selector#project-butter-submenu"));
	const selector = page.getByRole("region", { name: "Submenu agent selector" });
	const starRow = selector.locator('[data-slot=command-item][data-value="readiness-checker"]');
	const submenuRow = selector.locator('[data-slot=command-item][data-value="claude-code"]');
	await starRow.hover();
	const star = starRow.locator('[data-favorite-id="readiness-checker"] svg');
	const chevron = submenuRow.locator(":scope > div > [data-slot=icon]").last().locator("svg");
	const [starBounds, arrowBounds] = await Promise.all([star.boundingBox(), chevron.boundingBox()]);
	if (!starBounds || !arrowBounds) throw new Error("Favorite star or chevron is not visible");
	expect(arrowBounds.x + arrowBounds.width / 2).toBeCloseTo(starBounds.x + starBounds.width / 2, 1);
	expect(await iconInkCenter(chevron)).toBeCloseTo(await iconInkCenter(star), 0);
	await submenuRow.hover();
	const submenuStar = submenuRow.getByRole("button", { name: "Add Claude to favorites" });
	await expect(submenuStar).toHaveCSS("opacity", "1");
	const [hoverArrow, hoverStar] = await Promise.all([chevron.boundingBox(), submenuStar.boundingBox()]);
	if (!hoverArrow || !hoverStar) throw new Error("Hovered submenu controls are not visible");
	expect(hoverArrow.x).toBeCloseTo(arrowBounds.x, 1);
	expect(hoverArrow.x - hoverStar.x - hoverStar.width).toBeCloseTo(4, 1);
});

test("agent rows and footer actions use the same hover color across selector variants", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	const background = (locator: ReturnType<typeof page.locator>) => locator.evaluate((element) => getComputedStyle(element).backgroundColor);
	const compare = async (row: ReturnType<typeof page.locator>, rowSurface: ReturnType<typeof page.locator>, actions: ReturnType<typeof page.locator>[]) => {
		await row.hover();
		await expect.poll(() => background(rowSurface)).not.toBe("rgba(0, 0, 0, 0)");
		const rowColor = await background(rowSurface);
		for (const action of actions) {
			await action.hover();
			await expect.poll(() => background(action)).toBe(rowColor);
		}
	};

	await page.goto(appUrl("/preview/blocks/agent-selector"));
	const original = page.locator("[data-slot=command]");
	const originalRow = original.locator('[data-value="release-notes-drafter"]');
	await compare(originalRow, originalRow, [original.locator("button").filter({ hasText: "Browse agents" }), original.locator("button").filter({ hasText: "Create agent" })]);

	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent selector" }).click();
	const inline = page.getByRole("region", { name: "Project Butter agent selector" });
	const inlineRow = inline.getByRole("button", { name: "Claude", exact: true });
	await compare(inlineRow, inlineRow.locator("../.."), [inline.getByRole("button", { name: "Browse agents" })]);
	const local = page.getByRole("region", { name: "Jira Local Agent" });
	const localRow = local.getByRole("button", { name: "Claude", exact: true });
	await compare(localRow, localRow.locator("../.."), [local.getByRole("button", { name: "Copy prompt" })]);
	await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
	const duplicates = page.getByRole("region", { name: "Duplicative sessions agent selector" });
	const duplicateRow = duplicates.getByRole("option", { name: /^Jira Coding Agent/ });
	await compare(duplicateRow, duplicateRow, [duplicates.getByRole("button", { name: "Browse agents" })]);
	await expect(duplicates.getByRole("button", { name: "Create agent" })).toHaveCount(0);

	await page.goto(appUrl("/components/blocks/jira-local-agent"));
	await page.getByRole("button", { name: "Inline expand" }).click();
	await page.getByRole("button", { name: "Open local agent" }).click();
	const inlineLocal = page.getByRole("dialog", { name: "Local software agents" });
	const inlineLocalRow = inlineLocal.getByRole("button", { name: "Claude", exact: true });
	await compare(inlineLocalRow, inlineLocalRow.locator("../.."), [inlineLocal.getByRole("button", { name: "Copy prompt" })]);

	await page.goto(appUrl("/components/blocks/agent-selector#project-butter-submenu"));
	const submenu = page.getByRole("region", { name: "Submenu agent selector" });
	const submenuRow = submenu.getByRole("option", { name: /^Claude/ });
	await compare(submenuRow, submenuRow, [submenu.getByRole("button", { name: "Browse agents" }), submenu.getByRole("button", { name: "Create agent" })]);
});

test("agent selector offers descriptions as an opt-in example", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/agent-selector"));
	const preview = page.locator("#preview [role=listbox]");
	const example = page.locator("#include-byline [role=listbox]");
	await expect(preview).toHaveCount(1);
	await expect(example).toHaveCount(1);
	await expect(preview.getByText("Custom agent by Diego Alvarez", { exact: true })).toHaveCount(0);
	await expect(example.getByText("Custom agent by Diego Alvarez", { exact: true })).toHaveCount(1);
});

test("selector presentations fade the list only after scrolling", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const gallery = page.getByRole("group", { name: "Gallery items" });
	const checkFade = async (list: ReturnType<typeof page.locator>) => {
		await expect(list).toHaveCSS("mask-image", "none");
		await list.evaluate((element) => { element.scrollTop = 200; });
		await expect.poll(() => list.evaluate((element) => getComputedStyle(element).maskImage)).toContain("linear-gradient");
		await expect(list).toHaveCSS("--scroll-mask-fade-size", "3rem");
		await list.evaluate((element) => { element.scrollTop = 0; });
		await expect(list).toHaveCSS("mask-image", "none");
	};
	await gallery.getByRole("button", { name: "Select Agent selector" }).click();
	await checkFade(page.getByRole("region", { name: "Project Butter agent selector" }).getByRole("region", { name: "Software agents" }).locator(".."));
	await gallery.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await checkFade(page.getByRole("region", { name: "Duplicative sessions agent selector" }).locator("[cmdk-list]"));
	await page.goto(appUrl("/components/blocks/agent-selector#inline-expansion"));
	await checkFade(page.getByRole("region", { name: "Submenu agent selector" }).locator("[cmdk-list]"));
	await checkFade(page.getByRole("region", { name: "Inline expansion agent selector" }).getByRole("region", { name: "Software agents" }).locator(".."));
});

test("selector subsection headings match the editor palette", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/components/blocks/editor-palette#flat"));
	const measure = (element: Element) => {
		const style = getComputedStyle(element);
		return { height: element.getBoundingClientRect().height, padding: style.padding, lineHeight: style.lineHeight };
	};
	const reference = await page.locator(".rich-text-command-menu-heading").filter({ hasText: /^Tools$/ }).first().evaluate(measure);
	await page.goto(appUrl("/butter-v1"));
	const gallery = page.getByRole("group", { name: "Gallery items" });
	await gallery.getByRole("button", { name: "Select Agent selector" }).click();
	const picker = page.getByRole("region", { name: "Project Butter agent selector" });
	const searchGap = async (selector: typeof picker) => {
		const searchBounds = await selector.locator(".rich-text-command-menu-search").boundingBox();
		const headingBounds = await selector.getByText("Software agents", { exact: true }).boundingBox();
		if (!searchBounds || !headingBounds) throw new Error("Selector layout is not visible");
		return headingBounds.y - searchBounds.y - searchBounds.height;
	};
	const referenceGap = await searchGap(picker);
	for (const name of ["Software agents", "Other agents"]) {
		expect(await picker.getByText(name, { exact: true }).evaluate(measure)).toEqual(reference);
	}
	await picker.getByRole("button", { name: "Add Claude to favorites" }).click();
	expect(await picker.getByText("Favorites", { exact: true }).evaluate(measure)).toEqual(reference);
	await gallery.getByRole("button", { name: "Select Duplicative sessions" }).click();
	const duplicatePicker = page.getByRole("region", { name: "Duplicative sessions agent selector" });
	expect(await searchGap(duplicatePicker)).toBe(referenceGap);
	for (const name of ["Software agents", "Other agents"]) {
		expect(await duplicatePicker.getByText(name, { exact: true }).evaluate(measure)).toEqual(reference);
	}
	const search = duplicatePicker.getByRole("combobox", { name: "Search agents" });
	await search.fill("Claude");
	await expect(duplicatePicker.getByRole("option", { name: /^Claude/ })).toBeVisible();
	await duplicatePicker.getByRole("button", { name: "Clear search" }).click();
	await expect(search).toHaveValue("");
	await page.goto(appUrl("/components/blocks/agent-selector#inline-expansion"));
	for (const label of ["Submenu agent selector", "Inline expansion agent selector"]) {
		const example = page.getByRole("region", { name: label });
		expect(await searchGap(example)).toBe(referenceGap);
		for (const name of ["Software agents", "Other agents"]) {
			expect(await example.getByText(name, { exact: true }).evaluate(measure)).toEqual(reference);
		}
	}
});

test("selector footer icons are 16 pixels in each presentation", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const gallery = page.getByRole("group", { name: "Gallery items" });
	await gallery.getByRole("button", { name: "Select Agent selector" }).click();
	const picker = page.getByRole("region", { name: "Project Butter agent selector" });
	const checkIcons = async (selector: typeof picker, names: string[]) => {
		for (const name of names) {
			const icon = selector.getByRole("button", { name }).locator("svg").first();
			await expect(icon).toHaveCSS("width", "16px");
			await expect(icon).toHaveCSS("height", "16px");
		}
	};
	await checkIcons(picker, ["Browse agents"]);
	await gallery.getByRole("button", { name: "Select Duplicative sessions" }).click();
	const duplicatePicker = page.getByRole("region", { name: "Duplicative sessions agent selector" });
	await checkIcons(duplicatePicker, ["Browse agents"]);
	await page.goto(appUrl("/components/blocks/agent-selector#inline-expansion"));
	for (const label of ["Submenu agent selector", "Inline expansion agent selector"]) {
		await checkIcons(page.getByRole("region", { name: label }), ["Browse agents", "Create agent"]);
	}
});

test("Agent Selector examples use the Butter submenu and inline presentations", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/components/blocks/agent-selector#inline-expansion"));
	const submenu = page.getByRole("region", { name: "Submenu agent selector" });
	const inline = page.getByRole("region", { name: "Inline expansion agent selector" });
	await submenu.getByRole("option", { name: /^Claude/ }).click();
	await expect(page.getByRole("menu", { name: "Run Claude on" }).getByRole("menuitem", { name: "Run on cloud" })).toBeVisible();
	await page.keyboard.press("Escape");
	await inline.getByRole("button", { name: "Cursor", exact: true }).click();
	await expect(inline.getByRole("button", { name: "Start a new session" })).toBeVisible();
	const list = inline.getByRole("region", { name: "Software agents" }).locator("..");
	await list.evaluate((element) => { element.scrollTop = 200; });
	await expect.poll(() => list.evaluate((element) => getComputedStyle(element).maskImage)).toContain("linear-gradient");
});

test("Butter submenu lets each agent be favorited without activating its row", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/components/blocks/agent-selector#project-butter-submenu"));
	const picker = page.getByRole("region", { name: "Submenu agent selector" });
	const claude = picker.getByRole("option", { name: /^Claude/ });
	await claude.hover();
	const star = picker.getByRole("button", { name: "Add Claude to favorites" });
	await expect(star).toHaveCSS("opacity", "1");
	await star.click();
	const favorites = picker.getByRole("group", { name: "Favorites" });
	const remove = favorites.getByRole("button", { name: "Remove Claude from favorites" });
	await expect(remove).toHaveAttribute("aria-pressed", "true");
	await expect(page.getByRole("menu", { name: "Run Claude on" })).toHaveCount(0);
	await remove.focus();
	await page.keyboard.press("Enter");
	await expect(picker.getByRole("button", { name: "Add Claude to favorites" })).toBeFocused();
	await expect(picker.getByRole("group", { name: "Favorites" })).toHaveCount(0);
	for (const name of ["Jira Coding Agent", "Cursor", "Release Notes Drafter"]) {
		const row = picker.getByRole("option", { name: new RegExp(`^${name}`) });
		await row.hover();
		await expect(picker.getByRole("button", { name: `Add ${name} to favorites` })).toHaveCSS("opacity", "1");
	}
});

test("existing session choices use the compact agent session spacing", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await page.getByRole("region", { name: "Duplicative sessions agent selector" }).getByRole("option", { name: /^Claude/ }).click();
	const card = page.getByTestId("agent-session-row-demo-onboarding-guide").locator("article");
	await expect(card).toHaveCSS("padding", "8px 12px");
});

for (const colorScheme of ["light", "dark"] as const) {
	test(`existing session hover matches menu actions in ${colorScheme} mode`, async ({ page }) => {
		await page.setViewportSize({ width: 1600, height: 1000 });
		await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
		await page.addInitScript((theme) => localStorage.setItem("ui-theme", theme), colorScheme);
		await page.goto(appUrl("/butter-v1"));
		await expect(page.locator("html")).toHaveAttribute("data-color-mode", colorScheme);
		await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
		await page.getByRole("region", { name: "Duplicative sessions agent selector" }).getByRole("option", { name: /^Claude/ }).click();
		const action = page.getByRole("button", { name: "Start a new session" });
		await action.hover();
		await expect.poll(() => action.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
		const actionColor = await action.evaluate((element) => getComputedStyle(element).backgroundColor);
		for (const id of ["demo-onboarding-guide", "demo-onboarding-tests", "demo-onboarding-flow"]) {
			const row = page.getByTestId(`agent-session-row-${id}`).locator("article");
			await row.hover();
			await expect(row).toHaveCSS("background-color", actionColor);
		}
	});
}

test("existing sessions reveal working more actions on hover and keyboard focus", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await page.getByRole("region", { name: "Duplicative sessions agent selector" }).getByRole("option", { name: /^Claude/ }).click();
	const session = page.getByTestId("agent-session-row-demo-onboarding-guide");
	await session.locator("article").hover();
	const more = session.getByRole("button", { name: "More actions for Review the onboarding quickstart" });
	await expect(more).toBeVisible();
	await more.click();
	await expect(page.getByRole("menuitem", { name: "Rename" })).toBeVisible();
	await page.getByRole("menuitem", { name: "Rename" }).click();
	await expect(session).toContainText("Review the onboarding quickstart (renamed)");
	await session.getByRole("button", { name: /^Review the onboarding quickstart \(renamed\)/ }).focus();
	await page.mouse.move(0, 0);
	await page.keyboard.press("Tab");
	await expect(session.getByRole("button", { name: "More actions for Review the onboarding quickstart (renamed)" })).toBeFocused();
	await page.keyboard.press("Enter");
	await page.getByRole("menuitem", { name: "Delete" }).click();
	await expect(session).toHaveCount(0);
});

test("Duplicative sessions starts directly or chooses from existing sessions", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const gallery = page.getByRole("group", { name: "Gallery items" });
	await gallery.getByRole("button", { name: "Select Duplicative sessions" }).click();
	const picker = page.getByRole("region", { name: "Duplicative sessions agent selector" });
	const claude = picker.getByRole("option", { name: /^Claude/ });
	const cursor = picker.getByRole("option", { name: /^Cursor/ });
	await expect(claude).toHaveAttribute("aria-haspopup", "dialog");
	await expect(claude.locator(":scope > div > [data-slot=icon]")).toHaveCount(0);
	await expect(cursor).not.toHaveAttribute("aria-haspopup", "menu");
	await claude.hover();
	await expect(page.getByRole("dialog", { name: "Claude sessions" })).toBeVisible();
	await claude.click();
	let menu = page.getByRole("dialog", { name: "Claude sessions" });
	await expect(menu.getByRole("button", { name: "Start a new session" })).toBeVisible();
	await expect(menu.locator('article[data-variant="uncaptured-work"]')).toHaveCount(3);
	await expect(menu.locator('article[data-variant="uncaptured-work"]')).toContainText(["Review the onboarding quickstart", "Check the onboarding tests", "Inspect the onboarding flow"]);
	await expect(menu.getByTestId("agent-session-row-demo-onboarding-guide")).toContainText("Claude");
	await expect(menu.getByTestId("agent-session-row-demo-onboarding-guide")).toContainText("2m");
	await expect(menu.locator("hr")).toHaveCount(1);
	await expect(menu.getByText(/Open in|Continue to existing session|Run on cloud/)).toHaveCount(0);
	await gallery.getByRole("button", { name: "Select Agent selector" }).click();
	await expect(menu).toBeHidden();
	await gallery.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await picker.getByRole("option", { name: /^Claude/ }).click();
	menu = page.getByRole("dialog", { name: "Claude sessions" });
	await menu.getByRole("button", { name: /^Check the onboarding tests/ }).click();
	await expect(picker.getByRole("status")).toHaveText("Selected session: Check the onboarding tests");
	await picker.getByRole("option", { name: /^Claude/ }).click();
	await page.getByRole("dialog", { name: "Claude sessions" }).getByRole("button", { name: "Start a new session" }).click();
	await expect(picker.getByRole("status")).toHaveText("Started a new Claude session");
	await picker.getByRole("option", { name: /^Claude/ }).click();
	await expect(page.getByRole("dialog", { name: "Claude sessions" }).getByRole("button", { name: /^Review onboarding changes/ })).toBeVisible();
	await page.keyboard.press("Escape");
	await picker.getByRole("option", { name: /^Cursor/ }).click();
	await expect(picker.getByRole("status")).toHaveText("Started a new Cursor session");
	await picker.getByRole("option", { name: /^Cursor/ }).click();
	menu = page.getByRole("dialog", { name: "Cursor sessions" });
	await expect(menu.getByRole("button", { name: /^Review onboarding changes/ })).toBeVisible();
	await expect(menu.getByRole("button", { name: "Start a new session" })).toBeFocused();
	await page.keyboard.press("ArrowDown");
	await expect(menu.getByRole("button", { name: /^Review onboarding changes/ })).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(picker.getByRole("combobox", { name: "Search agents" })).toBeFocused();
	await gallery.getByRole("button", { name: "Select Agent selector" }).click();
	await gallery.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await expect(picker.getByRole("status")).toHaveText("Started a new Cursor session");
	await page.getByRole("button", { name: "Reset", exact: true }).click();
	await expect(picker.getByRole("status")).toHaveText("");
	await expect(picker.getByRole("option", { name: /^Cursor/ })).not.toHaveAttribute("aria-haspopup", "menu");
	await picker.getByRole("combobox", { name: "Search agents" }).fill("Rovo CLI");
	await picker.getByRole("option", { name: /^Rovo CLI/ }).click();
	await expect(picker.getByRole("status")).toHaveText("Started a new Rovo CLI session");
	await picker.getByRole("combobox", { name: "Search agents" }).fill("Rovo CLI");
	await picker.getByRole("option", { name: /^Rovo CLI/ }).click();
	const rovoMenu = page.getByRole("dialog", { name: "Rovo CLI sessions" });
	await expect(rovoMenu.getByRole("button")).toContainText(["Start a new session", "Review onboarding changes"]);
	await expect(rovoMenu.getByText(/Open in/)).toHaveCount(0);
});


test("Duplicative sessions submenu supports keyboard selection", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
	const picker = page.getByRole("region", { name: "Duplicative sessions agent selector" });
	const search = picker.getByRole("combobox", { name: "Search agents" });
	await search.fill("Claude");
	await expect(picker.getByRole("option", { name: /^Claude/ })).toHaveAttribute("aria-selected", "true");
	await search.press("ArrowRight");
	const menu = page.getByRole("dialog", { name: "Claude sessions" });
	await expect(menu.getByRole("button", { name: "Start a new session" })).toBeFocused();
	await page.keyboard.press("End");
	await expect(menu.getByRole("button", { name: "Validate the onboarding checklist" })).toBeFocused();
	await page.keyboard.press("Home");
	await expect(menu.getByRole("button", { name: "Start a new session" })).toBeFocused();
	await page.keyboard.press("ArrowDown");
	await page.keyboard.press("ArrowDown");
	await expect(menu.getByRole("button", { name: "Check the onboarding tests" })).toBeFocused();
	await page.keyboard.press("Enter");
	await expect(picker.getByRole("status")).toHaveText("Selected session: Check the onboarding tests");
});


test("Jira kanban headings match the submenu and have no extra inter-group gap", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/agent-selector#jira-kanban"));
	const jira = page.locator("#jira-kanban");
	const submenu = page.getByRole("region", { name: "Submenu agent selector" });
	await expect(jira.locator("[cmdk-group-heading]")).toHaveCount(2);
	await expect(submenu.locator("[cmdk-group-heading]")).toHaveCount(2);
	const headings = async (selector: typeof jira) => selector.locator("[cmdk-group-heading]").evaluateAll((elements) => elements.map((element) => {
		const style = getComputedStyle(element);
		const group = element.parentElement;
		if (!group) throw new Error("Missing agent group");
		return { padding: style.padding, height: element.getBoundingClientRect().height, groupPadding: getComputedStyle(group).padding };
	}));
	const reference = await headings(submenu);
	expect(await headings(jira)).toEqual(reference);
	const gap = await jira.evaluate((element) => {
		const groups = [...element.querySelectorAll("[cmdk-group]")];
		const last = groups[0]?.querySelector('[data-value="rfp-drafting-agent"]');
		const nextHeading = groups[1]?.querySelector("[cmdk-group-heading]");
		if (!last || !nextHeading) throw new Error("Missing pinned row or next heading");
		return nextHeading.getBoundingClientRect().top - last.getBoundingClientRect().bottom;
	});
	expect(gap).toBe(0);
	await expect(jira.getByText("Pinned by space", { exact: true })).toBeVisible();
	await expect(jira.locator('[aria-label="Unpin Readiness Checker"]')).toHaveAttribute("aria-pressed", "true");
	await expect(jira.locator('[data-favorite-id]')).toHaveCount(0);
});
