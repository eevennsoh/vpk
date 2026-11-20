import { expect, test, type Locator } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test("the default Prompt Input aligns the placeholder with typing in the microphone composer", async ({ page }) => {
	await page.goto(appUrl("/components/ui-custom/prompt-input#preview"));
	const preview = page.locator("#preview");
	const composer = preview.locator("[data-prompt-input-root]");
	const editor = composer.getByRole("textbox", { name: "Chat message input", exact: true });
	const placeholder = composer.locator('[data-slot="prompt-input-placeholder"] > span');
	const submit = composer.getByRole("button", { name: "Submit", exact: true });
	await expect(editor).toBeEditable();
	await expect(composer.locator("..")).toHaveCSS("border-radius", "12px");
	await expect(composer.getByRole("button", { name: "Start dictation", exact: true })).toBeVisible();
	await expect(submit).toBeDisabled();
	await expect(placeholder).toHaveText("Ask, @mention, or / for skills");

	const firstCharacterPosition = (locator: Locator) => locator.evaluate((element) => {
		const range = document.createRange();
		range.setStart(element, 0);
		range.setEnd(element, 1);
		const { left, top } = range.getBoundingClientRect();
		const form = element.closest("form")!.getBoundingClientRect();
		return { x: left - form.left, y: top - form.top };
	});
	const hint = await firstCharacterPosition(placeholder);
	await editor.fill("A");
	await expect(placeholder).toHaveCount(0);
	const typed = await firstCharacterPosition(editor.locator("p"));
	expect(Math.abs(typed.x - hint.x)).toBeLessThanOrEqual(1);
	expect(Math.abs(typed.y - hint.y)).toBeLessThanOrEqual(1);
	await expect(submit).toBeEnabled();

	await expect(page.locator('[id="microphone-+-text-send-—-default"]')).toBeAttached();
	await expect(page.locator("#default")).toHaveCount(0);
});

test("composer shows four app logos at 16px without outlining first-party marks", async ({ page }) => {
	await page.goto(appUrl("/components/ui-custom/prompt-input"));
	const trigger = page.locator("#preview").getByRole("button", { name: "Customize", exact: true });
	await expect(trigger.locator("svg")).toHaveCount(4);
	const logo = trigger.locator('[data-slot="tile"][aria-label="Teams"] svg');
	await expect(logo).toBeVisible();
	await expect(logo).toHaveCSS("width", "16px");
	await expect(logo).toHaveCSS("height", "16px");
	await expect(trigger.locator('[data-slot="tile"][aria-label="Teams"]')).toHaveCSS("border-width", "0px");
	await expect(trigger).toHaveAttribute("aria-expanded", "false");
	await trigger.click();
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	await expect(page.getByRole("switch", { name: "Include web results", exact: true })).toBeVisible();
});

test("Sources uses compact menu rows with plain icons and working switches", async ({ page }) => {
	await page.goto(appUrl("/components/ui-custom/prompt-input"));
	const trigger = page.locator("#preview").getByRole("button", { name: "Customize", exact: true });
	await trigger.click();
	const web = page.getByRole("switch", { name: "Include web results", exact: true });
	const company = page.getByRole("switch", { name: "Search company knowledge", exact: true });
	await expect(web).toHaveCSS("height", "32px");
	await expect(page.getByRole("dialog", { name: "Customize sources", exact: true })).toHaveCSS("padding", "4px");
	await expect(web).toHaveCSS("column-gap", "12px");
	await expect(web.locator(":scope > span").first()).toHaveCSS("width", "24px");
	await expect(web.locator(":scope > span").first()).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
	await expect(web).not.toBeChecked();
	await web.click();
	await expect(web).toBeChecked();
	await web.press("Space");
	await expect(web).not.toBeChecked();
	await expect(company).toBeChecked();
	await company.click();
	await expect(company).not.toBeChecked();
	await page.getByRole("button", { name: "Filter by apps", exact: true }).click();
	await expect(trigger).toHaveAttribute("aria-expanded", "false");
});
