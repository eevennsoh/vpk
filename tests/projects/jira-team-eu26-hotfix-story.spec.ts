import { expect, test, type Page } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";
import { openJiraBoard } from "@/tests/helpers/board";

const JIRA_TEAM_EU26_URL = appUrl("/jira-team-eu26");

async function openBoard(page: Page): Promise<void> {
	await openJiraBoard(page, JIRA_TEAM_EU26_URL, { timeout: 5_000 });
}

test("finished agent sessions show their Cloud metadata in the assignment flyout", async ({ page }) => {
	await openBoard(page);
	const doneItems = page.getByRole("region", { name: "Done work items" });
	await doneItems.getByRole("button", { name: "Claude: Finished", exact: true }).click();
	const flyout = page.locator("[data-slot='popover-content']").filter({ hasText: "This week" });
	await expect(flyout.getByRole("img", { name: "Cloud session", exact: true })).toBeVisible();
	await expect(flyout.getByText("This week", { exact: true })).toBeVisible();
});

test("the Payments board is the only Golden Journey content inside Jira chrome", async ({ page }) => {
	await openBoard(page);

	await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
	await expect(page.getByRole("button", { name: "For you" })).not.toBeInViewport();
	await expect(page.getByLabel("Create", { exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Ask Rovo" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Jira Team EU26" })).toHaveCount(0);
	await expect(page.getByRole("group", {
		name: "Open a software delivery story chapter",
	})).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Jump to chapter" })).toHaveCount(0);
	const jiraTabs = page.getByRole("tablist").first();
	await expect(jiraTabs).toBeVisible();
	// ab4291f68 locked EU26 to Simple views off: Board and List are sibling Jira tabs,
	// so the tab bar itself is the work item view switcher.
	await expect(jiraTabs.getByRole("tab")).toHaveCount(7);
	await expect(jiraTabs.getByRole("tab", { name: "Board" })).toHaveAttribute("aria-selected", "true");

	const columns = page.locator("[data-jira-kanban-column]");
	await expect(columns).toHaveCount(4);
	await expect(columns.nth(0).locator("[data-variant='default']")).toHaveCount(4);
	await expect(columns.nth(1).locator("[data-variant='default']")).toHaveCount(4);
	await expect(columns.nth(2).locator("[data-variant='default']")).toHaveCount(8);
	await expect(columns.nth(3).locator("[data-variant='default']")).toHaveCount(4);
});

test("the Jira tabs switch away from and back to the board", async ({ page }) => {
	await openBoard(page);

	await page.getByRole("tab", { name: "Summary" }).click();
	await expect(
		page.getByRole("tabpanel", { name: /^Summary/u }).getByText("No RFP content here yet"),
	).toBeVisible();
	await expect(page.locator("[data-jira-kanban-column]")).toHaveCount(0);

	await page.getByRole("tab", { name: "Board" }).click();
	await expect(page.locator("[data-jira-kanban-column]")).toHaveCount(4);
});

// 0bce30118 removed the per-session Unlink button from EU26's comfortable cards, so a
// session is unlinked by dropping its chin on the Unlink sessions column.
test("an unlinked session stays in the Unlink sessions column across Board to List to Board", async ({ page }) => {
	await openBoard(page);
	const card = page.locator("article", { has: page.getByText("PAY-112", { exact: true }) });
	const chin = card.getByRole("button", { name: /^Codex: /u });
	const column = page.locator('[data-board-agent-session-drop-zone="untracked"]');
	const from = (await chin.boundingBox())!;
	const to = (await column.boundingBox())!;
	await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
	await page.mouse.down();
	await page.mouse.move(from.x + from.width / 2 + 6, from.y + from.height / 2 + 6, { steps: 3 });
	await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 12 });
	await expect(column).toHaveAttribute("data-board-agent-session-target", "untracked");
	await page.mouse.up();

	const detachedSession = page.locator("[data-agent-session-column]").getByTestId("agent-session-row-PAY-112:review-agent");
	await expect(detachedSession).toBeVisible();
	await expect(chin).toHaveCount(0);

	const jiraTabs = page.getByRole("tablist").first();
	await jiraTabs.getByRole("tab", { name: "List" }).click();
	await expect(jiraTabs.getByRole("tab", { name: "List" })).toHaveAttribute("aria-selected", "true");
	await jiraTabs.getByRole("tab", { name: "Board" }).click();
	await expect(jiraTabs.getByRole("tab", { name: "Board" })).toHaveAttribute("aria-selected", "true");
	await expect(detachedSession).toBeVisible();
	await expect(chin).toHaveCount(0);
});

test("Insights controls and content are absent from v5", async ({ page }) => {
	await openBoard(page);

	await expect(page.getByRole("button", { name: /^Insights/u })).toHaveCount(0);
	await expect(page.getByLabel("Open 3 new insights")).toHaveCount(0);
	await expect(page.getByRole("region", {
		name: "PAY · Payments SDK v2 migration insights",
	})).toHaveCount(0);
	await expect(page.locator("[data-jira-kanban-column]")).toHaveCount(4);
});

test("PAY-101 no longer leaves the board for a Build phase", async ({ page }) => {
	await openBoard(page);
	const pay101 = page.getByRole("button", {
		name: /^PAY-101: Inventory every v1 call site across services and name an owner for each/u,
	});
	await pay101.focus();
	await page.keyboard.press("Enter");

	await expect(page.locator("[data-jira-kanban-column]")).toHaveCount(4);
	await expect(page.getByRole("region", {
		name: "Inventory every v1 call site across services and name an owner for each",
	})).toHaveCount(0);
});

test("responsive Jira chrome releases and restores the sidebar without an update loop", async ({ page }) => {
	const consoleErrors: string[] = [];
	page.on("console", (message) => {
		if (message.type() === "error") consoleErrors.push(message.text());
	});
	await page.setViewportSize({ width: 1200, height: 800 });
	await openBoard(page);
	await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
	await page.getByRole("button", { name: "Expand sidebar" }).click();
	await expect(page.getByRole("button", { name: "Collapse sidebar" })).toBeVisible();

	await page.setViewportSize({ width: 1000, height: 800 });
	await expect(page.getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
	await page.setViewportSize({ width: 700, height: 800 });
	await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
	await page.setViewportSize({ width: 1200, height: 800 });
	await expect(page.getByRole("button", { name: "Collapse sidebar" })).toBeVisible();

	expect(consoleErrors.filter((message) => message.includes("Maximum update depth exceeded"))).toEqual([]);
});

test("the board stays inside the Jira shell at short viewport heights", async ({ page }) => {
	await page.setViewportSize({ width: 1200, height: 640 });
	await openBoard(page);
	const board = page.getByRole("region", {
		name: "Track the Payments SDK v2 migration. Scroll horizontally to review all delivery statuses.",
	});
	const boardBox = await board.boundingBox();
	expect(boardBox).not.toBeNull();
	expect((boardBox?.y ?? 0) + (boardBox?.height ?? 0)).toBeLessThanOrEqual(640);
});

for (const hostLabel of ["Cloud session", "Local session"]) {
	test(`the agent assignment stays open while its tooltip-free ${hostLabel} icon is hovered`, async ({ page }) => {
		await page.setViewportSize({ width: 1600, height: 900 });
		await openBoard(page);

		const card = page.locator("article", {
			has: page.getByText("PAY-123", { exact: true }),
		});
		await card.locator('[data-slot="jira-issue-agent-row"] button').click();
		const assignment = page.locator('[data-slot="popover-content"][aria-label="Agent assignment"]');
		await expect(assignment).toBeVisible();
		// 5a94282ce folded the teammate's Cloud session into an Other sessions disclosure.
		await assignment.getByRole("button", { name: "Other sessions", exact: true }).click();

		const hostIcon = assignment.getByRole("img", { name: hostLabel, exact: true });
		await hostIcon.hover();
		const tooltip = page.locator('[data-slot="tooltip-content"]', { hasText: hostLabel });
		await page.waitForTimeout(700);
		await expect(tooltip).toHaveCount(0);
		await expect(hostIcon).not.toHaveAttribute("tabindex");
		await expect(hostIcon).not.toHaveAttribute("title");
		await expect(assignment).toBeVisible();
		await page.screenshot({ path: `output/agent-browser/${hostLabel.replace(" ", "-").toLowerCase()}-no-tooltip.png` });

		await page.getByRole("heading", { name: "Jira Design" }).click();
		await expect(assignment).toBeHidden();
	});
}
