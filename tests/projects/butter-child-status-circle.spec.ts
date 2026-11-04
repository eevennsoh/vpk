import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`child status uses the work item progress circle (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/butter"));
		await page.locator('[data-issue-key="PAY-118"][data-board-column-title] [data-slot="jira-issue-card"]').click();
		const header = page.getByRole("button", { name: "Change status, To do" });
		const child = page.getByRole("button", { name: "Edit status for PAY-201, To do" });
		const circle = child.locator('[data-slot="progress-circle"]');
		await expect(circle).toHaveAttribute("aria-valuenow", "0");
		await expect(circle).toHaveCSS("width", "16px");
		const headerDashes = header.locator('[data-slot="progress-circle-dashes"]');
		const childDashes = circle.locator('[data-slot="progress-circle-dashes"]');
		await expect(childDashes).toHaveCSS("animation-name", await headerDashes.evaluate((node) => getComputedStyle(node).animationName));
		await circle.evaluate((node) => node.setAttribute("data-transition-probe", "same"));
		await child.click();
		await page.getByRole("menuitem", { name: "In progress", exact: true }).click();
		const updated = page.getByRole("button", { name: "Edit status for PAY-201, In progress" });
		await expect(updated.locator('[data-slot="progress-circle"]')).toHaveAttribute("aria-valuenow", "50");
		await expect(updated.locator('[data-slot="progress-circle"]')).toHaveAttribute("data-transition-probe", "same");
		await updated.click();
		await page.getByRole("menuitem", { name: "Done", exact: true }).click();
		await expect(page.getByRole("button", { name: "Edit status for PAY-201, Done" }).locator('[data-slot="progress-circle"]')).toHaveAttribute("aria-valuenow", "100");
	});
}
