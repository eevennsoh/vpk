import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("inline Why uses the normal toolbar hover until its popover opens", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions" }).click();
	await page.getByRole("button", { name: "Inline", exact: true }).click();
	const why = page.getByRole("button", { name: "Why description was suggested" });
	const discard = page.getByRole("button", { name: "Discard description" });
	await discard.hover();
	const normalHover = await discard.evaluate((button) => getComputedStyle(button).backgroundColor);
	await why.hover();
	await expect(page.getByText("Why this was suggested", { exact: true })).toBeVisible();
	await expect(why).toHaveCSS("background-color", normalHover);
	await expect(why).toHaveAttribute("aria-expanded", "false");
	await why.click();
	await expect(why).toHaveAttribute("aria-expanded", "true");
	await expect(why).not.toHaveCSS("background-color", normalHover);
	const popup = page.getByRole("dialog", { name: /Summarised from the onboarding PRD/u });
	await expect(popup).toHaveCSS("border-radius", "8px");
	await expect(popup).toHaveCSS("border-width", "0px");
	const usesOverlayShadow = await popup.evaluate((element) => {
		const probe = document.createElement("span");
		probe.style.boxShadow = "var(--ds-shadow-overlay)";
		element.append(probe);
		const expected = getComputedStyle(probe).boxShadow;
		const actual = getComputedStyle(element).boxShadow;
		probe.remove();
		return actual.endsWith(expected);
	});
	expect(usesOverlayShadow).toBe(true);
	await popup.getByRole("button", { name: "Context" }).click();
	await expect(page.getByRole("dialog", { name: "Source previews" })).toHaveCSS("border-radius", "8px");
});
