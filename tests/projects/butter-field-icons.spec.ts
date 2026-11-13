import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

test("work item field and development icons fit 12-pixel glyphs in 16-pixel slots", async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => {} } });
	});
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-118"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	const expander = page.getByRole("button", { name: "Show more details" });
	const panel = page.getByRole("region", { name: "Details", exact: true });
	const [buttonBounds, chevronBounds, panelBounds] = await Promise.all([
		expander.boundingBox(),
		expander.locator("svg").boundingBox(),
		panel.boundingBox(),
	]);
	if (!buttonBounds || !chevronBounds || !panelBounds) throw new Error("Missing details expander geometry");
	expect(Math.abs(buttonBounds.y + buttonBounds.height / 2 - (panelBounds.y + panelBounds.height - 0.5))).toBeLessThan(0.5);
	expect(Math.abs(chevronBounds.y + chevronBounds.height / 2 - (buttonBounds.y + buttonBounds.height / 2))).toBeLessThan(0.5);
	await page.getByRole("button", { name: "Show more details" }).click();
	const calendarColor = await page.locator('[data-field-id="dueDate"] svg').first().evaluate((icon) => getComputedStyle(icon).color);
	const subtleColor = await page.getByRole("button", { name: "Start coding", exact: true }).locator("svg").first().evaluate((icon) => getComputedStyle(icon).color);
	expect(calendarColor).toBe(subtleColor);
	for (const field of ["priority", "dueDate", "parent", "labels", "storyPoints"]) {
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
	for (const action of ["Start coding", "Open in"]) {
		const icon = page.getByRole("button", { name: action, exact: true }).locator("svg").first();
		await expect(icon, action).toHaveCSS("width", "12px");
		await expect(icon, action).toHaveCSS("height", "12px");
		const slot = page.getByRole("button", { name: action, exact: true }).locator('span[aria-hidden="true"]').first();
		await expect(slot, action).toHaveCSS("width", "16px");
		await expect(slot, action).toHaveCSS("height", "16px");
	}
	// Copy prompt lives in the Open in menu at the menu's 16px icon size, idle and copied alike.
	await page.getByRole("button", { name: "Open in", exact: true }).click();
	const localAgents = page.getByRole("dialog", { name: "Local software agents" });
	const idle = localAgents.getByRole("button", { name: "Copy prompt", exact: true }).locator("svg").last();
	await expect(idle).toHaveCSS("width", "16px");
	await expect(idle).toHaveCSS("height", "16px");
	await localAgents.getByRole("button", { name: "Copy prompt", exact: true }).click();
	const copied = localAgents.getByRole("button", { name: "Prompt copied" }).locator("svg").last();
	await expect(copied).toHaveCSS("width", "16px");
	await expect(copied).toHaveCSS("height", "16px");
});
