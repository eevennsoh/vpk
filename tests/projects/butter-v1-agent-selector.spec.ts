import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ actionTimeout: 7000, ignoreHTTPSErrors: true });

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
	await expect(picker.getByRole("button", { name: "Browse agents" })).toBeVisible();
	await expect(picker.getByRole("button", { name: "Create agent" })).toBeVisible();
	await expect(page.getByLabel("Project Butter issue card")).toHaveCount(0);
	const search = picker.getByRole("textbox", { name: "Search agents" });
	await search.fill("Claude");
	await expect(picker.getByText("Claude", { exact: true })).toBeVisible();
	await expect(picker.getByText("Cursor", { exact: true })).toHaveCount(0);
	await gallery.getByRole("button", { name: "Select Work item" }).click();
	await expect(picker).toBeHidden();
	await gallery.getByRole("button", { name: "Select Agent selector" }).click();
	await expect(search).toHaveValue("Claude");
	await page.getByRole("button", { name: "Reset", exact: true }).click();
	await expect(search).toHaveValue("");
});


test("Agent selector switches between submenu and inline actions", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("group", { name: "Gallery items" }).getByRole("button", { name: "Select Agent selector" }).click();
	const picker = page.getByRole("region", { name: "Project Butter agent selector" });
	const modes = page.getByRole("heading", { name: "Project Butter v1" }).locator("..").getByRole("group", { name: "Agent actions presentation" });
	await expect(modes).toBeVisible();
	await expect(picker.getByRole("group", { name: "Agent actions presentation" })).toHaveCount(0);
	await expect(modes.getByRole("button", { name: "Inline expand" })).toHaveAttribute("aria-pressed", "true");
	const inlineBounds = await picker.boundingBox();
	expect(inlineBounds).not.toBeNull();
	const inlineSearch = await picker.getByRole("textbox", { name: "Search agents" }).boundingBox();
	const inlineHeading = await picker.getByText("Software agents", { exact: true }).boundingBox();
	const inlineShowMore = await picker.getByRole("button", { name: "Show more" }).boundingBox();
	const inlineOtherHeading = await picker.getByText("Other agents", { exact: true }).boundingBox();
	expect(inlineSearch).not.toBeNull();
	expect(inlineHeading).not.toBeNull();
	await modes.getByRole("button", { name: "Submenu" }).click();
	const submenuBounds = await picker.boundingBox();
	expect(submenuBounds?.width).toBe(inlineBounds?.width);
	expect(submenuBounds?.x).toBe(inlineBounds?.x);
	const submenuSearch = await picker.getByRole("combobox", { name: "Search agents" }).boundingBox();
	const submenuHeading = await picker.getByText("Software agents", { exact: true }).boundingBox();
	const submenuShowMore = await picker.getByRole("option", { name: "Show more" }).boundingBox();
	const submenuOtherHeading = await picker.getByText("Other agents", { exact: true }).boundingBox();
	expect(submenuSearch).not.toBeNull();
	expect(submenuHeading).not.toBeNull();
	if (!inlineSearch || !inlineHeading || !submenuSearch || !submenuHeading || !inlineShowMore || !inlineOtherHeading || !submenuShowMore || !submenuOtherHeading) throw new Error("Selector layout is not visible");
	expect(submenuHeading.y + submenuHeading.height - submenuSearch.y - submenuSearch.height)
		.toBe(inlineHeading.y + inlineHeading.height - inlineSearch.y - inlineSearch.height);
	expect(submenuOtherHeading.y + submenuOtherHeading.height - submenuShowMore.y - submenuShowMore.height)
		.toBe(inlineOtherHeading.y + inlineOtherHeading.height - inlineShowMore.y - inlineShowMore.height);
	await picker.getByRole("option", { name: /^Claude/ }).click();
	await expect(page.getByRole("menu", { name: "Run Claude on" }).getByRole("menuitem", { name: "Run on cloud" })).toBeVisible();
	await modes.getByRole("button", { name: "Inline expand" }).click();
	const claude = picker.getByRole("button", { name: "Claude", exact: true });
	await claude.click();
	await expect(claude).toHaveAttribute("aria-expanded", "true");
	await expect(picker.getByRole("button", { name: "Start a new session" })).toBeVisible();
	await expect(picker.getByRole("button", { name: "Open in Claude" })).toBeVisible();
	await picker.getByRole("button", { name: "Add Claude to favorites" }).click();
	await expect(picker.getByRole("region", { name: "Favorites" }).getByRole("button", { name: "Claude", exact: true })).toBeVisible();
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
	for (const [item, label] of [["Select Agent selector", "Project Butter agent selector"], ["Select Duplicative sessions", "Duplicative sessions agent selector"]] as const) {
		await gallery.getByRole("button", { name: item }).click();
		const picker = page.getByRole("region", { name: label });
		await checkFade(picker.getByRole("region", { name: "Software agents" }).locator(".."));
		await page.getByRole("button", { name: "Submenu", exact: true }).click();
		await checkFade(picker.locator("[cmdk-list]"));
	}
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
	await page.getByRole("button", { name: "Submenu", exact: true }).click();
	expect(await searchGap(picker)).toBe(referenceGap);
	for (const name of ["Software agents", "Other agents"]) {
		expect(await picker.getByText(name, { exact: true }).evaluate(measure)).toEqual(reference);
	}
	await gallery.getByRole("button", { name: "Select Duplicative sessions" }).click();
	const duplicatePicker = page.getByRole("region", { name: "Duplicative sessions agent selector" });
	expect(await searchGap(duplicatePicker)).toBe(referenceGap);
	for (const name of ["Software agents", "Other agents"]) {
		expect(await duplicatePicker.getByText(name, { exact: true }).evaluate(measure)).toEqual(reference);
	}
	const search = duplicatePicker.getByRole("textbox", { name: "Search agents" });
	await search.fill("Claude");
	await expect(duplicatePicker.getByRole("button", { name: "Claude", exact: true })).toBeVisible();
	await duplicatePicker.getByRole("button", { name: "Clear search" }).click();
	await expect(search).toHaveValue("");
	await page.getByRole("button", { name: "Submenu", exact: true }).click();
	expect(await searchGap(duplicatePicker)).toBe(referenceGap);
	for (const name of ["Software agents", "Other agents"]) {
		expect(await duplicatePicker.getByText(name, { exact: true }).evaluate(measure)).toEqual(reference);
	}
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
	const checkIcons = async (selector: typeof picker) => {
		for (const name of ["Browse agents", "Create agent"]) {
			const icon = selector.getByRole("button", { name }).locator("svg").first();
			await expect(icon).toHaveCSS("width", "16px");
			await expect(icon).toHaveCSS("height", "16px");
		}
	};
	await checkIcons(picker);
	await page.getByRole("button", { name: "Submenu", exact: true }).click();
	await checkIcons(picker);
	await gallery.getByRole("button", { name: "Select Duplicative sessions" }).click();
	const duplicatePicker = page.getByRole("region", { name: "Duplicative sessions agent selector" });
	await checkIcons(duplicatePicker);
	await page.getByRole("button", { name: "Submenu", exact: true }).click();
	await checkIcons(duplicatePicker);
	await page.goto(appUrl("/components/blocks/agent-selector#inline-expansion"));
	for (const label of ["Submenu agent selector", "Inline expansion agent selector"]) {
		await checkIcons(page.getByRole("region", { name: label }));
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
	await expect(inline.getByRole("button", { name: "Continue with last session" })).toBeVisible();
	const list = inline.getByRole("region", { name: "Software agents" }).locator("..");
	await list.evaluate((element) => { element.scrollTop = 200; });
	await expect.poll(() => list.evaluate((element) => getComputedStyle(element).maskImage)).toContain("linear-gradient");
});

test("duplicative inline search includes bylines and retains Rovo CLI workspaces", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
	const picker = page.getByRole("region", { name: "Duplicative sessions agent selector" });
	const search = picker.getByRole("textbox", { name: "Search agents" });
	await search.fill("Anthropic");
	await expect(picker.getByRole("button", { name: "Claude", exact: true })).toBeVisible();
	await search.fill("Rovo CLI");
	await picker.getByRole("button", { name: "Rovo CLI", exact: true }).click();
	await expect(picker.getByRole("button", { name: "Open in Rovo CLI" })).toBeVisible();
	await picker.getByRole("button", { name: "Configure directory" }).click();
	const directory = picker.getByRole("textbox", { name: "Choose your directory" });
	await directory.fill("/tmp/selector-workspace");
	await directory.press("Enter");
	await expect(directory).toHaveValue("/tmp/selector-workspace");
});

test("Duplicative sessions offers existing Claude sessions or a new one", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const gallery = page.getByRole("group", { name: "Gallery items" });
	const labels = ["Select Board", "Select Agent selector", "Select Duplicative sessions", "Select Work item", "Select Pull request", "Select e2e Journey"];
	await expect(gallery.getByRole("button")).toHaveCount(labels.length);
	for (const [index, label] of labels.entries()) await expect(gallery.getByRole("button").nth(index)).toHaveAccessibleName(label);
	await gallery.getByRole("button", { name: "Select Duplicative sessions" }).click();
	const picker = page.getByRole("region", { name: "Duplicative sessions agent selector" });
	const modes = page.getByRole("heading", { name: "Project Butter v1" }).locator("..").getByRole("group", { name: "Agent actions presentation" });
	await expect(modes.getByRole("button", { name: "Inline expand" })).toHaveAttribute("aria-pressed", "true");
	await modes.getByRole("button", { name: "Submenu" }).click();
	await picker.getByRole("option", { name: /^Claude/ }).click();
	const actions = page.getByRole("menu", { name: "Run Claude on" });
	await expect(actions.getByRole("menuitem", { name: "Start a new session" })).toBeVisible();
	await actions.getByRole("menuitem", { name: "Continue to existing session" }).click();
	const sessions = page.getByRole("listbox", { name: "Choose a Claude session" });
	await expect(sessions.getByRole("option")).toHaveCount(2);
	await sessions.getByRole("option", { name: /Check the onboarding tests/ }).click();
	await expect(picker.getByRole("status")).toHaveText("Selected session: Check the onboarding tests");
	await picker.getByRole("option", { name: /^Claude/ }).click();
	await actions.getByRole("menuitem", { name: "Start a new session" }).click();
	await expect(picker.getByRole("status")).toHaveText("Started a new Claude session");
	await picker.getByRole("option", { name: /^Claude/ }).click();
	await expect(actions.getByRole("menuitem", { name: "Continue to existing session" })).toBeVisible();
	await actions.getByRole("menuitem", { name: "Continue to existing session" }).click();
	await expect(page.getByRole("listbox", { name: "Choose a Claude session" }).getByRole("option", { name: /Review onboarding changes/ })).toBeVisible();
	await page.keyboard.press("Escape");
	await gallery.getByRole("button", { name: "Select Agent selector" }).click();
	await expect(page.getByRole("region", { name: "Project Butter agent selector" })).toBeVisible();
	await gallery.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await expect(picker.getByRole("status")).toHaveText("Started a new Claude session");
	await page.getByRole("button", { name: "Reset", exact: true }).click();
	await expect(picker.getByRole("status")).toHaveText("");
	await expect(modes.getByRole("button", { name: "Inline expand" })).toHaveAttribute("aria-pressed", "true");
	await modes.getByRole("button", { name: "Submenu" }).click();
	await picker.getByRole("option", { name: /^Claude/ }).click();
	await expect(actions.getByRole("menuitem", { name: "Continue to existing session" })).toBeVisible();
	await modes.getByRole("button", { name: "Inline expand" }).click();
	await picker.getByRole("button", { name: "Add Claude to favorites" }).click();
	const inlineClaude = picker.getByRole("button", { name: "Claude", exact: true });
	await inlineClaude.click();
	await expect(inlineClaude).toHaveAttribute("aria-expanded", "true");
	const expandedRow = inlineClaude.locator("../..");
	await expect(expandedRow.getByRole("button", { name: "Start a new session" })).toBeVisible();
	await expect(expandedRow.getByRole("menu")).toHaveCount(0);
	const continueButton = picker.getByRole("button", { name: "Continue to existing session" });
	await continueButton.focus();
	await page.keyboard.press("Enter");
	const backButton = expandedRow.getByRole("button", { name: "Back" });
	await expect(backButton).toBeFocused();
	await page.keyboard.press("Enter");
	await expect(continueButton).toBeFocused();
	await page.keyboard.press("Enter");
	await picker.getByRole("button", { name: "Review the onboarding quickstart" }).click();
	await expect(picker.getByRole("status")).toHaveText("Selected session: Review the onboarding quickstart");
	await expect(picker.getByRole("button", { name: "Remove Claude from favorites" })).toHaveAttribute("aria-pressed", "true");
	await gallery.getByRole("button", { name: "Select Agent selector" }).click();
	await expect(modes.getByRole("button", { name: "Inline expand" })).toHaveAttribute("aria-pressed", "true");
	await modes.getByRole("button", { name: "Submenu" }).click();
	await gallery.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await expect(modes.getByRole("button", { name: "Inline expand" })).toHaveAttribute("aria-pressed", "true");
});
