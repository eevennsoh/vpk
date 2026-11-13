import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

// The Butter work item header no longer has the "Open in <app>" split button (23e926d67), but the
// component still ships in the Open in demo, so its last-used mark is checked there.
test("the last-used app action shows a borderless, 16px mark", async ({ page }) => {
	await page.goto(appUrl("/preview/ui-custom/open-in"));
	await page.getByRole("button", { name: "Open in", exact: true }).click();
	await page.getByRole("dialog", { name: "Local software agents" }).getByRole("button", { name: "Claude", exact: true }).click();
	const claude = page.getByRole("button", { name: "Open in Claude" });
	await expect(claude.locator('[data-slot="avatar"]')).toHaveCount(0);
	const ink = await claude.locator("svg").evaluate((element) => {
		if (!(element instanceof SVGSVGElement)) throw new Error("Claude mark is not an SVG");
		const bounds = element.getBoundingClientRect();
		const artwork = element.getBBox();
		return { width: bounds.width * artwork.width / element.viewBox.baseVal.width, height: bounds.height * artwork.height / element.viewBox.baseVal.height };
	});
	expect(ink.width).toBeCloseTo(16, 0);
	expect(ink.height).toBeCloseTo(16, 0);
	await page.getByRole("button", { name: "Open in", exact: true }).click();
	await page.getByRole("dialog", { name: "Local software agents" }).getByRole("button", { name: "VS Code", exact: true }).click();
	// VS Code's mark is the local third-party logo image since 1cd44fcd4 (it was an inline <svg>).
	const vsCode = page.getByRole("button", { name: "Open in VS Code" });
	await expect(vsCode.locator("img")).toHaveCSS("width", "16px");
	await expect(vsCode.locator("img")).toHaveCSS("height", "16px");
	await expect(vsCode.locator('[data-slot="tile"]')).toHaveCount(0);
});
