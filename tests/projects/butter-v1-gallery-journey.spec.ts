import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ actionTimeout: 7000, ignoreHTTPSErrors: true });

test("the journey agent finishes after the card arrives in Done", async ({ page }) => {
	test.setTimeout(90_000);
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	const steps = page.getByRole("group", { name: "Merchant onboarding journey steps" });
	const card = page.locator('[data-issue-key="PAY-999"][data-board-column-title]');
	await steps.getByRole("button", { name: "In progress" }).click();
	await expect(card).toHaveAttribute("data-board-column-title", "In progress");
	await expect(card.getByRole("button", { name: "Claude: Working" })).toBeVisible();
	await expect(page.locator('[data-issue-drop-flight="PAY-999"]')).toHaveCount(0);
	await steps.getByRole("button", { name: "Done" }).click();
	await expect(page.locator('[data-issue-drop-flight="PAY-999"]')).toBeAttached();
	await expect(card).toHaveAttribute("data-board-column-title", "Done");
	await expect(card.locator('[data-slot="jira-issue-agent-row"]')).toContainText("Working");
	await expect(card.getByRole("button", { name: "Claude: Finished" })).toBeVisible();
	await expect(card.getByRole("button", { name: "Claude: Finished" })).toHaveCount(0, { timeout: 10_000 });
	await expect(card).toBeVisible();
});

test("the journey agent finishes after moving to Done with reduced motion", async ({ page }) => {
	test.setTimeout(90_000);
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const steps = page.getByRole("group", { name: "Merchant onboarding journey steps" });
	const card = page.locator('[data-issue-key="PAY-999"][data-board-column-title]');
	await steps.getByRole("button", { name: "In progress" }).click();
	await expect(card).toHaveAttribute("data-board-column-title", "In progress");
	await steps.getByRole("button", { name: "Done" }).click();
	await expect(card).toHaveAttribute("data-board-column-title", "Done");
	await expect(card.getByRole("button", { name: "Claude: Finished" })).toBeVisible();
	await expect(card.getByRole("button", { name: "Claude: Finished" })).toHaveCount(0, { timeout: 10_000 });
});

for (const [answer, reply] of [
	["Assume a 7-day sandbox window", "I’ll use a seven-day retention window for the sandbox replay"],
	["Do not replay keys against live accounts", "I’ll keep replay away from live accounts"],
	["Jordan signs off the retention window", "I’ll prepare the sandbox replay plan and ask Jordan"],
] as const) {
	test(`PAY-112 resumes after choosing ${answer}`, async ({ page }) => {
		await page.setViewportSize({ width: 1800, height: 1100 });
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("button", { name: "Close gallery" }).click();
		const card = page.locator('[data-issue-key="PAY-112"][data-board-column-title]');
		await expect(card).toHaveAttribute("data-board-column-title", "In review");
		await card.getByRole("button", { name: "Codex: Needs input" }).click();
		await page.getByRole("button", { name: "Review sandbox key retention", exact: true }).click();
		await page.getByRole("button", { name: new RegExp(answer) }).click();
		await expect(page.getByText(reply, { exact: false })).toBeVisible();
		await expect(page.getByText("That clarification card expired", { exact: false })).toHaveCount(0);
		await expect(card).toHaveAttribute("data-board-column-title", "In progress");
		await expect(card.getByRole("button", { name: "Codex: Working" })).toBeVisible();
		await expect(page.getByRole("log").getByRole("button", { name: "Working", exact: true })).toBeVisible();
		await expect(page.getByRole("button", { name: /Preparing sandbox replay checks/ })).toBeVisible();
		await page.waitForTimeout(4_000);
		await expect(page.getByRole("log").getByRole("button", { name: "Working", exact: true })).toBeVisible();
		await expect(page.getByText(/Thought for 0s/)).toHaveCount(0);
		await page.getByRole("button", { name: "Close", exact: true }).click();
		await card.getByRole("button", { name: "Codex: Working" }).click();
		await page.getByRole("button", { name: "Review sandbox key retention", exact: true }).click();
		await expect(page.getByText(reply, { exact: false })).toBeVisible();
		await expect(page.getByRole("log").getByRole("button", { name: "Working", exact: true })).toBeVisible();
		await page.waitForTimeout(4_000);
		await expect(page.getByRole("log").getByRole("button", { name: "Working", exact: true })).toBeVisible();
	});
}

test("PAY-112 uses the journey card move and trace when resumed on the board", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Close gallery" }).click();
	const card = page.locator('[data-issue-key="PAY-112"][data-board-column-title]');
	await card.getByRole("button", { name: "Codex: Needs input" }).click();
	await page.getByRole("button", { name: "Review sandbox key retention", exact: true }).click();
	await page.getByRole("button", { name: /Assume a 7-day sandbox window/ }).click();
	await expect(page.locator('[data-issue-drop-flight="PAY-112"]')).toBeAttached();
	await expect(page.locator('[data-issue-drop-trace]')).toBeAttached();
	await expect(card).toHaveAttribute("data-board-column-title", "In progress");
	await expect(card.getByRole("button", { name: "Codex: Working" })).toBeVisible();
});

test("PAY-112 keeps working after switching between agent sessions", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Close gallery" }).click();
	const card = page.locator('[data-issue-key="PAY-112"][data-board-column-title]');
	await card.getByRole("button", { name: "Codex: Needs input" }).click();
	await page.getByRole("button", { name: "Review sandbox key retention", exact: true }).click();
	await page.getByRole("button", { name: /Assume a 7-day sandbox window/ }).click();
	await expect(card.getByRole("button", { name: "Codex: Working" })).toBeVisible();
	await page.waitForTimeout(4_000);
	await expect(page.getByRole("log").getByRole("button", { name: /^(Working|Thinking)$/ })).toBeVisible();
	await expect(page.getByText(/Thought for 0s/)).toHaveCount(0);
	await page.getByRole("button", { name: "Close", exact: true }).click();
	await page.getByRole("button", { name: "In progress", exact: true }).click();
	const merchant = page.locator('[data-issue-key="PAY-999"][data-board-column-title]');
	await merchant.getByRole("button", { name: "Claude: Working" }).click();
	await page.getByRole("button", { name: "Improve merchant onboarding", exact: true }).click();
	await expect(page.getByText("Checking the sandbox quickstart", { exact: false }).first()).toBeVisible();
	await page.getByRole("button", { name: "Close", exact: true }).click();
	await card.getByRole("button", { name: "Codex: Working" }).click();
	await page.getByRole("button", { name: "Review sandbox key retention", exact: true }).click();
	await page.waitForTimeout(4_000);
	await expect(page.getByRole("log").getByRole("button", { name: /^(Working|Thinking)$/ })).toBeVisible();
	await expect(page.getByText(/Thought for 0s/)).toHaveCount(0);
});

test("PAY-112 resumes from List without waiting for a hidden board animation", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Close gallery" }).click();
	await page.getByRole("tab", { name: "List", exact: true }).click();
	const row = page.getByRole("row").filter({ hasText: "PAY-112" });
	await row.getByRole("button", { name: "Codex: Needs input" }).click();
	await page.getByRole("button", { name: "Review sandbox key retention", exact: true }).click();
	await page.getByRole("button", { name: /Assume a 7-day sandbox window/ }).click();
	await expect(row.getByRole("button", { name: "Codex: Working" })).toBeVisible();
	await expect(row.getByRole("button", { name: "Change status for PAY-112. Current status: In progress" })).toBeVisible();
});

test("closing the journey work item does not replay the board glow", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Close gallery" }).click();
	const card = page.locator('[data-issue-key="PAY-999"][data-board-column-title]');
	await card.locator('[data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await item.getByRole("button", { name: "Add agent", exact: true }).click();
	await page.getByRole("dialog", { name: "Add agent", exact: true }).getByRole("button", { name: "Claude (Recommended)", exact: true }).click();
	await expect(item.getByRole("button", { name: "Change status, In progress" })).toBeVisible({ timeout: 10_000 });
	await page.evaluate(() => {
		const board = document.querySelector("[data-butter-board-surface]");
		if (!board) throw new Error("Board not found");
		const observer = new MutationObserver(() => {
			if (board.querySelector('[data-jira-linking-glow-halo], [data-jira-linking-glow-backdrop]')) {
				document.documentElement.setAttribute("data-journey-board-glow-observed", "true");
			}
		});
		observer.observe(board, { childList: true, subtree: true });
	});
	await item.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(card).toHaveAttribute("data-board-column-title", "In progress");
	await expect(card.getByRole("button", { name: "Claude: Working" })).toBeVisible();
	await page.waitForTimeout(2_000);
	await expect(page.locator("html")).not.toHaveAttribute("data-journey-board-glow-observed", "true");
});

test("Claude starts before moving the work item to In progress", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Close gallery" }).click();
	const card = page.locator('[data-issue-key="PAY-999"][data-board-column-title]');
	await card.locator('[data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await page.clock.install();
	await item.getByRole("button", { name: "Add agent", exact: true }).click();
	await page.getByRole("dialog", { name: "Add agent", exact: true }).getByRole("button", { name: "Claude (Recommended)", exact: true }).click();
	const thread = item.locator('[data-jira-activity-entry-id^="invocation-"]');
	const statusChange = item.locator('[data-jira-activity-entry-id^="merchant-status-"]');
	await expect(thread.locator("[data-project-butter-session-start]")).toBeVisible();
	await expect(item.getByRole("button", { name: "Change status, To do" })).toBeVisible();
	await expect(card).toHaveAttribute("data-board-column-title", "To do");
	await expect(statusChange).toHaveCount(0);
	await page.clock.fastForward(3_000);
	await expect(thread.getByText(/I.m looking into this issue now/)).toBeVisible({ timeout: 6_000 });
	await expect(statusChange).toHaveCount(0);
	await item.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(card).toHaveAttribute("data-board-column-title", "To do");
	await page.clock.fastForward(2_000);
	await expect(card).toHaveAttribute("data-board-column-title", "In progress");
	await card.locator('[data-slot="jira-issue-card"]').click();
	await expect(statusChange).toContainText("changed status from To do to In progress", { timeout: 6_000 });
	await expect(item.getByRole("button", { name: "Change status, In progress" })).toBeVisible();
	await item.getByRole("button", { name: "Close Project butter work item" }).click();
	await page.getByRole("button", { name: "Reset", exact: true }).click();
	await card.locator('[data-slot="jira-issue-card"]').click();
	await item.getByRole("button", { name: "Add agent", exact: true }).click();
	await page.getByRole("dialog", { name: "Add agent", exact: true }).getByRole("button", { name: "Claude (Recommended)", exact: true }).click();
	await expect(thread.locator("[data-project-butter-session-start]")).toBeVisible();
	await item.getByRole("button", { name: "Close Project butter work item" }).click();
	await page.getByRole("button", { name: "Reset", exact: true }).click();
	await page.clock.fastForward(5_000);
	await expect(card).toHaveAttribute("data-board-column-title", "To do");
});

test("the journey keeps its embedded session card across stages and rewind", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Close gallery" }).click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	const card = page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]');
	for (const step of ["In progress", "Pull request", "Fix checks", "Done", "In progress"]) {
		if (await item.isVisible()) await item.getByRole("button", { name: "Close Project butter work item" }).click();
		await page.getByRole("button", { name: step, exact: true }).click();
		if (!await item.isVisible()) await card.click();
		const thread = item.locator('[data-jira-activity-entry-id^="invocation-"]');
		await expect(thread.locator("[data-project-butter-session-start]")).toContainText("Improve merchant onboarding");
		await expect(thread.locator("[data-project-butter-session-start]")).toContainText(step === "Done" ? "Finished" : "Working");
	}
});

test("journey checks wait for the PR card before progressing and fixing", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.clock.install();
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Close gallery" }).click();
	await page.getByRole("button", { name: "Pull request", exact: true }).click();
	const card = page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]');
	await card.click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	const development = item.getByRole("region", { name: "Pull request development" });
	await expect(development).toHaveAttribute("data-project-butter-development", "pr");
	await page.clock.fastForward(20_000);
	await expect(development).toHaveAttribute("data-project-butter-development", "pr");
	await development.getByRole("button", { name: /#284 Add merchant onboarding quickstart/ }).press("Enter");
	const flyout = page.getByRole("group", { name: "Pull request #284: Add merchant onboarding quickstart" });
	await expect(flyout).toBeVisible();
	for (const phase of ["failed", "fixing", "passed", "merged"]) {
		await page.clock.fastForward(5_000);
		await expect(development).toHaveAttribute("data-project-butter-development", phase);
		await expect(flyout).toBeVisible();
	}
	await expect(flyout).toContainText("Merged");
	await item.getByRole("button", { name: "Close Project butter work item" }).click();
	await page.getByRole("button", { name: "Fix checks", exact: true }).click();
	await expect(development).toHaveAttribute("data-project-butter-development", "failed");
	await page.clock.fastForward(20_000);
	await expect(development).toHaveAttribute("data-project-butter-development", "failed");
});

test("the e2e journey starts and resets with a complete ticket ready to invoke", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	const steps = page.getByRole("group", { name: "Merchant onboarding journey steps" });
	const invoke = steps.getByRole("button", { name: "Invoke", exact: true });
	const card = page.locator('[data-issue-key="PAY-999"][data-board-column-title]');
	const item = page.getByRole("dialog", { name: "Project butter" });
	await expect(invoke).toHaveAttribute("aria-pressed", "true");
	await expect(card.getByText("onboarding", { exact: true })).toBeVisible();
	await card.locator('[data-slot="jira-issue-card"]').click();
	await expect(item.getByRole("textbox", { name: "Work item description" })).toContainText("guided quickstart");
	await expect(item.getByRole("button", { name: /suggestions$/ })).toHaveCount(0);
	// Board work items open with Related work collapsed.
	await item.getByRole("button", { name: "Expand Related work" }).click();
	await expect(item.getByText("Merchant onboarding brief", { exact: true })).toBeVisible();
	await expect(item.getByText("Write the Payments SDK v2 sandbox quickstart", { exact: true })).toBeVisible();
	await expect(item.getByText("Confirm the English-only account allow-list", { exact: true })).toBeVisible();
	await expect(item.getByRole("region", { name: "Activity" })).toContainText("Start with the English-only pilot");
	await item.getByRole("button", { name: "Add agent", exact: true }).click();
	await page.getByRole("dialog", { name: "Add agent", exact: true }).getByRole("button", { name: "Claude (Recommended)", exact: true }).click();
	await expect(item.getByRole("region", { name: "Activity" })).toContainText("Venn added Claude");
	await item.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(card).toHaveAttribute("data-board-column-title", "In progress", { timeout: 10_000 });
	await expect(card.getByText("onboarding", { exact: true })).toBeVisible();
	await invoke.click();
	await expect(item.getByRole("textbox", { name: "Work item description" })).toContainText("guided quickstart");
	await expect(item.getByRole("region", { name: "Activity" })).not.toContainText("Venn added Claude");
	await item.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(card).toHaveAttribute("data-board-column-title", "To do");
	await expect(card.getByText("onboarding", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Reset", exact: true }).click();
	await expect(invoke).toHaveAttribute("aria-pressed", "true");
	await expect(card).toHaveAttribute("data-board-column-title", "To do");
	await card.locator('[data-slot="jira-issue-card"]').click();
	await expect(item.getByRole("textbox", { name: "Work item description" })).toContainText("guided quickstart");
	await expect(item.getByRole("button", { name: /suggestions$/ })).toHaveCount(0);
	await item.getByRole("button", { name: "Expand Related work" }).click();
	await expect(item.getByText("Write the Payments SDK v2 sandbox quickstart", { exact: true })).toBeVisible();
});

test("Butter v1 keeps the journey while browsing the gallery placeholders", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const gallery = page.getByRole("group", { name: "Gallery items" });
	await expect.poll(() => gallery.getByRole("button").evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")))).toEqual([
		"Select e2e Journey",
		"Select Agent & app selector",
		"Select Duplicative sessions",
		"Select Board",
		"Select Work item",
		"Select List",
		"Select Pull request",
		"Select Development panel",
	]);
	for (const name of ["Board", "Agent & app selector", "Work item", "List", "Pull request", "e2e Journey"]) {
		await expect(gallery.getByRole("button", { name: `Select ${name}` })).toBeVisible();
	}
	await expect(gallery.getByRole("button", { name: "Select e2e Journey" })).toHaveAttribute("aria-pressed", "true");
	await expect(page.getByRole("group", { name: "Merchant onboarding journey steps" })).toBeVisible();
	await gallery.getByRole("button", { name: "Select Agent & app selector" }).click();
	await expect(gallery.getByRole("button", { name: "Select Agent & app selector" })).toHaveAttribute("aria-pressed", "true");
	await expect(page.getByRole("region", { name: "Project Butter agent selector" })).toBeVisible();
	await gallery.getByRole("button", { name: "Select e2e Journey" }).click();
	const boardTile = await gallery.getByRole("button", { name: "Select Board" }).boundingBox();
	const agentTile = await gallery.getByRole("button", { name: "Select Agent & app selector" }).boundingBox();
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
	// The Rovo launcher now stays available on the standalone Board as well.
	await expect(page.getByRole("button", { name: "Open Rovo chat" })).toBeVisible();
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
	await gallery.getByRole("button", { name: "Select e2e Journey" }).click();
	await expect(page.getByRole("region", { name: /Unlink sessions/ })).toBeVisible();
	await gallery.getByRole("button", { name: "Select Board" }).click();
	await expect(page.getByRole("region", { name: "Payments SDK v2 Kanban board" })).toBeVisible();
	await gallery.getByRole("button", { name: "Select e2e Journey" }).click();
	await expect(page.getByRole("region", { name: /Unlink sessions/ })).toBeVisible();
	expect(errors).toEqual([]);
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
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	const filter = page.getByRole("button", { name: "Filter board by Venn" });
	await filter.click();
	await expect(filter).toHaveAttribute("aria-pressed", "true");
	await page.getByRole("button", { name: "Select Board" }).click();
	await expect(page.getByRole("region", { name: "Payments SDK v2 Kanban board" })).toBeVisible();
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	await expect(filter).toHaveAttribute("aria-pressed", "true");
});
