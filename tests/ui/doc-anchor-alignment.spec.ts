import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("documentation anchor icons are centered with their headings", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/agent-selector#standalone-picker"));
	for (const [section, label] of [["#standalone-picker", "Standalone picker"], ["#examples", "Examples"]] as const) {
		const container = page.locator(section);
		const heading = container.getByRole("heading", { name: label, exact: true });
		const icon = container.getByRole("button", { name: `Copy link to ${label}`, exact: true }).locator("svg");
		await expect(heading).toBeVisible();
		const headingBox = await heading.boundingBox();
		const iconBox = await icon.boundingBox();
		expect(headingBox).not.toBeNull();
		expect(iconBox).not.toBeNull();
		expect(Math.abs((headingBox!.y + headingBox!.height / 2) - (iconBox!.y + iconBox!.height / 2))).toBeLessThan(0.5);
	}
});
