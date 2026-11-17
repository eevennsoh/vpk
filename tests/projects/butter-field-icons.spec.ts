import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

function copyRowAppearance(row: Element) {
	const style = getComputedStyle(row);
	return { height: style.height, padding: style.padding, gap: style.gap, radius: style.borderRadius, color: style.color, font: style.font };
}

test("local session continuation keeps app tiles centered beside single-line actions", async ({ page }) => {
	const errors: string[] = [];
	page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => {
			document.body.dataset.copyCount = String(Number(document.body.dataset.copyCount ?? "0") + 1);
		} } });
	});
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent & app selector", exact: true }).click();
	const reference = page.getByRole("region", { name: "Jira Local Agent", exact: true }).getByRole("button", { name: "Copy prompt", exact: true });
	const referenceAppearance = await reference.evaluate(copyRowAppearance);
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	await page.getByRole("button", { name: "Small", exact: true }).click();
	const local = page.getByRole("region", { name: "Local sessions", exact: true });
	for (const [name, title, glyphSize] of [
		["Claude", /^The adapter keep-or-delete argument/, 24],
		["Cursor", /^Kill switch as a prerequisite/, 24],
		["Rovo", /^Overnight contract-suite session/, 15],
	] as const) {
		await local.getByRole("button", { name: title }).click();
		const menu = page.getByRole("menu").filter({ hasText: "Continue in" });
		const app = menu.getByRole("menuitem", { name, exact: true });
		const tile = app.locator('[data-slot="avatar"][data-shape="square"]');
		await expect(tile).toBeVisible();
		await expect(tile).toHaveCSS("width", "24px");
		await expect(tile).toHaveCSS("height", "24px");
		const glyph = tile.locator("svg, img").first();
		await expect(glyph).toHaveCSS("width", `${glyphSize}px`);
		await expect(glyph).toHaveCSS("height", `${glyphSize}px`);
		const centers = await app.evaluate((row) => {
			const boxes = [row, row.querySelector('[data-slot="avatar"]'), row.children[1]].map((element) => element?.getBoundingClientRect());
			return boxes.map((box) => box ? box.y + box.height / 2 : null);
		});
		expect(centers[1]).toBe(centers[0]);
		expect(centers[2]).toBe(centers[0]);
		const copy = menu.getByRole("menuitem", { name: "Copy prompt", exact: true });
		await expect(copy).toBeVisible();
		expect(await copy.evaluate(copyRowAppearance)).toEqual(referenceAppearance);
		await expect(copy.locator('[data-slot="dropdown-menu-item-description"]')).toHaveCount(0);
		await expect(copy.locator("svg").first()).toHaveCSS("width", "16px");
		await copy.focus();
		await page.keyboard.press("Enter");
		await expect(menu.getByRole("menuitem", { name: "Prompt copied", exact: true })).toBeVisible();
		await expect(menu.getByRole("status")).toHaveText("Prompt copied");
		await page.keyboard.press("Escape");
		await expect(menu).toHaveCount(0);
	}
	await expect(page.locator("body")).toHaveAttribute("data-copy-count", "3");
	expect(errors).toEqual([]);
});

test("work item field and development icons fit 12-pixel glyphs in 16-pixel slots", async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => {} } });
	});
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-118"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	const expander = page.getByRole("button", { name: "Show more details" });
	const panel = page.getByRole("region", { name: "Details", exact: true });
	await expect(expander).toHaveText("Show more");
	const [buttonBounds, panelBounds] = await Promise.all([
		expander.boundingBox(),
		panel.boundingBox(),
	]);
	if (!buttonBounds || !panelBounds) throw new Error("Missing details expander geometry");
	expect(Math.abs(buttonBounds.y + buttonBounds.height / 2 - (panelBounds.y + panelBounds.height - 0.5))).toBeLessThan(0.5);
	expect(Math.abs(buttonBounds.x + buttonBounds.width / 2 - (panelBounds.x + panelBounds.width / 2))).toBeLessThan(0.5);
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
