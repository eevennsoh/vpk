import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

const card = (page: Page, key: string) => page.locator(`[data-issue-key="${key}"][data-board-column-title]`);

test("the work item starts with Cursor and Jira Coding agent sessions", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item" }).click();
	const workItem = page.getByRole("region", { name: "Work item full screen view" });
	const field = workItem.getByRole("group", { name: "Agents field" });
	await expect(field.getByRole("button", { name: "2 agents" })).toBeVisible();
	await expect(field.getByRole("button", { name: "Cursor, add agent" })).toBeAttached();
	await expect(field.getByRole("button", { name: "Jira Coding agent, add agent" })).toBeAttached();
	await expect(field.getByRole("button", { name: /Claude|Jira Scoping agent/ })).toHaveCount(0);
	await expect(workItem.locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]')).toContainText("Review the onboarding flow");
	await expect(workItem.locator('[data-jira-activity-entry-id="invocation-butter-claude"]')).toHaveCount(0);
	await expect(workItem.locator('[data-jira-activity-entry-id="invocation-butter-scoping"]')).toHaveCount(0);
});

test("starting an agent adds a long-form session card to its activity thread", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item" }).click();
	const workItem = page.getByRole("region", { name: "Work item full screen view" });
	await workItem.getByRole("group", { name: "Agents field" }).getByRole("button", { name: "2 agents" }).click();
	await page.getByRole("dialog", { name: "Add agent" }).getByRole("button", { name: "Figma", exact: true }).click();
	const activity = workItem.getByRole("region", { name: "Activity" });
	const session = activity.locator("[data-project-butter-session-start]").first();
	const sessionHeader = session.locator('xpath=ancestor::*[@data-jira-activity-entry-id][1]').locator('[data-slot="jira-activity-comment-header"]').first();
	await expect(sessionHeader).toContainText("Venn added Figma");
	await expect(activity.locator('[data-jira-activity-entry-id^="agent-added-"]')).toHaveCount(0);
	await expect(session.getByRole("button", { name: "Private to Venn" })).toHaveCount(0);
	await expect(session.locator('xpath=ancestor::*[@data-jira-activity-entry-id][1]').locator('[data-slot="human-agent-avatar"]').first()).toHaveAttribute("aria-label", "Figma, used by Venn");
	await expect(session).toContainText("Redesign onboarding flow for new users");
	await expect(session).toContainText("Figma");
	await expect(session.getByRole("button", { name: "Working", exact: true })).toBeAttached();
	await expect(session.locator("[data-agent-list-title]")).toHaveText("Redesign onboarding flow for new users");
	const chat = page.locator('[data-rovo-chat-placement="floating"]');
	const reply = chat.getByRole("textbox", { name: "Chat message input" });
	await session.getByRole("button", { name: /^Redesign onboarding flow for new users/ }).click();
	await expect(reply).toBeVisible();
	await expect(chat.getByRole("log")).toContainText("Redesign onboarding flow for new users");
	await chat.getByRole("button", { name: "Close", exact: true }).click();
	await expect(reply).toHaveCount(0);
	await session.getByRole("button", { name: /^Redesign onboarding flow for new users/ }).click();
	await expect(reply).toBeVisible();
});

test("reply disclosure icon has no background on the hovered activity row", async ({ page }) => {
	await page.goto(appUrl("/preview/projects/butter-v1?embedded=1"));
	await page.getByRole("button", { name: "Select Work item" }).click();
	const thread = page.locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]');
	const toggle = thread.getByRole("button", { name: /Show 4 more replies/ });
	await toggle.hover();
	const icon = thread.locator('button[aria-controls] > span[aria-hidden]');
	// The icon keeps a surface fill that masks the timeline; on the hovered row it is painted with the row's hover color so no separate box shows.
	const matchesHoveredRow = () => icon.evaluate((element) => {
		const rowHover = getComputedStyle(element.closest("li")!, "::after").backgroundColor;
		return rowHover !== "rgba(0, 0, 0, 0)" && getComputedStyle(element).backgroundImage === `linear-gradient(in oklab, ${rowHover} 0px, ${rowHover} 100%)`;
	});
	await expect.poll(matchesHoveredRow).toBe(true);
	await toggle.click();
	await expect(page.getByRole("button", { name: "Hide replies" })).toHaveAttribute("aria-expanded", "true");
	await expect.poll(matchesHoveredRow).toBe(true);
});

test("activity timeline dots are centered on the dashed line", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-999").locator('[data-slot="jira-issue-card"]').click();
	const rail = page.getByRole("listbox", { name: "Navigate activity" });
	await expect(rail).toBeVisible();
	const line = rail.locator(":scope > span").first();
	const dot = rail.locator('[data-slot="scrubber-playhead"]');
	await expect.poll(async () => {
		const [lineBox, dotBox] = await Promise.all([line.boundingBox(), dot.boundingBox()]);
		return lineBox && dotBox ? Math.abs(lineBox.y + lineBox.height / 2 - dotBox.y - dotBox.height / 2) : null;
	}).toBeLessThan(0.1);
});

test("the Butter board work item combines comments and changes under Activity", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-999").locator('[data-slot="jira-issue-card"]').click();
	const dialog = page.getByRole("dialog", { name: "Project butter" });
	const activity = dialog.getByRole("region", { name: "Activity" });
	await expect(activity.getByRole("heading", { name: "Activity" })).toBeVisible();
	await expect(dialog.getByRole("tablist", { name: "Activity views" })).toHaveCount(0);
	const summary = dialog.getByRole("textbox", { name: "Work item summary" });
	await summary.fill("Improve onboarding for merchants");
	await summary.press("Enter");
	await expect(activity).toContainText("updated summary");
	await page.keyboard.press("m");
	const comment = dialog.getByRole("textbox", { name: "Comment editor" });
	await comment.fill("Ready for review");
	await comment.press("Enter");
	await expect(activity).toContainText("Ready for review");
	await expect(activity).toContainText("updated summary");
});

test("empty activity starts with who created the work item and places the comment bar 24 pixels below it", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/jira-work-item#project-butter"));
	await page.getByRole("switch", { name: "Empty" }).check();
	await page.getByRole("button", { name: "Modal", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "Project butter" });
	const tabs = dialog.locator('[data-jira-activity-entry-id="butter-empty-created"]');
	await expect(tabs).toContainText("created this work item");
	const comment = dialog.locator("[data-project-butter-comment-editor]");
	await expect(comment).toBeVisible();
	// The timeline ends in a short fade below its last row; the comment bar sits 24px below that end.
	const timelineEnd = tabs.locator("[data-jira-activity-end-fade]");
	await expect.poll(async () => {
		const [rowBox, endBox, commentBox] = await Promise.all([tabs.boundingBox(), timelineEnd.boundingBox(), comment.boundingBox()]);
		return rowBox && endBox && commentBox ? { tail: endBox.y - (rowBox.y + rowBox.height), gap: commentBox.y - (endBox.y + endBox.height) } : null;
	}).toEqual({ tail: 0, gap: 24 });
});

test("short work item activity ends without a viewport of blank space", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-118").locator('[data-slot="jira-issue-card"]').click();
	const feed = page.locator("[data-project-butter-activity-feed]");
	await expect(feed.locator("[data-jira-activity-entry-id]").last()).toBeVisible();
	await expect.poll(() => feed.evaluate((element) => {
		const last = element.querySelectorAll("[data-jira-activity-entry-id]");
		return element.getBoundingClientRect().bottom - last[last.length - 1].getBoundingClientRect().bottom;
	})).toBeLessThan(64);
});

test("the first work item opens without waiting for additional JavaScript", async ({ page }) => {
	test.setTimeout(60_000);
	await page.goto(appUrl("/butter"));
	const board = page.locator("[data-butter-board-surface]");
	await expect(board).toBeVisible({ timeout: 30_000 });
	await page.evaluate(() => {
		Object.assign(window, { workItemEntryTransitions: [] as string[] });
		document.addEventListener("transitionrun", (event) => {
			if (event.target instanceof HTMLElement && event.target.matches('[role="dialog"][data-slot="dialog-content"]')) {
				(window as typeof window & { workItemEntryTransitions: string[] }).workItemEntryTransitions.push(event.propertyName);
			}
		}, true);
	});
	let releaseChunks!: () => void;
	const chunksReleased = new Promise<void>((resolve) => { releaseChunks = resolve; });
	await page.route("**/_next/static/**/*.js", async (route) => {
		await chunksReleased;
		await route.continue();
	});
	try {
		await card(page, "PAY-105").locator('[data-slot="jira-issue-card"]').click();
		await expect(page.getByRole("dialog", { name: "Project butter" })).toBeVisible();
		await expect(page.getByRole("heading", { name: "Port confirmPaymentIntent and the 3-D Secure challenge flow" })).toBeVisible();
		await expect(page.getByText("Opening work item", { exact: false })).toHaveCount(0);
	} finally {
		releaseChunks();
	}
	await expect(page.getByRole("dialog", { name: "Project butter" })).toBeVisible();
	await expect.poll(() => page.evaluate(() => (window as typeof window & { workItemEntryTransitions: string[] }).workItemEntryTransitions)).toContain("opacity");
	await page.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(page.getByRole("dialog", { name: "Project butter" })).toBeHidden();
	await page.evaluate(() => { (window as typeof window & { workItemEntryTransitions: string[] }).workItemEntryTransitions = []; });
	await card(page, "PAY-107").locator('[data-slot="jira-issue-card"]').click();
	await expect(page.getByRole("heading", { name: "Move retry and backoff out of LegacyGatewayAdapter" })).toBeVisible();
	await expect.poll(() => page.evaluate(() => (window as typeof window & { workItemEntryTransitions: string[] }).workItemEntryTransitions)).toContain("opacity");
});

test("the first work item opens without motion when reduced motion is requested", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-105").locator('[data-slot="jira-issue-card"]').click();
	const dialog = page.getByRole("dialog", { name: "Project butter" });
	await expect(dialog).toBeVisible();
	await expect(dialog).toHaveCSS("transition-property", "none");
	await expect(dialog).toHaveCSS("opacity", "1");
});

test("opening work items leaves every synced session visible after overlapping arrivals", async ({ page }) => {
	test.setTimeout(240_000);
	await page.goto(appUrl("/butter"));
	await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible();
	const column = page.locator("[data-agent-session-column]");
	await expect(column.locator('[data-testid^="agent-session-row-"]').first()).toBeAttached();
	await card(page, "PAY-105").locator('[data-slot="jira-issue-card"]').click();
	await expect(page.getByRole("dialog", { name: "Project butter" })).toBeVisible();
	await page.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(page.locator("[data-butter-board-surface]")).toHaveAttribute("data-agent-session-sync", "settled", { timeout: 220_000 });
	await expect.poll(() => column.locator('[data-testid^="agent-session-row-"]').evaluateAll((rows) => rows.filter((row) => {
		const style = getComputedStyle(row);
		return Number(style.opacity) < 0.99 || style.visibility !== "visible";
	}).length), { timeout: 10_000 }).toBe(0);
	await expect(column.locator('[data-testid^="agent-session-row-"]')).toHaveCount(48);
	await card(page, "PAY-107").locator('[data-slot="jira-issue-card"]').click();
	await expect(page.getByRole("heading", { name: "Move retry and backoff out of LegacyGatewayAdapter" })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("dialog", { name: "Project butter" })).toBeHidden();
	await expect(column.locator('[data-testid^="agent-session-row-"]')).toHaveCount(48);
});
