import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ actionTimeout: 7000, ignoreHTTPSErrors: true });

test("sprint and backlog heading chevrons align with their select-all checkboxes", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("tab", { name: "Backlog", exact: true }).click();
	for (const title of ["Payments SDK sprint", "Backlog"]) {
		const section = page.getByRole("region", { name: title, exact: true });
		const toggle = section.getByRole("button", { name: `Collapse ${title}`, exact: true });
		const checkbox = section.getByRole("checkbox", { name: `Select all work items in ${title}` });
		await expect(checkbox).toBeVisible();
		const [icon, box] = await Promise.all([toggle.locator("svg").boundingBox(), checkbox.boundingBox()]);
		if (!icon || !box) throw new Error(`Expected visible controls in ${title}`);
		expect(Math.abs(icon.x + icon.width / 2 - box.x - box.width / 2)).toBeLessThanOrEqual(1);
	}
});
