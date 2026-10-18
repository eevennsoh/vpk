import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

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
