import { expect, test, type Page } from "@playwright/test";

const origin = process.env.PLAYWRIGHT_BASE_URL ?? "https://26b9.localhost";
test.use({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });

async function openMenu(page: Page, code = "PAY-105") {
	const card = page.locator(`[data-jira-dragging] [data-issue-key="${code}"]`);
	await card.hover();
	await page.getByRole("button", { name: `More actions for ${code}`, exact: true }).click();
	return page.getByRole("menu").last();
}

test("the new actions follow Add flag and Select uses the existing Kbd hint", async ({ page }) => {
	await page.goto(`${origin}/components/blocks/jira-dragging`);
	const menu = await openMenu(page);
	const labels = await menu.getByRole("menuitem").allTextContents();
	expect(labels.slice(-4).map((label) => label.trim())).toEqual(["Add flag", "Select⇧Click", "Archive", "Delete"]);
	const select = menu.getByRole("menuitem", { name: "Select", exact: true });
	await expect(select.locator('[data-slot="kbd"]')).toHaveText(["⇧", "Click"]);
	await expect(select).toHaveAttribute("aria-description", "Shift plus click");
	await page.screenshot({ path: "output/agent-browser/jira-dragging-menu/actions-and-shortcut.png" });
	await select.click();
	await expect(page.getByRole("menu")).toHaveCount(0);
	const selected = page.locator('[data-jira-dragging] [data-issue-key="PAY-105"] [data-jira-issue-activation-control]');
	await expect(selected).toHaveAttribute("aria-pressed", "true");
	await expect(selected).toBeFocused();
	await expect(page.getByRole("region", { name: "1 card selected. Bulk actions available.", exact: true })).toBeVisible();
});

test("Select can be activated using the keyboard", async ({ page }) => {
	await page.goto(`${origin}/components/blocks/jira-dragging`);
	const menu = await openMenu(page);
	await menu.getByRole("menuitem", { name: "Select", exact: true }).focus();
	await page.keyboard.press("Enter");
	await expect(page.locator('[data-jira-dragging] [data-issue-key="PAY-105"] [data-jira-issue-activation-control]')).toHaveAttribute("aria-pressed", "true");
	await expect(page.getByRole("menu")).toHaveCount(0);
});

for (const action of ["Archive", "Delete"]) {
	test(`${action} affects only the chosen card`, async ({ page }) => {
		await page.goto(`${origin}/components/blocks/jira-dragging`);
		const menu = await openMenu(page, "PAY-107");
		await menu.getByRole("menuitem", { name: action, exact: true }).click();
		await expect(page.locator('[data-jira-dragging] [data-issue-key="PAY-107"]')).toHaveCount(0);
		await expect(page.locator('[data-jira-dragging] [data-jira-kanban-column="To do"] [data-issue-key]')).toHaveCount(3);
		await expect(page.locator('[data-jira-dragging] [data-issue-key="PAY-105"]')).toHaveCount(1);
		await expect(page.getByRole("menu")).toHaveCount(0);
	});
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`Add agent opens its selector from narrow toolbar overflow (${reducedMotion})`, async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${origin}/preview/blocks/jira-dragging`);
		await page.waitForLoadState("networkidle");
		await page.locator('[data-jira-dragging] [data-issue-key="PAY-105"] [draggable="true"]').first().click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		const toolbar = page.getByRole("region", { name: "1 card selected. Bulk actions available.", exact: true });
		await expect(toolbar.getByRole("button", { name: "Add agent", exact: true })).toHaveCount(0);
		await toolbar.getByRole("button", { name: "More actions", exact: true }).click();
		await page.getByRole("menuitem", { name: "Add agent", exact: true }).click();
		const search = page.getByRole("combobox", { name: "Search agents", exact: true });
		await expect(search).toBeVisible();
		await search.fill("Codex");
		const agent = page.getByRole("option", { name: /Codex/u });
		await expect(agent).toBeVisible();
		await agent.click();
		await page.keyboard.press("Escape");
		await page.keyboard.press("Escape");
		await expect(toolbar).toBeVisible();
		await expect(page.getByRole("menu")).toHaveCount(0);
		await expect(page.locator('[data-issue-key="PAY-105"] [data-jira-issue-activation-control]')).toHaveAttribute("aria-pressed", "true");
		await page.screenshot({ path: `output/agent-browser/jira-dragging-menu/overflow-agent-${reducedMotion}.png` });
	});
}
