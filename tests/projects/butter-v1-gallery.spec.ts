import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ actionTimeout: 7000, ignoreHTTPSErrors: true });

test("Butter v1 keeps the journey while browsing the gallery placeholders", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const gallery = page.getByRole("group", { name: "Gallery items" });
	for (const name of ["Board", "Agent selector", "Work item", "Pull request", "e2e Journey"]) {
		await expect(gallery.getByRole("button", { name: `Select ${name}` })).toBeVisible();
	}
	const boardTile = await gallery.getByRole("button", { name: "Select Board" }).boundingBox();
	const agentTile = await gallery.getByRole("button", { name: "Select Agent selector" }).boundingBox();
	if (!boardTile || !agentTile) throw new Error("Gallery tiles have no bounds");
	expect(agentTile.height).toBeGreaterThan(boardTile.height);
	await expect(gallery.getByRole("button", { name: "Select e2e Journey" })).toHaveAttribute("aria-pressed", "true");
	const selectedTile = gallery.getByRole("button", { name: "Select e2e Journey" });
	await expect(selectedTile.locator("canvas")).toHaveCount(0);
	const textColor = await gallery.getByRole("button", { name: "Select Board" }).locator(".text-text").evaluate((element) => getComputedStyle(element).color);
	await expect.poll(() => selectedTile.locator("div").evaluateAll((elements, color) => elements.some((element) => getComputedStyle(element).backgroundColor === color), textColor)).toBe(true);
	await expect(page.getByRole("group", { name: "Merchant onboarding journey steps" })).toBeVisible();
	const journeyColumn = page.locator('[data-butter-board-surface] [data-jira-kanban-column="To do"]');
	await expect(journeyColumn).toBeVisible();
	const journeyColumnBounds = await journeyColumn.boundingBox();
	if (!journeyColumnBounds) throw new Error("Journey column has no bounds");
	await page.getByRole("tab", { name: "List", exact: true }).click();
	await expect(page.getByRole("tab", { name: "List", exact: true })).toHaveAttribute("aria-selected", "true");
	await gallery.getByRole("button", { name: "Select Board" }).click();
	const board = page.getByRole("region", { name: "Payments SDK v2 Kanban board" });
	await expect(board).toBeVisible();
	const boardBounds = await board.boundingBox();
	const boardColumnBounds = await board.locator('[data-jira-kanban-column="To do"]').boundingBox();
	if (!boardBounds || !boardColumnBounds) throw new Error("Board has no bounds");
	expect(boardColumnBounds.width).toBeCloseTo(journeyColumnBounds.width, 0);
	expect(boardColumnBounds.y - boardBounds.y).toBeGreaterThanOrEqual(20);
	for (const name of ["To do", "In progress", "In review", "Done"]) {
		await expect(board.getByRole("button", { name: `Collapse ${name} column` })).toBeVisible();
	}
	await expect(board.getByText("Improve merchant onboarding for Payments SDK v2", { exact: true })).toBeVisible();
	await expect(page.getByRole("region", { name: /Unlink sessions/ })).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Open Rovo chat" })).toBeHidden();
	await expect(page.getByRole("tab", { name: "List", exact: true })).toBeHidden();
	await expect(page.getByRole("group", { name: "Merchant onboarding journey steps" })).toHaveCount(0);
	await gallery.getByRole("button", { name: "Select e2e Journey" }).click();
	await expect(page.getByRole("tab", { name: "List", exact: true })).toHaveAttribute("aria-selected", "true");
	await gallery.getByRole("button", { name: "Select Board" }).click();
	await board.locator('[data-jira-kanban-column="To do"]').hover();
	await board.getByRole("button", { name: "Collapse To do column" }).click();
	await gallery.getByRole("button", { name: "Select e2e Journey" }).click();
	await expect(page.getByRole("tab", { name: "List", exact: true })).toHaveAttribute("aria-selected", "true");
	await gallery.getByRole("button", { name: "Select Board" }).click();
	await expect(board.getByRole("button", { name: "Expand To do column" })).toBeVisible();
	await page.getByRole("button", { name: "Reset", exact: true }).click();
	await expect(board.getByRole("button", { name: "Collapse To do column" })).toBeVisible();
	await gallery.getByRole("button", { name: "Select e2e Journey" }).click();
	await page.getByRole("button", { name: "Reset", exact: true }).click();
	await expect(page.getByRole("tab", { name: "Board", exact: true })).toHaveAttribute("aria-selected", "true");
	await page.getByRole("button", { name: "Close gallery" }).click();
	await page.locator('[data-butter-board-surface] [data-issue-key="PAY-118"] [data-slot="jira-issue-card"]').click();
	const workItem = page.getByRole("dialog", { name: "Project butter" });
	await expect(workItem).toBeVisible();
	await workItem.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(workItem).toBeHidden();
	await page.getByRole("button", { name: "Open gallery" }).click();
	await expect(gallery.getByRole("button", { name: "Select e2e Journey" })).toBeVisible();
});

test("switching between the board and journey does not produce runtime errors", async ({ page }) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	page.on("console", (message) => { if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(message.text()); });
	await page.goto(appUrl("/butter-v1"));
	const gallery = page.getByRole("group", { name: "Gallery items" });
	await expect(page.getByRole("region", { name: /Unlink sessions/ })).toBeVisible();
	await gallery.getByRole("button", { name: "Select Board" }).click();
	await expect(page.getByRole("region", { name: "Payments SDK v2 Kanban board" })).toBeVisible();
	await gallery.getByRole("button", { name: "Select e2e Journey" }).click();
	await expect(page.getByRole("region", { name: /Unlink sessions/ })).toBeVisible();
	expect(errors).toEqual([]);
});

test("the standalone board is centered and remains scrollable on narrow screens", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board" }).click();
	const board = page.getByRole("region", { name: "Payments SDK v2 Kanban board" });
	const first = board.locator('[data-jira-kanban-column="To do"]');
	const last = board.locator('[data-jira-kanban-column="Done"]');
	await expect(first).toBeVisible();
	const [viewport, firstBounds, lastBounds] = await Promise.all([board.boundingBox(), first.boundingBox(), last.boundingBox()]);
	if (!viewport || !firstBounds || !lastBounds) throw new Error("Board columns have no bounds");
	expect(Math.abs((firstBounds.x - viewport.x) - (viewport.x + viewport.width - lastBounds.x - lastBounds.width))).toBeLessThan(2);
	await page.setViewportSize({ width: 700, height: 900 });
	await expect.poll(() => board.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
	const start = await first.boundingBox();
	const narrowViewport = await board.boundingBox();
	if (!start || !narrowViewport) throw new Error("Narrow board has no bounds");
	expect(start.x).toBeGreaterThanOrEqual(narrowViewport.x);
	await board.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
	await expect.poll(async () => {
		const end = await last.boundingBox();
		const visible = await board.boundingBox();
		return end && visible ? end.x + end.width - (visible.x + visible.width) : Infinity;
	}).toBeLessThanOrEqual(1);
});

test("the Board and e2e Journey share work-item changes", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board" }).click();
	const board = page.getByRole("region", { name: "Payments SDK v2 Kanban board" });
	const card = board.locator('[data-issue-key="PAY-118"][data-board-column-title]');
	await expect(card.getByRole("button", { name: "Add agent to PAY-118" })).toBeAttached();
	await card.locator('[data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await item.getByRole("button", { name: "Change assignee" }).click();
	await page.getByRole("option", { name: "Unassigned", exact: true }).click();
	await item.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(card.getByRole("img", { name: "Unassigned person" })).toBeVisible();
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	const journeyCard = page.locator('[data-butter-board-surface] [data-issue-key="PAY-118"][data-board-column-title]');
	await expect(journeyCard.getByRole("img", { name: "Unassigned person" })).toBeVisible();
	await page.getByRole("group", { name: "Merchant onboarding journey steps" }).getByRole("button", { name: "In progress", exact: true }).click();
	await page.getByRole("button", { name: "Select Board" }).click();
	await expect(board.locator('[data-issue-key="PAY-999"][data-board-column-title="In progress"]')).toBeVisible();
});

test("journey board filters survive switching gallery tiles", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const filter = page.getByRole("button", { name: "Filter board by Venn" });
	await filter.click();
	await expect(filter).toHaveAttribute("aria-pressed", "true");
	await page.getByRole("button", { name: "Select Board" }).click();
	await expect(page.getByRole("region", { name: "Payments SDK v2 Kanban board" })).toBeVisible();
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	await expect(filter).toHaveAttribute("aria-pressed", "true");
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

test("the original Butter session menu still offers Add agent", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-105"][data-board-column-title]').getByRole("button", { name: "Cursor: Working" }).click();
	await expect(page.getByRole("dialog", { name: "Agent assignment" }).getByRole("button", { name: "Add agent", exact: true })).toBeVisible();
});

test("session titles describe their work in grouped, review, and List views", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
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
	await row.getByRole("button", { name: "Edit agents" }).click();
	await expect(page.getByText("Replaying 3-D Secure fixtures", { exact: true })).toBeVisible();
	await expect(page.getByRole("dialog", { name: "Agent assignment" }).getByRole("button", { name: "Assign agent", exact: true })).toBeVisible();
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
	await page.getByRole("combobox", { name: "Search agents" }).fill("Cursor");
	await page.getByRole("option", { name: /^Cursor/ }).click();
	await page.getByRole("menu", { name: "Run Cursor on" }).getByRole("menuitem", { name: "Run on cloud" }).click();
	await card.getByRole("button", { name: /^Cursor: / }).click();
	await expect(page.getByRole("dialog", { name: "Agent assignment" }).getByText("Carry card-artwork metadata into the next wallet epic", { exact: true })).toBeVisible();
});

test("a coding session started from a work item uses its summary", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board" }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	const board = page.getByRole("region", { name: "Payments SDK v2 Kanban board" });
	await board.locator('[data-issue-key="PAY-105"] [data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await item.getByRole("button", { name: "Start coding" }).click();
	const chat = item.locator('[data-rovo-chat-placement="floating"]');
	await expect(chat.getByRole("textbox", { name: "Chat message input" })).toBeVisible();
	await chat.getByRole("button", { name: "Close", exact: true }).click();
	await item.getByRole("group", { name: "Agent field" }).getByRole("button").click();
	const sessions = page.getByRole("dialog", { name: "Agent sessions" });
	await expect(sessions.getByText("Port confirmPaymentIntent and the 3-D Secure challenge flow", { exact: true })).toBeVisible();
	await expect(sessions.getByRole("button", { name: "Add agent", exact: true })).toBeVisible();
});
