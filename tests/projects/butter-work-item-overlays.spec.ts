import { expect, test, type Locator, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });

async function openSessions(page: Page) {
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-123"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	await page.getByRole("button", { name: /Working on this work item.*Add agent/ }).click();
	return page.getByRole("dialog", { name: "Agent sessions" });
}

async function layer(surface: Locator) {
	return surface.evaluate((element) => Number(getComputedStyle(element.parentElement!).zIndex));
}

test("Claude offers Open in Claude in the board agent picker", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	const add = page.locator('[data-issue-key="PAY-118"][data-board-column-title]').getByRole("button", { name: "Add agent to PAY-118" });
	await add.focus();
	await page.keyboard.press("Enter");
	await page.locator('[role="option"][data-value="claude-code"]').hover();
	const menu = page.getByRole("menu", { name: "Run Claude on" });
	const cloud = menu.getByRole("menuitem", { name: "Run on cloud" });
	const local = menu.getByRole("menuitem", { name: "Open in Claude" });
	await expect(local).toBeVisible();
	await expect(menu.getByText("Copy command")).toHaveCount(0);
	await cloud.focus();
	await page.keyboard.press("ArrowDown");
	await expect(local).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("combobox", { name: "Search agents" })).toBeFocused();
});

test("session tooltip and action menu appear above the work item agent panel", async ({ page }) => {
	const sessions = await openSessions(page);
	const viewer = sessions.locator("article").filter({ hasText: "Recording decline-code fixtures" });
	await viewer.hover();
	const tooltip = page.locator('[data-slot="tooltip-content"]').filter({ hasText: "Someone is using an agent. Only they can see the work." });
	await expect(tooltip).toBeVisible();
	expect(await layer(tooltip)).toBeGreaterThan(await layer(sessions));
	await sessions.locator("article").filter({ hasText: "Wiring recorded fixtures into the v2 client" }).hover();
	await sessions.getByRole("button", { name: /More actions for Wiring recorded fixtures/ }).click();
	const menu = page.getByRole("menu").filter({ hasText: "Dismiss" });
	await expect(menu).toBeVisible();
	expect(await layer(menu)).toBeGreaterThan(await layer(sessions));
});

test("agent and workspace submenus appear above their parent panels", async ({ page }) => {
	const sessions = await openSessions(page);
	await sessions.getByRole("button", { name: "Add agent", exact: true }).click();
	const picker = page.getByRole("dialog", { name: "Add agent", exact: true });
	await picker.locator('[role="option"][data-value="claude-code"]').hover();
	const claude = page.getByRole("menu", { name: "Run Claude on" });
	await expect(claude.getByRole("menuitem", { name: "Open in Claude" })).toBeVisible();
	expect(await layer(claude)).toBeGreaterThan(await layer(picker));
	await picker.getByRole("combobox", { name: "Search agents" }).fill("Rovo CLI");
	await picker.locator('[role="option"][data-value="rovo-cli"]').hover();
	const submenu = page.getByRole("dialog", { name: "Rovo CLI local options" });
	await expect(submenu).toBeVisible();
	expect(await layer(submenu)).toBeGreaterThan(await layer(picker));
	await submenu.getByRole("button", { name: /Configure/ }).click();
	await submenu.getByRole("textbox", { name: "Choose your directory" }).click();
	const workspaces = page.getByRole("dialog", { name: "Codebase workspaces" });
	await expect(workspaces).toBeVisible();
	expect(await layer(workspaces)).toBeGreaterThan(await layer(submenu));
	await workspaces.getByRole("button", { name: "No workspace" }).click();
	await expect(workspaces).toHaveCount(0);
});
