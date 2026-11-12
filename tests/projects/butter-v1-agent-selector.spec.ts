import { expect, test, type Locator } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ actionTimeout: 7000, ignoreHTTPSErrors: true });

test("e2e Journey assigns a board agent directly", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.goto(appUrl("/butter-v1"));
	const card = page.locator('[data-issue-key="PAY-118"][data-board-column-title]');
	await card.getByRole("button", { name: "Add agent to PAY-118" }).focus();
	await page.keyboard.press("Enter");
	const picker = page.getByRole("dialog", { name: "Agents" });
	const claude = picker.getByRole("button", { name: "Claude (Recommended)" });
	await claude.hover();
	const lanyard = page.locator('[data-slot="agent-lanyard"]');
	await expect(lanyard.getByRole("heading", { name: "Claude" })).toBeVisible();
	await expect(lanyard.getByRole("button")).toHaveCount(0);
	await expect(lanyard.getByText("Anthropic", { exact: true })).toBeVisible();
	await expect(lanyard).toHaveAttribute("data-variant", "recommended");
	await expect(lanyard.getByText("Collaborate on code with an AI that gives smart suggestions and reviews.", { exact: true })).toBeVisible();
	await expect(lanyard.getByRole("heading", { name: "Why recommended" })).toBeVisible();
	await expect(lanyard.getByText("Claude can help with code suggestions and reviews.", { exact: true })).toBeVisible();
	const cursor = picker.getByRole("button", { name: "Cursor", exact: true });
	await cursor.hover();
	await expect(lanyard.getByRole("heading", { name: "Cursor" })).toBeVisible();
	await expect(lanyard).toHaveAttribute("data-variant", "agent");
	await expect(lanyard.getByRole("heading", { name: "Why recommended" })).toHaveCount(0);
	await expect(lanyard.getByRole("button")).toHaveCount(0);
	await claude.focus();
	await expect(lanyard.getByRole("heading", { name: "Claude" })).toBeVisible();
	await expect(lanyard.getByRole("heading", { name: "Why recommended" })).toBeVisible();
	await expect(claude).not.toHaveAttribute("aria-expanded");
	await expect(page.getByText("Run on cloud", { exact: true })).toHaveCount(0);
	await expect(page.getByText("Open in Claude", { exact: true })).toHaveCount(0);
	await claude.click();
	await expect(picker).toBeHidden();
	await expect(card.getByRole("button", { name: "Claude: Working" })).toBeVisible();
});

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
	await gallery.getByRole("button", { name: "Select Agent & app selector" }).click();
	const picker = page.getByRole("region", { name: "Project Butter agent selector" });
	const recommendation = picker.getByRole("button", { name: "Claude (Recommended)", exact: true });
	const recommendationLabel = recommendation.getByText("(Recommended)", { exact: true });
	const subtlestColor = await recommendationLabel.evaluate((element) => {
		const probe = document.createElement("span");
		probe.style.color = "var(--ds-text-subtlest)";
		element.appendChild(probe);
		const color = getComputedStyle(probe).color;
		probe.remove();
		return color;
	});
	await expect(recommendationLabel).toHaveCSS("color", subtlestColor);
	await expect(picker.getByRole("region", { name: "Software agents" })).toBeVisible();
	await expect(picker.getByRole("region", { name: "Other agents" })).toBeVisible();
	await expect(picker.getByText("Jira Coding Agent", { exact: true })).toBeVisible();
	await expect(picker.getByRole("button", { name: "Claude (Recommended)" })).toBeVisible();
	await expect(picker.getByText("Cursor", { exact: true })).toBeVisible();
	const search = picker.getByRole("textbox", { name: "Search agents" });
	await expect(picker.getByRole("button", { name: "Show more" })).toBeVisible();
	await expect(picker.getByRole("button", { name: "GitHub Copilot", exact: true })).toHaveCount(0);
	await search.fill("Codex");
	await expect(picker.getByRole("button", { name: "Codex", exact: true })).toBeVisible();
	await search.fill("");
	await picker.getByRole("button", { name: "Show more" }).focus();
	await page.keyboard.press("Enter");
	await expect(picker.getByRole("button", { name: "GitHub Copilot", exact: true })).toBeFocused();
	await expect(picker.getByRole("button", { name: "Show more" })).toHaveCount(0);
	const cursor = picker.getByRole("button", { name: "Cursor", exact: true });
	await cursor.click();
	await expect(picker.getByRole("status")).toHaveText("Start on Cloud · Cursor (preview)");
	await expect(cursor).not.toHaveAttribute("aria-expanded");
	await expect(picker.getByRole("button", { name: "Start a new session" })).toHaveCount(0);
	await expect(picker.getByRole("button", { name: "Open in Cursor" })).toHaveCount(0);
	await expect(picker.getByRole("button", { name: "Rovo CLI", exact: true })).toHaveCount(0);
	for (const name of ["Jira Coding Agent", "Claude", "Codex", "GitHub Copilot"]) {
		const agent = picker.getByRole("button", { name: name === "Claude" ? "Claude (Recommended)" : name, exact: true });
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
	await expect(picker.getByRole("button", { name: "Claude (Recommended)" })).toBeVisible();
	await expect(picker.getByText("Cursor", { exact: true })).toHaveCount(0);
	await gallery.getByRole("button", { name: "Select Work item" }).click();
	await expect(picker).toBeHidden();
	await gallery.getByRole("button", { name: "Select Agent & app selector" }).click();
	await expect(search).toHaveValue("Claude");
	await page.getByRole("button", { name: "Reset", exact: true }).click();
	await expect(search).toHaveValue("");
	await expect(picker.getByRole("button", { name: "Show more" })).toBeVisible();
});


test("Agent selector shows the local menu beside the selector without a separate gallery tile", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	const gallery = page.getByRole("group", { name: "Gallery items" });
	await gallery.getByRole("button", { name: "Select Agent & app selector" }).click();
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
	await page.getByRole("button", { name: "Select Agent & app selector" }).click();
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
	await page.getByRole("button", { name: "Select Agent & app selector" }).click();
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
		await page.getByRole("button", { name: "Select Agent & app selector" }).click();
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

	await page.goto(appUrl("/components/blocks/agent-selector#standalone-picker"));
	let row = page.locator('#standalone-picker [data-agent-selector-demo="standalone"]').first().locator('[data-slot=command-item][data-value="release-notes-drafter"]');
	let star = row.locator('[data-favorite-id="release-notes-drafter"]');
	await checkGaps(row, star);
	await star.click();
	row = page.locator('#standalone-picker [data-agent-selector-demo="standalone"]').first().locator('[data-slot=command-item][data-value="release-notes-drafter"]');
	star = row.locator('[data-favorite-id="release-notes-drafter"]');
	await expect(star).toHaveAttribute("aria-pressed", "true");
	await checkGaps(row, star);

	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent & app selector" }).click();
	const inline = page.getByRole("region", { name: "Project Butter agent selector" });
	const inlineButton = inline.getByRole("button", { name: "Claude (Recommended)", exact: true });
	await checkGaps(inlineButton.locator("../.."), inline.getByRole("button", { name: "Add Claude to favorites" }));

});

test("selected check and favorite star share an optical center", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/agent-selector#standalone-picker"));
	const selected = page.locator('#standalone-picker [data-agent-selector-demo="standalone"]').first().locator('[data-slot=command-item][data-value="github-copilot"]');
	const other = page.locator('#standalone-picker [data-agent-selector-demo="standalone"]').first().locator('[data-slot=command-item][data-value="release-notes-drafter"]');
	await other.hover();
	const star = other.locator('[data-favorite-id="release-notes-drafter"] svg');
	const check = selected.locator('[data-slot=icon-tile] svg');
	expect(await iconInkCenter(check)).toBeCloseTo(await iconInkCenter(star), 0);
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

	await page.goto(appUrl("/components/blocks/agent-selector#standalone-picker"));
	const original = page.locator('#standalone-picker [data-agent-selector-demo="standalone"]').first().locator("[data-slot=command]");
	const originalRow = original.locator('[data-value="release-notes-drafter"]');
	await compare(originalRow, originalRow, [original.locator("button").filter({ hasText: "Browse agents" }), original.locator("button").filter({ hasText: "Create agent" })]);

	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent & app selector" }).click();
	const inline = page.getByRole("region", { name: "Project Butter agent selector" });
	const inlineRow = inline.getByRole("button", { name: "Claude (Recommended)", exact: true });
	await compare(inlineRow, inlineRow.locator("../.."), [inline.getByRole("button", { name: "Browse agents" })]);
	const local = page.getByRole("region", { name: "Jira Local Agent" });
	const localRow = local.getByRole("button", { name: "Claude", exact: true });
	await compare(localRow, localRow.locator("../.."), [local.getByRole("button", { name: "Copy prompt" })]);

	await page.goto(appUrl("/components/blocks/jira-local-agent"));
	await page.getByRole("button", { name: "Inline expand" }).click();
	await page.getByRole("button", { name: "Open local agent" }).click();
	const inlineLocal = page.getByRole("dialog", { name: "Local software agents" });
	const inlineLocalRow = inlineLocal.getByRole("button", { name: "Claude", exact: true });
	await compare(inlineLocalRow, inlineLocalRow.locator("../.."), [inlineLocal.getByRole("button", { name: "Copy prompt" })]);

});

test("agent selector offers descriptions as an opt-in example", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/agent-selector"));
	const preview = page.locator("#preview");
	const example = page.locator("#include-byline [role=listbox]");
	await expect(preview.getByRole("button", { name: "Claude (Recommended)" })).toBeVisible();
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
	await gallery.getByRole("button", { name: "Select Agent & app selector" }).click();
	await checkFade(page.getByRole("region", { name: "Project Butter agent selector" }).getByRole("region", { name: "Software agents" }).locator(".."));

	await page.goto(appUrl("/components/blocks/agent-selector#inline-expansion"));
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
	await gallery.getByRole("button", { name: "Select Agent & app selector" }).click();
	const picker = page.getByRole("region", { name: "Project Butter agent selector" });
	for (const name of ["Software agents", "Other agents"]) {
		expect(await picker.getByText(name, { exact: true }).evaluate(measure)).toEqual(reference);
	}
	await picker.getByRole("button", { name: "Add Cursor to favorites" }).click();
	expect(await picker.getByText("Favorites", { exact: true }).evaluate(measure)).toEqual(reference);

	await page.goto(appUrl("/components/blocks/agent-selector#inline-expansion"));
	for (const label of ["Inline expansion agent selector"]) {
		const example = page.getByRole("region", { name: label });
		for (const name of ["Software agents", "Other agents"]) {
			expect(await example.getByText(name, { exact: true }).evaluate(measure)).toEqual(reference);
		}
	}
});

test("selector footer icons are 16 pixels in each presentation", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const gallery = page.getByRole("group", { name: "Gallery items" });
	await gallery.getByRole("button", { name: "Select Agent & app selector" }).click();
	const picker = page.getByRole("region", { name: "Project Butter agent selector" });
	const checkIcons = async (selector: typeof picker, names: string[]) => {
		for (const name of names) {
			const icon = selector.getByRole("button", { name }).locator("svg").first();
			await expect(icon).toHaveCSS("width", "16px");
			await expect(icon).toHaveCSS("height", "16px");
		}
	};
	await checkIcons(picker, ["Browse agents"]);

	await page.goto(appUrl("/components/blocks/agent-selector#inline-expansion"));
	for (const label of ["Inline expansion agent selector"]) {
		await checkIcons(page.getByRole("region", { name: label }), ["Browse agents", "Create agent"]);
	}
});

test("Agent Selector default selects an agent directly", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/agent-selector"));
	const preview = page.locator("#preview");
	const claude = preview.getByRole("button", { name: "Claude (Recommended)" });
	await expect(claude).not.toHaveAttribute("aria-expanded");
	await claude.click();
	await expect(preview.getByRole("status")).toHaveText("Start on Cloud · Claude (preview)");
	await expect(page.getByText("Run on cloud", { exact: true })).toHaveCount(0);
	await expect(page.getByText("Open in Claude", { exact: true })).toHaveCount(0);
});

test("Jira kanban headings match the submenu and have no extra inter-group gap", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/agent-selector#jira-kanban"));
	const jira = page.locator("#jira-kanban");
	await jira.getByRole("button", { name: "Select agent" }).click();
	await expect(jira.locator("[cmdk-group-heading]")).toHaveCount(2);
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
