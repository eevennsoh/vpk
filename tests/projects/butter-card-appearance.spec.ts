import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

const card = (page: Page, key: string) => page.locator(`[data-issue-key="${key}"][data-board-column-title]`);

test("Butter previews an assigned agent from its session avatar", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-105").getByRole("button", { name: "Cursor: Working" }).click();
	const assignment = page.getByRole("dialog", { name: "Agent assignment" });
	await assignment.getByRole("button", { name: "Cursor", exact: true }).click();
	await expect(page.getByRole("menu", { name: /Cursor/ })).toBeVisible();
	await page.keyboard.press("Escape");
	const avatar = assignment.getByRole("button", { name: "Preview Cursor" });
	await avatar.hover();
	const lanyard = page.getByRole("article", { name: "Cursor agent" });
	await expect(lanyard).toBeVisible();
	await lanyard.hover();
	await expect(assignment).toBeVisible();
	await expect(lanyard.getByRole("button", { name: "Chat with Cursor" })).toBeVisible();
	await lanyard.getByRole("button", { name: "More actions for Cursor" }).click();
	await expect(page.getByRole("menu", { name: "Actions for Cursor" })).toBeVisible();
	await expect(assignment).toBeVisible();
	await page.keyboard.press("Escape");
	await page.keyboard.press("Escape");
	await avatar.focus();
	await expect(lanyard).toBeVisible();
	await expect(avatar.locator("xpath=ancestor::button")).toHaveCount(0);
	await page.keyboard.press("Escape");
	await expect(lanyard).toBeHidden();
	await expect(assignment).toBeVisible();
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`Butter's card picker keeps keyboard focus through assignment (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/butter"));
		const issue = card(page, "PAY-118");
		await expect(issue.locator('[data-slot="jira-issue-project-butter"]')).toBeVisible();
		const add = issue.getByRole("button", { name: "Add agent to PAY-118", exact: true });
		await add.focus();
		await page.keyboard.press("Enter");
		const menu = page.getByRole("menu", { name: "Agents", exact: true });
		const claude = menu.getByRole("menuitem", { name: "Claude", exact: true });
		await claude.focus();
		await expect(issue.locator('[data-slot="jira-issue-agent-invocation-preview"]')).toHaveAttribute("data-agent-id", "claude-code");
		await page.keyboard.press("Escape");
		await expect(add).toBeFocused();
		await expect(issue.locator('[data-jira-issue-agent-row-handle]')).toHaveCount(0);
		await page.keyboard.press("Enter");
		await claude.focus();
		await page.keyboard.press("Enter");
		await expect(issue).toHaveAttribute("data-board-column-title", "In progress");
		const activity = issue.locator('[data-jira-issue-agent-row-handle]');
		await expect(activity).toHaveCount(1);
		await expect(activity).toHaveAttribute("aria-label", "Claude: Working");
		await expect(activity).toBeFocused();
		await expect(issue.getByRole("button", { name: "Add agent to PAY-118", exact: true })).toHaveCount(0);
	});
}

test("Butter retains the new cards across Board/List and content presets", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	await expect(page.locator('[data-slot="jira-issue-project-butter"]')).toHaveCount(20);
	const issue = card(page, "PAY-118");
	await issue.locator('[data-slot="jira-issue-project-butter"] p').first().click({ modifiers: ["Shift"] });
	await expect(issue.locator('[data-jira-issue-activation-control]')).toHaveAttribute("aria-pressed", "true");
	await page.keyboard.press("Escape");
	await expect(issue.locator('[data-jira-issue-activation-control]')).toHaveAttribute("aria-pressed", "false");
	await page.getByRole("tab", { name: "List", exact: true }).click();
	await expect(page.getByRole("region", { name: "Payments SDK v2 migration work items list", exact: true })).toBeVisible();
	await page.getByRole("tab", { name: "Board", exact: true }).click();
	await expect(issue.locator('[data-slot="jira-issue-project-butter"]')).toBeVisible();
	await page.getByRole("button", { name: "Settings", exact: true }).click();
	await page.getByRole("menuitemcheckbox", { name: "WAC Content", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Checkout roadmap", exact: true })).toBeVisible();
	await expect(page.locator('[data-slot="jira-issue-project-butter"]')).toHaveCount(11);
});

test("Butter's new card still moves through the board's native drag path", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	const source = card(page, "PAY-124").locator('[draggable]').first();
	const origin = await source.boundingBox();
	if (!origin) throw new Error("Source card is missing");
	await page.mouse.move(origin.x + 70, origin.y + 42);
	await page.mouse.down();
	await page.mouse.move(origin.x + 95, origin.y + 45, { steps: 5 });
	await expect(source).toHaveAttribute("data-dragging", "true");
	const target = page.locator('[data-jira-kanban-column="In progress"] [data-issue-status-zone="In progress"]');
	await expect(target).toBeVisible();
	const destination = await target.boundingBox();
	if (!destination) throw new Error("Destination column is missing");
	await page.mouse.move(destination.x + destination.width / 2, destination.y + destination.height / 2, { steps: 5 });
	await page.mouse.move(destination.x + destination.width / 2, destination.y + destination.height / 2);
	await expect(page.locator('[data-issue-drop-entered="In progress"]')).toBeVisible();
	await page.mouse.up();
	await expect(card(page, "PAY-124")).toHaveAttribute("data-board-column-title", "In progress");
	await expect(card(page, "PAY-124").locator('[data-slot="jira-issue-project-butter"]')).toBeVisible();
});

test("the Team EU26 board retains its existing card appearance", async ({ page }) => {
	await page.goto(appUrl("/jira-team-eu26"));
	await expect(card(page, "PAY-118")).toBeVisible();
	await expect(page.locator('[data-slot="jira-issue-project-butter"]')).toHaveCount(0);
});
