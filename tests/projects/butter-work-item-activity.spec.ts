import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

const card = (page: Page, key: string) => page.locator(`[data-issue-key="${key}"][data-board-column-title]`);

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
	await expect.poll(async () => {
		const [tabsBox, commentBox] = await Promise.all([tabs.boundingBox(), comment.boundingBox()]);
		return tabsBox && commentBox ? commentBox.y - (tabsBox.y + tabsBox.height) : null;
	}).toBe(24);
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
