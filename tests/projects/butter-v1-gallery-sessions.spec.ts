import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ actionTimeout: 7000, ignoreHTTPSErrors: true });

test("teammate sessions keep their popover alignment while expanding near the viewport edge", async ({ page }) => {
	await page.setViewportSize({ width: 1398, height: 1236 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board" }).click();
	await page.getByRole("button", { name: "3 agents: Working" }).click();
	const popup = page.getByRole("dialog", { name: "Agent assignment" });
	const disclosure = popup.getByRole("button", { name: /(?:\d+ )?other sessions?/iu });
	await expect(disclosure).toHaveAttribute("aria-expanded", "false");
	await page.setViewportSize({ width: 1398, height: 900 });
	await expect(popup).toHaveAttribute("data-align", "start");
	await disclosure.click();
	await expect(disclosure).toHaveAttribute("aria-expanded", "true");
	const panel = popup.locator('[data-slot="collapsible-content"]');
	await expect.poll(() => panel.evaluate((element) => Math.abs(element.getBoundingClientRect().height - element.scrollHeight))).toBeLessThan(1);
	await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
	await expect(popup).toHaveAttribute("data-align", "start");
	await expect(popup.getByText("Recording decline-code fixtures")).toBeVisible();
	await disclosure.press("Escape");
	await expect(disclosure).toHaveAttribute("aria-expanded", "false");
	await expect(disclosure).toBeFocused();
});

test("Butter session menus name the work instead of the agent", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board" }).click();
	const board = page.getByRole("region", { name: "Payments SDK v2 Kanban board" });
	const issue = board.locator('[data-issue-key="PAY-105"][data-board-column-title]');
	await issue.getByRole("button", { name: "Cursor: Working" }).click();
	const assignment = page.getByRole("dialog", { name: "Agent assignment" });
	await expect(assignment.getByText("Replaying 3-D Secure fixtures", { exact: true })).toBeVisible();
	await expect(assignment.getByText("Cursor", { exact: true })).toBeVisible();
	await expect(assignment.getByRole("button", { name: "Add agent", exact: true })).toHaveCount(0);
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	const journeyCard = page.locator('[data-butter-board-surface] [data-issue-key="PAY-105"][data-board-column-title]');
	await journeyCard.getByRole("button", { name: "Cursor: Working" }).click();
	const journeyAssignment = page.getByRole("dialog", { name: "Agent assignment" });
	await expect(journeyAssignment.getByText("Replaying 3-D Secure fixtures", { exact: true })).toBeVisible();
	await expect(journeyAssignment.getByRole("button", { name: "Add agent", exact: true })).toHaveCount(0);
});

test("board session flyout reveals more actions when hovering the status", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board" }).click();
	const issue = page.getByRole("region", { name: "Payments SDK v2 Kanban board" }).locator('[data-issue-key="PAY-105"][data-board-column-title]');
	await issue.getByRole("button", { name: "Cursor: Working" }).click();
	const flyout = page.getByRole("dialog", { name: "Agent assignment" });
	const row = flyout.locator("article").filter({ hasText: "Replaying 3-D Secure fixtures" });
	await expect(row).toBeVisible();
	await page.mouse.move(0, 0);
	const status = row.getByRole("button", { name: "Working" });
	await expect(status).toBeVisible();
	const statusBounds = await status.boundingBox();
	if (!statusBounds) throw new Error("Session status is not rendered");
	await page.mouse.move(statusBounds.x + statusBounds.width / 2, statusBounds.y + statusBounds.height / 2);
	const more = row.getByRole("button", { name: "More actions for Replaying 3-D Secure fixtures" });
	await expect(more).toBeVisible();
	await expect(status).toBeHidden();
	await expect(more.locator("[data-slot=icon]")).toBeVisible();
	await more.click();
	await expect(page.getByRole("menu")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(more).toBeFocused();
});

test("the original Butter session menu shows sessions without an Add agent footer", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-105"][data-board-column-title]').getByRole("button", { name: "Cursor: Working" }).click();
	await expect(page.getByRole("dialog", { name: "Agent assignment" }).getByRole("button", { name: "Add agent", exact: true })).toHaveCount(0);
});

test("session titles describe their work in grouped, review, and List views", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	const unlinked = page.getByRole("region", { name: /Unlink sessions/ });
	await expect(unlinked.getByText("Keep or delete the adapter", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Select Board" }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	const board = page.getByRole("region", { name: "Payments SDK v2 Kanban board" });
	const grouped = board.locator('[data-issue-key="PAY-123"][data-board-column-title]');
	await grouped.getByRole("button", { name: "2 agents: Working" }).click();
	let assignment = page.getByRole("dialog", { name: "Agent assignment" });
	await expect(assignment.getByText("Recording decline-code fixtures", { exact: true })).toBeVisible();
	await expect(assignment.getByText("Wiring recorded fixtures into the v2 client", { exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
	const review = board.locator('[data-issue-key="PAY-112"][data-board-column-title]');
	await review.getByRole("button", { name: "Codex: Needs input" }).click();
	assignment = page.getByRole("dialog", { name: "Agent assignment" });
	await expect(assignment.getByText("Review sandbox key retention", { exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "Open gallery" }).click();
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	await page.getByRole("tab", { name: "List", exact: true }).click();
	const row = page.getByRole("region", { name: "Payments SDK v2 migration work items list" }).locator("tr").filter({ hasText: "PAY-105" });
	await row.getByRole("button", { name: "Cursor: Working" }).click();
	const picker = page.getByRole("dialog", { name: "Add agent" });
	await expect(picker.getByRole("button", { name: "Claude", exact: true })).toBeVisible();
	await picker.getByRole("button", { name: "Claude", exact: true }).click();
	await expect(row.getByRole("button", { name: "2 agents: Working" })).toBeVisible();
	await row.getByRole("button", { name: "2 agents: Working" }).focus();
	await page.keyboard.press("Enter");
	await expect(page.getByRole("dialog", { name: "Add agent" }).getByRole("button", { name: "Claude", exact: true })).toBeVisible();
	await expect(picker.getByRole("textbox", { name: "Search agents" })).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(picker).toBeHidden();
});

test("a new board session uses the work-item summary as its title", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board" }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	const card = page.getByRole("region", { name: "Payments SDK v2 Kanban board" }).locator('[data-issue-key="PAY-118"][data-board-column-title]');
	await card.getByRole("button", { name: "Add agent to PAY-118" }).focus();
	await page.keyboard.press("Enter");
	const picker = page.getByRole("dialog", { name: "Agents" });
	const search = picker.getByRole("textbox", { name: "Search agents" });
	await search.fill("Cursor");
	const cursor = picker.getByRole("button", { name: "Cursor", exact: true });
	await cursor.click();
	await expect(picker).toBeHidden();
	await card.getByRole("button", { name: /^Cursor: / }).click();
	await expect(page.getByRole("dialog", { name: "Agent assignment" }).getByText("Carry card-artwork metadata into the next wallet epic", { exact: true })).toBeVisible();
});

test("the last-used app action shows a borderless, 16px mark", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item" }).click();
	const item = page.getByRole("region", { name: "Work item full screen view" });
	await item.getByRole("button", { name: "Open in", exact: true }).click();
	await page.getByRole("dialog", { name: "Local software agents" }).getByRole("button", { name: "Claude", exact: true }).click();
	const claude = item.getByRole("button", { name: "Open in Claude" });
	await expect(claude.locator('[data-slot="avatar"]')).toHaveCount(0);
	const ink = await claude.locator("svg").evaluate((element) => {
		if (!(element instanceof SVGSVGElement)) throw new Error("Claude mark is not an SVG");
		const bounds = element.getBoundingClientRect();
		const artwork = element.getBBox();
		return { width: bounds.width * artwork.width / element.viewBox.baseVal.width, height: bounds.height * artwork.height / element.viewBox.baseVal.height };
	});
	expect(ink.width).toBeCloseTo(16, 0);
	expect(ink.height).toBeCloseTo(16, 0);
	await item.getByRole("button", { name: "Open in", exact: true }).click();
	await page.getByRole("dialog", { name: "Local software agents" }).getByRole("button", { name: "VS Code", exact: true }).click();
	const vsCode = item.getByRole("button", { name: "Open in VS Code" });
	await expect(vsCode.locator("svg")).toHaveCSS("width", "16px");
	await expect(vsCode.locator("svg")).toHaveCSS("height", "16px");
	await expect(vsCode.locator('[data-slot="tile"]')).toHaveCount(0);
});
