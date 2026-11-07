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
	expect(inlineSearch).not.toBeNull();
	expect(inlineHeading).not.toBeNull();
	await modes.getByRole("button", { name: "Submenu" }).click();
	const submenuBounds = await picker.boundingBox();
	expect(submenuBounds?.width).toBe(inlineBounds?.width);
	expect(submenuBounds?.x).toBe(inlineBounds?.x);
	const submenuSearch = await picker.getByRole("combobox", { name: "Search agents" }).boundingBox();
	const submenuHeading = await picker.getByText("Software agents", { exact: true }).boundingBox();
	expect(submenuSearch).not.toBeNull();
	expect(submenuHeading).not.toBeNull();
	if (!inlineSearch || !inlineHeading || !submenuSearch || !submenuHeading) throw new Error("Selector layout is not visible");
	expect(submenuHeading.y + submenuHeading.height - submenuSearch.y - submenuSearch.height)
		.toBe(inlineHeading.y + inlineHeading.height - inlineSearch.y - inlineSearch.height);
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

test("Inline selector fades the list only after scrolling", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const gallery = page.getByRole("group", { name: "Gallery items" });
	for (const [item, label] of [["Select Agent selector", "Project Butter agent selector"], ["Select Duplicative sessions", "Duplicative sessions agent selector"]] as const) {
		await gallery.getByRole("button", { name: item }).click();
		const picker = page.getByRole("region", { name: label });
		const list = picker.getByRole("region", { name: "Software agents" }).locator("..");
		await expect(list).toHaveCSS("mask-image", "none");
		await list.evaluate((element) => { element.scrollTop = 200; });
		await expect.poll(() => list.evaluate((element) => getComputedStyle(element).maskImage)).toContain("linear-gradient");
		await expect(list).toHaveCSS("--scroll-mask-fade-size", "3rem");
		await list.evaluate((element) => { element.scrollTop = 0; });
		await expect(list).toHaveCSS("mask-image", "none");
	}
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
	await actions.getByRole("menuitem", { name: "Continue to existing session (2)" }).click();
	const sessions = page.getByRole("listbox", { name: "Choose a Claude session" });
	await expect(sessions.getByRole("option")).toHaveCount(2);
	await sessions.getByRole("option", { name: /Check the onboarding tests/ }).click();
	await expect(picker.getByRole("status")).toHaveText("Selected session: Check the onboarding tests");
	await picker.getByRole("option", { name: /^Claude/ }).click();
	await actions.getByRole("menuitem", { name: "Start a new session" }).click();
	await expect(picker.getByRole("status")).toHaveText("Started a new Claude session");
	await picker.getByRole("option", { name: /^Claude/ }).click();
	await expect(actions.getByRole("menuitem", { name: "Continue to existing session (3)" })).toBeVisible();
	await actions.getByRole("menuitem", { name: "Continue to existing session (3)" }).click();
	await expect(page.getByRole("listbox", { name: "Choose a Claude session" }).getByRole("option", { name: /Review onboarding changes/ })).toBeVisible();
	await page.keyboard.press("Escape");
	await gallery.getByRole("button", { name: "Select Agent selector" }).click();
	await expect(page.getByRole("region", { name: "Project Butter agent selector" })).toBeVisible();
	await gallery.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await expect(picker.getByRole("status")).toHaveText("Started a new Claude session");
	await page.getByRole("button", { name: "Reset", exact: true }).click();
	await expect(picker.getByRole("status")).toHaveCount(0);
	await expect(modes.getByRole("button", { name: "Inline expand" })).toHaveAttribute("aria-pressed", "true");
	await modes.getByRole("button", { name: "Submenu" }).click();
	await picker.getByRole("option", { name: /^Claude/ }).click();
	await expect(actions.getByRole("menuitem", { name: "Continue to existing session (2)" })).toBeVisible();
	await modes.getByRole("button", { name: "Inline expand" }).click();
	await picker.getByRole("button", { name: "Claude" }).click();
	await picker.getByRole("menuitem", { name: "Continue to existing session (2)" }).click();
	await picker.getByRole("option", { name: /Review the onboarding quickstart/ }).click();
	await expect(picker.getByRole("status")).toHaveText("Selected session: Review the onboarding quickstart");
	await gallery.getByRole("button", { name: "Select Agent selector" }).click();
	await expect(modes.getByRole("button", { name: "Inline expand" })).toHaveAttribute("aria-pressed", "true");
	await modes.getByRole("button", { name: "Submenu" }).click();
	await gallery.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await expect(modes.getByRole("button", { name: "Inline expand" })).toHaveAttribute("aria-pressed", "true");
});
