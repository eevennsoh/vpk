import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("search borders use the search token without hiding focus or invalid states", { tag: "@smoke" }, async ({ page }) => {
	await page.goto(appUrl("/components/ui/field"));
	const finesse = process.env.NEXT_PUBLIC_PLATFORM_DST_TOKENS_FINESSE !== "false";
	await expect(page.locator('style[data-theme="light-finesse"]')).toHaveCount(finesse ? 1 : 0);
	const standalone = page.locator("#input-type-search");
	const grouped = page.getByRole("searchbox", { name: "Search components" });
	const group = grouped.locator("xpath=ancestor::*[@data-slot='input-group']");
	const colors = await page.evaluate(() => {
		const probe = document.createElement("div");
		document.body.append(probe);
		const color = (token: string) => {
			probe.style.borderColor = `var(${token})`;
			return getComputedStyle(probe).borderColor;
		};
		const search = color("--ds-border-input-search");
		const focus = color("--ds-border-focused");
		const error = color("--ds-background-danger-bold");
		const placeholder = color("--ds-text-subtle");
		const normalPlaceholder = color("--ds-text-subtlest");
		probe.style.removeProperty("border-color");
		probe.className = "border-input";
		const normal = getComputedStyle(probe).borderColor;
		probe.remove();
		return { search, focus, error, normal, placeholder, normalPlaceholder };
	});

	await expect(standalone).toHaveCSS("border-color", finesse ? colors.search : colors.normal);
	await expect(group).toHaveCSS("border-color", finesse ? colors.search : colors.normal);
	await expect.poll(() => standalone.evaluate((input) => getComputedStyle(input, "::placeholder").color))
		.toBe(finesse ? colors.placeholder : colors.normalPlaceholder);
	await standalone.focus();
	await expect(standalone).toHaveCSS("border-color", colors.focus);
	await grouped.focus();
	await expect(group).toHaveCSS("border-color", colors.focus);
	await grouped.evaluate((input) => input.setAttribute("aria-invalid", "true"));
	await expect(group).toHaveCSS("border-color", colors.error);
});
