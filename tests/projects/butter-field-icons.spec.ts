import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

test("work item field and development icons fit 12-pixel glyphs in 16-pixel slots", async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => {} } });
	});
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-118"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	await page.getByRole("button", { name: "Show more details" }).click();
	for (const field of ["status", "priority", "dueDate", "parent", "labels", "storyPoints"]) {
		const icon = page.locator(`[data-field-id="${field}"] svg`).first();
		await expect(icon, field).toBeVisible();
		await expect(icon, field).toHaveCSS("width", "12px");
		await expect(icon, field).toHaveCSS("height", "12px");
		const slot = page.locator(`[data-field-id="${field}"] [data-slot="icon-tile"]`).first();
		await expect(slot, field).toHaveCSS("width", "16px");
		await expect(slot, field).toHaveCSS("height", "16px");
		const [iconBounds, slotBounds] = await Promise.all([icon.boundingBox(), slot.boundingBox()]);
		if (!iconBounds || !slotBounds) throw new Error(`Missing ${field} icon geometry`);
		expect(Math.abs(iconBounds.x - slotBounds.x - 2), field).toBeLessThan(0.5);
		expect(Math.abs(iconBounds.y - slotBounds.y - 2), field).toBeLessThan(0.5);
	}
	for (const action of ["Start coding", "Copy prompt"]) {
		const icon = page.getByRole("button", { name: action, exact: true }).locator("svg").first();
		await expect(icon, action).toHaveCSS("width", "12px");
		await expect(icon, action).toHaveCSS("height", "12px");
		const slot = page.getByRole("button", { name: action, exact: true }).locator('span[aria-hidden="true"]').first();
		await expect(slot, action).toHaveCSS("width", "16px");
		await expect(slot, action).toHaveCSS("height", "16px");
	}
	await page.getByRole("button", { name: "Copy prompt", exact: true }).click();
	const copied = page.getByRole("button", { name: "Prompt copied" }).locator("svg").last();
	await expect(copied).toHaveCSS("width", "12px");
	await expect(copied).toHaveCSS("height", "12px");
});
