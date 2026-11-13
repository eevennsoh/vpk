import { expect, test, type Locator, type Page } from "@playwright/test";

import { withDesignVariants } from "@/tests/helpers/design-variants";
import { appUrl } from "@/tests/helpers/origin";
import { openBoardWithSessions, revealCollapsedAgentSessionColumn } from "@/tests/helpers/board";

const JIRA_TEAM_EU26_URL = appUrl("/jira-team-eu26");
// 42f5e86b1 moved the collapsible timeline rail and its options menu behind Advanced timeline.
const JIRA_TEAM_EU26_ADVANCED_URL = appUrl(withDesignVariants("/jira-team-eu26", { advancedTimeline: true }));

async function openBoard(page: Page): Promise<void> {
	await openBoardWithSessions(page, JIRA_TEAM_EU26_URL);
}

async function openCollapsedBoard(page: Page): Promise<void> {
	await page.goto(JIRA_TEAM_EU26_ADVANCED_URL, { waitUntil: "domcontentloaded" });
	await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible({
		timeout: 15_000,
	});
	// 5c96e6a9f opens the column expanded and a1b70b260 rests a collapsed rail pinned;
	// collapse it and Unpin to return to the hover gutter these tests start from.
	await page.getByRole("button", { name: "Collapse Unlink sessions column" }).click();
	// Leave the column's focus and pointer, as the layout spec does. Opening the options
	// menu still leaves the session sync paused (listed in the PR).
	await page.getByRole("heading", { name: "Jira Design" }).click();
	const options = page.getByRole("button", { name: "Unlink sessions column options" });
	await expect(options).toBeVisible();
	await options.click();
	await page.getByRole("menuitem", { name: "Unpin", exact: true }).click();
	await page.getByRole("heading", { name: "Jira Design" }).hover();
	await expect(page.locator("[data-agent-session-column-hit-area]")).toHaveCount(1);
}

test("the session column keeps its action name and shows the unlinked header label", async ({ page }) => {
	await openBoard(page);
	await expect(page.getByLabel(/^Unlink sessions, \d+ sessions$/u)).toBeVisible();
	await expect(page.locator("[data-agent-session-column-header]")
		.getByText("Unlinked agent sessions", { exact: true })).toBeVisible();
	await expect(page.getByText("Unattached sessions", { exact: true })).toHaveCount(0);
});

test("Untracked pins and expands as separate axes", async ({ page }) => {
	await openCollapsedBoard(page);
	const host = page.locator("[data-agent-session-column-expansion]");
	const column = page.locator("[data-agent-session-column]");
	await expect(host).toHaveAttribute("data-agent-session-column-expansion", "gutter");
	await revealCollapsedAgentSessionColumn(page);
	const options = page.getByRole("button", { name: "Unlink sessions column options" });
	await options.hover();
	await expect(host).toHaveAttribute("data-agent-session-column-expansion", "preview");
	await expect(column).toHaveCSS("width", "32px");
	await options.click();
	await expect(page.getByRole("menuitem", { name: "Pin" })).toBeVisible();
	await expect(page.getByRole("menuitem", { name: "Expand" })).toBeVisible();
	await page.getByRole("menuitem", { name: "Expand" }).click();
	await expect(host).toHaveAttribute("data-agent-session-column-expansion", "expanded");
	await expect(host).not.toHaveAttribute("data-agent-session-column-pinned", "");
	await expect(column).toHaveCSS("width", "280px");
	await page.getByRole("heading", { name: "Jira Design" }).hover();
	await expect(host).toHaveAttribute("data-agent-session-column-expansion", "gutter");
	await revealCollapsedAgentSessionColumn(page);
	await expect(host).toHaveAttribute("data-agent-session-column-expansion", "expanded");
	await expect(column).toHaveCSS("width", "280px");
	await page.getByRole("button", { name: "Pin Unlink sessions column" }).click();
	await page.getByRole("heading", { name: "Jira Design" }).hover();
	await expect(host).toHaveAttribute("data-agent-session-column-expansion", "expanded");
	await expect(host).toHaveAttribute("data-agent-session-column-pinned", "");
	await page.getByRole("button", { name: "Unpin Unlink sessions column" }).click();
	await page.getByRole("heading", { name: "Jira Design" }).hover();
	await expect(host).toHaveAttribute("data-agent-session-column-expansion", "gutter");
	await revealCollapsedAgentSessionColumn(page);
	await page.getByRole("button", { name: "Unlink sessions column options" }).click();
	await page.getByRole("menuitem", { name: "Pin" }).click();
	await page.getByRole("heading", { name: "Jira Design" }).hover();
	await expect(host).toHaveAttribute("data-agent-session-column-expansion", "pinned");
	await expect(column).toHaveCSS("width", "32px");
	await page.getByRole("button", { name: "Unlink sessions column options" }).click();
	await page.getByRole("menuitem", { name: "Expand" }).click();
	await expect(host).toHaveAttribute("data-agent-session-column-expansion", "expanded");
	await page.getByRole("button", { name: "Collapse Unlink sessions column" }).click();
	await expect(host).toHaveAttribute("data-agent-session-column-expansion", "gutter");
	await expect(page.locator("[data-agent-session-column-hit-area]")).toHaveCount(1);
});

function getIssueArticle(page: Page, issueKey: string): Locator {
	return page.locator("article", {
		has: page.getByText(issueKey, { exact: true }),
	}).first();
}

function getIssueDropZone(page: Page, issueKey: string): Locator {
	return page.locator(
		`[data-board-agent-session-drop-zone="issue"][data-issue-key="${issueKey}"]`,
	);
}

async function getUntrackedSessionCount(page: Page): Promise<number> {
	const label = await page.getByLabel(/^Unlink sessions,/u).getAttribute("aria-label");
	const count = Number(label?.match(/\d+/u)?.[0]);
	expect(Number.isFinite(count)).toBe(true);
	return count;
}

async function dragPointer(
	source: Locator,
	target: Locator,
	page: Page,
): Promise<void> {
	const sourceBox = await source.boundingBox();
	const targetBox = await target.boundingBox();
	expect(sourceBox).not.toBeNull();
	expect(targetBox).not.toBeNull();
	if (!sourceBox || !targetBox) return;

	const sourcePoint = {
		x: sourceBox.x + sourceBox.width / 2,
		y: sourceBox.y + sourceBox.height / 2,
	};
	await page.mouse.move(sourcePoint.x, sourcePoint.y);
	await page.mouse.down();
	await page.mouse.move(sourcePoint.x + 4, sourcePoint.y + 4);
	await page.mouse.move(
		targetBox.x + targetBox.width / 2,
		targetBox.y + targetBox.height / 2,
		{ steps: 12 },
	);
	if (await target.getAttribute("data-board-agent-session-drop-zone") === "issue") {
		await expect(target).toHaveAttribute("data-board-agent-session-target", "attach");
	}
	const dragOverlay = page.locator("[data-session-drag-overlay]");
	await expect(dragOverlay).toHaveCount(1);
	expect(await dragOverlay.evaluate((node) => node.parentElement === document.body)).toBe(true);
	await page.mouse.up();
}

test("attaching onto a running session replaces that chin row instead of stacking", async ({ page }) => {
	await openBoard(page);

	const targetCard = getIssueArticle(page, "PAY-107");
	await targetCard.scrollIntoViewIfNeeded();
	// 72c89f90f renamed linked chins from "Open … in Rovo chat" to "Agent: state".
	const runningSession = targetCard.getByRole("button", {
		name: /^Claude: /u,
	});
	await expect(runningSession).toBeVisible();
	const restingBox = await targetCard.boundingBox();
	expect(restingBox).not.toBeNull();
	if (!restingBox) return;

	const untrackedSession = page.locator("[data-agent-session-column]")
		.getByTestId("agent-session-row-lw-scope-thread");
	const sourceBox = await untrackedSession.boundingBox();
	const dropZone = getIssueDropZone(page, "PAY-107");
	const targetBox = await dropZone.boundingBox();
	expect(sourceBox).not.toBeNull();
	expect(targetBox).not.toBeNull();
	if (!sourceBox || !targetBox) return;

	await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
	await page.mouse.down();
	await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 4, sourceBox.y + sourceBox.height / 2 + 4);
	await page.mouse.move(
		targetBox.x + targetBox.width / 2,
		targetBox.y + targetBox.height / 2,
		{ steps: 12 },
	);
	await expect(dropZone).toHaveAttribute("data-board-agent-session-target", "attach");
	await expect(targetCard.locator('[data-slot="jira-issue-attach-chin"]')).toBeVisible();
	await expect(targetCard.getByText("Link agent session")).toBeVisible();
	await expect(targetCard.locator('[data-slot="jira-issue-attach-chin-slot"]')).toHaveCSS("height", "32px");
	await expect(runningSession).toHaveCount(0);
	await expect(targetCard.locator('[data-slot="jira-issue-agent-row"]')).toHaveCount(0);

	const attachingBox = await targetCard.boundingBox();
	expect(attachingBox).not.toBeNull();
	if (!attachingBox) return;
	expect(attachingBox.height).toBe(restingBox.height);

	await page.mouse.up();
});

test("attaching onto PAY-118 replaces any session chin instead of stacking the dragged title", async ({ page }) => {
	await openBoard(page);

	const targetCard = page.locator("[data-issue-key='PAY-118']");
	await targetCard.scrollIntoViewIfNeeded();

	const untrackedSession = page.locator("[data-agent-session-column]")
		.getByTestId("agent-session-row-lw-scope-thread");
	const sourceBox = await untrackedSession.boundingBox();
	const dropZone = getIssueDropZone(page, "PAY-118");
	const targetBox = await dropZone.boundingBox();
	expect(sourceBox).not.toBeNull();
	expect(targetBox).not.toBeNull();
	if (!sourceBox || !targetBox) return;

	await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
	await page.mouse.down();
	await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 4, sourceBox.y + sourceBox.height / 2 + 4);
	await page.mouse.move(
		targetBox.x + targetBox.width / 2,
		targetBox.y + targetBox.height / 2,
		{ steps: 12 },
	);
	await expect(dropZone).toHaveAttribute("data-board-agent-session-target", "attach");
	await expect(targetCard.locator('[data-slot="jira-issue-attach-chin"]')).toHaveCount(1);
	await expect(targetCard.getByText("Link agent session")).toBeVisible();
	await expect(targetCard.locator('[data-slot="jira-issue-attach-chin-slot"]')).toHaveCSS("height", "32px");
	await expect(targetCard.locator('[data-testid^="agent-session-row-"]:visible')).toHaveCount(0);
	await expect(targetCard.getByText("Why the wallet was cut")).not.toBeVisible();
	await expect(targetCard.getByText("The adapter keep-or-delete")).not.toBeVisible();
	await expect(targetCard.getByText("Keep or delete the adapter")).not.toBeVisible();

	await page.mouse.up();
});

test("the gutter preview supports timeline traversal across wider session targets", async ({ page }) => {
	await openCollapsedBoard(page);
	const column = page.locator("[data-agent-session-column]");
	const count = column.locator("[data-agent-session-column-count]");
	const railList = column.locator("ul");
	const notches = column.locator("[data-agent-session-notch]");
	const sessionCount = await getUntrackedSessionCount(page);
	await expect(count).toHaveCSS("opacity", "0");
	await expect(railList).toHaveCSS("max-height", "244px");
	await expect(notches).toHaveCount(sessionCount);
	expect(sessionCount).toBeGreaterThan(10);
	await revealCollapsedAgentSessionColumn(page);
	await expect(column).toHaveCSS("width", "32px");
	await expect(notches.first()).toHaveCSS("width", "56px");
	await expect(count).toHaveCSS("opacity", "1");
	await expect(railList).toHaveCSS("max-height", "none");
	await expect(notches).toHaveCount(sessionCount);
	await notches.last().scrollIntoViewIfNeeded();
	await expect(notches.last()).toBeVisible();
	const expandControl = page.getByRole("button", { name: "Unlink sessions column options" });
	const countBox = await count.boundingBox();
	const expandBox = await expandControl.boundingBox();
	expect(countBox).not.toBeNull();
	expect(expandBox).not.toBeNull();
	if (!countBox || !expandBox) return;
	expect(countBox.height).toBe(24);
	expect(expandBox.height).toBe(24);
	expect(expandBox.width).toBe(56);
	expect(countBox.width).toBe(56);
	await expect(column.locator("..")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 24, 0)");
	const columnBox = await column.boundingBox();
	const firstBox = await notches.first().boundingBox();
	expect(columnBox).not.toBeNull();
	expect(firstBox).not.toBeNull();
	if (!columnBox || !firstBox) return;
	expect(firstBox.x + firstBox.width / 2).toBeCloseTo(columnBox.x + columnBox.width / 2, 0);

	// Traverse real buttons at both horizontal edges, beyond the old 24px target.
	// The restored flyout overlaps the last 8px on the popup-facing side.
	for (const x of [firstBox.x + 2, firstBox.x + firstBox.width - 10]) {
		for (let index = 0; index < 3; index += 1) {
			const notch = notches.nth(index);
			const box = await notch.boundingBox();
			expect(box).not.toBeNull();
			if (!box) return;
			await page.mouse.move(x, box.y + box.height / 2);
			await expect.poll(() => notch.evaluate((element) => element.matches(":hover"))).toBe(true);
			await expect(page.locator("[data-agent-session-column-hit-area]")).toHaveCount(0);
		}
	}

	// The extra width must stop before the adjacent board cards.
	const todoCard = getIssueArticle(page, "PAY-118");
	const todoBox = await todoCard.boundingBox();
	expect(todoBox).not.toBeNull();
	if (!todoBox) return;
	expect(firstBox.x + firstBox.width).toBeLessThanOrEqual(todoBox.x);
	await todoCard.hover();
	await expect(page.locator("[data-agent-session-column-hit-area]")).toBeVisible();
	await expect(notches.first()).toHaveCSS("width", "24px");
	await expect(count).toHaveCSS("opacity", "0");
	await expect(railList).toHaveCSS("max-height", "244px");
});

test("the rail preserves flyout spacing and assigns the gaps to neighboring dots", async ({ page }) => {
	await openCollapsedBoard(page);
	await revealCollapsedAgentSessionColumn(page);
	const column = page.locator("[data-agent-session-column]");
	await expect(column.locator("..")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 24, 0)");
	const first = column.locator("[data-agent-session-notch]").first();
	const second = column.locator("[data-agent-session-notch]").nth(1);
	await first.hover();
	const popup = page.locator('[data-slot="hover-card-content"]');
	await expect(popup).toBeVisible();
	const box = (await first.boundingBox())!;
	const columnBox = (await column.boundingBox())!;
	await expect.poll(async () => (await popup.boundingBox())!.x)
		.toBeCloseTo(columnBox.x + 32 - 4 + 8, 0);
	const nextBox = (await second.boundingBox())!;
	const boundary = (box.y + box.height / 2 + nextBox.y + nextBox.height / 2) / 2;
	for (const [y, expected] of [[boundary - 1, first], [boundary + 1, second]] as const) {
		await page.mouse.move(columnBox.x + 16, y);
		await expect.poll(() => expected.evaluate((element) => element.matches(":hover"))).toBe(true);
		await expect(expected.locator("img")).toHaveCSS("opacity", "1");
	}
});

test("the timeline stops magnifying during a session drag and resumes on hover", async ({ page }) => {
	await openCollapsedBoard(page);
	await revealCollapsedAgentSessionColumn(page);
	const notches = page.locator("[data-agent-session-column] [data-agent-session-notch]");
	const dots = notches.locator("span.size-1");
	const maxScale = () => dots.evaluateAll((nodes) => Math.max(...nodes.map(
		(node) => new DOMMatrixReadOnly(getComputedStyle(node).transform).a,
	)));
	const source = notches.first();
	await source.hover();
	await expect.poll(maxScale).toBeGreaterThan(1);
	await page.mouse.down();
	await page.mouse.up();
	await expect.poll(maxScale).toBeGreaterThan(1);
	const box = (await source.boundingBox())!;
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2 + 4, box.y + box.height / 2 + 4);
	await expect(page.locator("[data-session-drag-overlay]")).toHaveCount(1);
	for (const offset of [72, 144, 216]) {
		await page.mouse.move(box.x + 300, box.y + offset, { steps: 4 });
		await expect.poll(maxScale).toBe(1);
	}
	await page.screenshot({ path: "output/agent-browser/session-drag-timeline.png" });
	await page.mouse.move(700, 180);
	await page.mouse.up();
	await expect(page.locator("[data-session-drag-overlay]")).toHaveCount(0);
	await revealCollapsedAgentSessionColumn(page);
	await source.hover();
	await expect.poll(maxScale).toBeGreaterThan(1);
	const count = await getUntrackedSessionCount(page);
	await dragPointer(source, getIssueDropZone(page, "PAY-118"), page);
	await expect.poll(() => getUntrackedSessionCount(page)).toBe(count - 1);
});

test("diagonal travel keeps the current flyout while vertical scrubbing switches immediately", async ({ page }) => {
	await openCollapsedBoard(page);
	await revealCollapsedAgentSessionColumn(page);
	const column = page.locator("[data-agent-session-column]");
	await expect(column.locator("..")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 24, 0)");
	const first = column.locator("[data-agent-session-notch]").first();
	const second = column.locator("[data-agent-session-notch]").nth(1);
	const firstBox = (await first.boundingBox())!;
	const secondBox = (await second.boundingBox())!;
	const x = firstBox.x + firstBox.width / 2;
	const y = firstBox.y + firstBox.height / 2;
	await page.mouse.move(x, y);
	const popup = page.locator('[data-slot="hover-card-content"]');
	await expect(popup).toBeVisible();
	const firstText = (await popup.textContent())!;
	const popupBox = (await popup.boundingBox())!;
	// Cross the next dot's band on the way toward a lower action in this popup.
	await page.mouse.move(x + 10, secondBox.y + 3);
	expect(await popup.textContent()).toBe(firstText);
	await page.mouse.move(popupBox.x + 20, popupBox.y + 90, { steps: 5 });
	await expect(popup).toHaveText(firstText);
	await page.mouse.move(x, y);
	await page.mouse.move(x, secondBox.y + secondBox.height / 2);
	await expect(popup).not.toHaveText(firstText);
	// Stopping on a crossed row must not leave the previous session locked.
	await page.mouse.move(x, y);
	await expect(popup).toHaveText(firstText);
	await page.mouse.move(x + 10, secondBox.y + 3);
	await expect(popup).not.toHaveText(firstText, { timeout: 1000 });
	await page.keyboard.press("Escape");
	await expect(popup).toBeHidden();
	await first.focus();
	await expect(popup).toHaveText(firstText);
});

test("clicking a column session for PAY-121 spotlights that issue", async ({ page }) => {
	await openBoard(page);

	const columnSession = page.locator("[data-agent-session-column]")
		.getByTestId("agent-session-row-lw-kickoff-killswitch-session");
	await columnSession.click();

	const pay121 = page.locator("[data-issue-key='PAY-121']");
	const pay101 = page.locator("[data-issue-key='PAY-101']");
	await expect(pay121).toHaveClass(/bg-bg-accent-blue-subtlest/);
	await expect(pay101).toHaveClass(/opacity-40/);
	await expect(page.getByLabel(/^Unlink sessions,/u)).not.toHaveClass(/opacity-40/);
});

test("click auto-scroll keeps Untracked frozen and allows the status pane to scroll back", async ({ page }) => {
	await openBoard(page);

	const untrackedColumn = page.getByLabel(/^Unlink sessions,/u);
	const statusScrollport = page.locator("[data-jira-kanban-scrollport]");
	const frozenLeft = (await untrackedColumn.boundingBox())?.x;
	const columnSession = page.locator("[data-agent-session-column]")
		.getByTestId("agent-session-row-lw-kickoff-killswitch-session");
	const pay121 = page.locator("[data-issue-key='PAY-121']");
	const pay121ColumnScrollport = pay121.locator("xpath=ancestor::*[@data-jira-kanban-card-list]");

	await columnSession.click();
	await expect.poll(
		() => statusScrollport.evaluate((element) => element.scrollLeft),
	).toBeGreaterThan(0);
	await expect.poll(
		() => pay121ColumnScrollport.evaluate((element) => element.scrollTop),
	).toBeGreaterThan(0);

	await statusScrollport.evaluate((element) => {
		element.scrollTo({ behavior: "instant", left: 0 });
	});
	await pay121ColumnScrollport.evaluate((element) => {
		element.scrollTo({ behavior: "instant", top: 0 });
	});
	await page.waitForTimeout(500);

	expect(await statusScrollport.evaluate((element) => element.scrollLeft)).toBe(0);
	expect(await pay121ColumnScrollport.evaluate((element) => element.scrollTop)).toBe(0);
	expect((await untrackedColumn.boundingBox())?.x).toBe(frozenLeft);
	await expect(pay121).toHaveClass(/bg-bg-accent-blue-subtlest/);
});

test("the Untracked resize handle reveals on column hover and widens the pinned column", async ({ page }) => {
	await openBoard(page);

	const untrackedColumn = page.getByLabel(/^Unlink sessions,/u);
	const resizeHandle = page.getByRole("separator", {
		name: "Resize Unlink sessions column",
	});
	const resizeNotch = resizeHandle.locator(":scope > div");
	const widthFootprint = page.locator('[data-agent-session-column-footprint="width"]');
	const initialBox = await untrackedColumn.boundingBox();
	expect(initialBox).not.toBeNull();
	if (!initialBox) return;

	const visualGutters = await page.evaluate(() => {
		const well = document.querySelector("[data-agent-session-column]");
		const handle = document.querySelector(
			"[data-testid='jira-kanban-agent-session-column-resize-handle']",
		);
		const columns = [...document.querySelectorAll("[data-jira-kanban-column]")];
		if (!well || !handle || columns.length < 2) {
			return null;
		}
		const contentLeft = (column: Element) => {
			const title = column.getAttribute("data-jira-kanban-column");
			const label = [...column.querySelectorAll("span")].find((element) => (
				element.textContent === title
			));
			return (label ?? column).getBoundingClientRect().left;
		};
		const firstCards = columns[0].querySelectorAll("article");
		const firstContentRight = firstCards.length > 0
			? firstCards[firstCards.length - 1].getBoundingClientRect().right
			: columns[0].getBoundingClientRect().right;
		const wellRight = well.getBoundingClientRect().right;
		const firstLeft = contentLeft(columns[0]);
		const handleBox = handle.getBoundingClientRect();
		return {
			untrackedToFirst: firstLeft - wellRight,
			statusContentGap: contentLeft(columns[1]) - firstContentRight,
			handleCenter: handleBox.left + handleBox.width / 2,
			gapMid: wellRight + (firstLeft - wellRight) / 2,
		};
	});
	expect(visualGutters).not.toBeNull();
	if (!visualGutters) return;
	expect(Math.round(visualGutters.untrackedToFirst)).toBe(
		Math.round(visualGutters.statusContentGap),
	);
	expect(Math.abs(visualGutters.handleCenter - visualGutters.gapMid)).toBeLessThanOrEqual(1);

	await expect(resizeHandle).toHaveAttribute("aria-orientation", "vertical");
	await expect(resizeHandle).toHaveAttribute("aria-valuemin", "280");
	await expect(resizeHandle).toHaveAttribute("aria-valuemax", "560");
	await page.getByRole("heading", { name: "Jira Design" }).hover();
	await expect(resizeHandle).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
	await expect(resizeNotch).toHaveCSS("height", "64px");
	await expect(resizeNotch).toHaveCSS("opacity", "0");

	await untrackedColumn.hover();
	await expect(resizeNotch).toHaveCSS("opacity", "1");
	// Avoid the session flyout opened by hovering the middle of the column.
	await resizeHandle.hover({ position: { x: 4, y: 80 } });
	await expect(resizeNotch).toHaveCSS("scale", "1.05");
	const handleBox = await resizeHandle.boundingBox();
	expect(handleBox).not.toBeNull();
	if (!handleBox) return;

	await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + 80);
	await page.mouse.down();
	await expect(untrackedColumn).toHaveCSS("transition-property", "none");
	await expect(widthFootprint).toHaveCSS("transition-property", "none");
	await page.mouse.move(handleBox.x + handleBox.width / 2 + 96, handleBox.y + 80, {
		steps: 8,
	});
	await expect.poll(async () => (await resizeHandle.boundingBox())?.x ?? 0)
		.toBeGreaterThan(handleBox.x + 80);
	await page.mouse.up();

	await expect.poll(async () => (await untrackedColumn.boundingBox())?.width ?? 0)
		.toBeGreaterThan(initialBox.width + 80);
	await expect(resizeHandle).toHaveAttribute("aria-valuenow", "376");

	await page.getByRole("heading", { name: "Jira Design" }).hover();
	await expect(resizeNotch).toHaveCSS("opacity", "0");
});

test("a linked session moves atomically to another Jira work item", async ({ page }) => {
	await openBoard(page);

	const sourceCard = getIssueArticle(page, "PAY-112");
	// 72c89f90f renamed linked chins from "Open … in Rovo chat" to "Agent: state".
	const sourceSession = sourceCard.getByRole("button", {
		name: /^Codex: /u,
	});

	await dragPointer(sourceSession, getIssueDropZone(page, "PAY-118"), page);

	await expect(sourceCard.getByRole("button", {
		name: /^Codex: /u,
	})).toHaveCount(0);
	await expect(getIssueArticle(page, "PAY-118").getByRole("button", {
		name: /^Codex: /u,
	})).toBeVisible();
});

test("an unattached session card attaches to any Jira work item and leaves the column", async ({ page }) => {
	await openBoard(page);

	const untrackedColumn = page.locator("[data-agent-session-column]");
	const untrackedSession = untrackedColumn.getByTestId("agent-session-row-lw-scope-thread");
	const initialCount = await getUntrackedSessionCount(page);

	await dragPointer(untrackedSession, getIssueDropZone(page, "PAY-118"), page);

	await expect(untrackedColumn.getByTestId("agent-session-row-lw-scope-thread")).toHaveCount(0);
	await expect(page.getByLabel(`Unlink sessions, ${initialCount - 1} sessions`)).toBeVisible();
	// 72c89f90f renamed linked chins from "Open … in Rovo chat" to "Agent: state".
	await expect(getIssueArticle(page, "PAY-118").getByRole("button", {
		name: /^Claude: /u,
	})).toBeVisible();
});

test("dropping an Untracked session on Create new work item appends and reveals the Jira card", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await openBoard(page);

	const sessionId = "lw-scope-thread";
	const sessionTitle = "The adapter keep-or-delete argument still lives in a local Claude session";
	const untrackedColumn = page.locator("[data-agent-session-column]");
	const untrackedSession = untrackedColumn.getByTestId(`agent-session-row-${sessionId}`);
	const targetColumn = page.locator('[data-jira-kanban-column="In review"]');
	await targetColumn.scrollIntoViewIfNeeded();

	const cardList = targetColumn.locator("[data-jira-kanban-card-list]");
	await expect(cardList).toBeVisible();
	const initialOverflow = await cardList.evaluate((element) => ({
		clientHeight: element.clientHeight,
		scrollHeight: element.scrollHeight,
	}));
	expect(initialOverflow.scrollHeight).toBeGreaterThan(initialOverflow.clientHeight);
	await cardList.evaluate((element) => {
		element.scrollTop = 0;
	});

	const issueCards = targetColumn.locator(
		'[data-board-agent-session-drop-zone="issue"][data-issue-key]',
	);
	const initialCardCount = await issueCards.count();
	const initialLastIssueKey = await issueCards.last().getAttribute("data-issue-key");
	const restingCreateButton = targetColumn.getByRole("button", { name: "Create in In review" });
	const restingTargetBox = await restingCreateButton.boundingBox();
	const sourceBox = await untrackedSession.boundingBox();
	expect(restingTargetBox).not.toBeNull();
	expect(sourceBox).not.toBeNull();
	if (!restingTargetBox || !sourceBox) return;

	const sourcePoint = {
		x: sourceBox.x + sourceBox.width / 2,
		y: sourceBox.y + sourceBox.height / 2,
	};
	await page.mouse.move(sourcePoint.x, sourcePoint.y);
	await page.mouse.down();
	await page.mouse.move(sourcePoint.x + 4, sourcePoint.y + 4);
	await page.mouse.move(
		restingTargetBox.x + restingTargetBox.width / 2,
		restingTargetBox.y + restingTargetBox.height / 2,
		{ steps: 12 },
	);

	// Create wells replace their resting buttons only after the session drag starts.
	// cfc9fe2e8 renamed the well "Drop to create work item"; it names its armed state.
	const createDropZone = targetColumn.getByRole("button", {
		name: /^Drop to create work item in In review/u,
	});
	await expect(createDropZone).toBeVisible();
	const armedTargetBox = await createDropZone.boundingBox();
	expect(armedTargetBox).not.toBeNull();
	if (!armedTargetBox) return;
	await page.mouse.move(
		armedTargetBox.x + armedTargetBox.width / 2,
		armedTargetBox.y + armedTargetBox.height / 2,
		{ steps: 12 },
	);
	await expect(createDropZone).toHaveAccessibleName(/, selected drop target$/u);
	await page.screenshot({ path: "output/agent-browser/dropzone-expanded.png" });
	// Expanding the overlay must not resize or scroll the cards underneath it.
	expect(await cardList.evaluate((element) => element.clientHeight)).toBe(initialOverflow.clientHeight);
	expect(await cardList.evaluate((element) => element.scrollTop)).toBe(0);
	await page.evaluate(() => {
		const observeBlueCreateFlash = () => {
			const flashed = Array.from(document.querySelectorAll<HTMLElement>(
				'[data-board-agent-session-drop-zone="issue"]',
			)).some((card) => (
				card.className.includes("bg-bg-accent-blue-subtlest")
				|| card.querySelector<HTMLElement>('[data-slot="jira-issue-agent-backdrop"]')
					?.className.includes("bg-bg-accent-blue-subtlest")
			));
			if (flashed) {
				document.documentElement.setAttribute("data-blue-create-flash-observed", "true");
			}
		};
		const observer = new MutationObserver(observeBlueCreateFlash);
		observer.observe(document.body, {
			attributeFilter: ["class"],
			attributes: true,
			childList: true,
			subtree: true,
		});
		window.setTimeout(() => observer.disconnect(), 2000);
	});
	await page.mouse.up();

	await expect(issueCards).toHaveCount(initialCardCount + 1);
	expect(await cardList.evaluate((element) => element.clientHeight)).toBe(initialOverflow.clientHeight);
	const createdCard = issueCards.last();
	const createdIssueKey = await createdCard.getAttribute("data-issue-key");
	expect(createdIssueKey).toMatch(/^PAY-\d+$/u);
	expect(createdIssueKey).not.toBe(initialLastIssueKey);
	if (!createdIssueKey) return;
	await expect(createdCard.getByRole("button", {
		name: `${createdIssueKey}: ${sessionTitle}`,
	})).toBeVisible();
	await expect(createdCard.getByRole("button", {
		name: /^Claude: /u,
	})).toBeVisible();
	await expect(page.locator("html")).not.toHaveAttribute("data-blue-create-flash-observed", "true");
	await expect(untrackedColumn.getByTestId(`agent-session-row-${sessionId}`)).toHaveCount(0);

	await expect.poll(
		() => cardList.evaluate((element) => element.scrollTop),
	).toBeGreaterThan(0);
	await expect.poll(
		() => cardList.evaluate((element) => (
			Math.ceil(element.scrollHeight - element.clientHeight - element.scrollTop)
		)),
	).toBeLessThanOrEqual(1);
	await expect.poll(
		() => createdCard.evaluate((element) => {
			const scrollport = element.closest<HTMLElement>("[data-jira-kanban-card-list]");
			if (!scrollport) return false;
			const cardRect = element.getBoundingClientRect();
			const scrollportRect = scrollport.getBoundingClientRect();
			return cardRect.bottom >= scrollportRect.top
				&& cardRect.bottom <= scrollportRect.bottom + 1;
		}),
	).toBe(true);
	await expect(createDropZone).toHaveCount(0);
	expect(await cardList.evaluate((element) => element.clientHeight)).toBe(initialOverflow.clientHeight);
	await expect.poll(() => cardList.evaluate((element) => element.style.maskImage))
		.not.toContain("transparent 100%");
	await page.screenshot({ path: "output/agent-browser/dropzone-created.png" });
});

test("releasing an unattached session drag outside a Jira target makes no change", async ({ page }) => {
	await openBoard(page);

	const untrackedColumn = page.locator("[data-agent-session-column]");
	const untrackedSession = untrackedColumn.getByTestId("agent-session-row-lw-scope-thread");
	const initialCount = await getUntrackedSessionCount(page);
	await dragPointer(untrackedSession, page.getByRole("heading", { name: "Jira Design" }), page);

	await expect(untrackedSession).toBeVisible();
	await expect(page.getByLabel(`Unlink sessions, ${initialCount} sessions`)).toBeVisible();
	await expect(getIssueArticle(page, "PAY-118").getByRole("button", {
		name: /^Claude: /u,
	})).toHaveCount(0);
});

test("dragging an Untracked session leaves a disabled-opacity source ghost", async ({ page }) => {
	await openBoard(page);

	const session = page.locator("[data-agent-session-column]")
		.getByTestId("agent-session-row-lw-scope-thread");
	const surface = session.locator("article");
	const sourceBox = await surface.boundingBox();
	expect(sourceBox).not.toBeNull();
	if (!sourceBox) return;

	const sourcePoint = {
		x: sourceBox.x + sourceBox.width / 2,
		y: sourceBox.y + sourceBox.height / 2,
	};
	await page.mouse.move(sourcePoint.x, sourcePoint.y);
	await page.mouse.down();
	await page.mouse.move(sourcePoint.x + 80, sourcePoint.y, { steps: 4 });

	const placeholder = session.locator("[data-session-drag-placeholder]");
	const ghost = placeholder.locator(":scope > div").first();
	await expect(session).toHaveAttribute("aria-hidden", "true");
	await expect(session).toHaveAttribute("inert", "");
	await expect(ghost).toHaveCSS("opacity", "0.4");
	await expect(ghost).toHaveAttribute("aria-hidden", "true");
	await expect(ghost).toHaveAttribute("inert", "");
	await expect(placeholder).toHaveCSS("height", `${sourceBox.height}px`);
	await expect(page.locator("[data-session-drag-overlay]")).toHaveCount(1);

	await page.mouse.move(sourcePoint.x, sourcePoint.y);
	await page.mouse.up();
});

// 72c89f90f stopped chins opening Rovo chat directly; abcd91faa opens the assignment flyout.
test("a stationary linked-session click opens its assignment flyout without detaching", async ({ page }) => {
	await openBoard(page);

	const sourceCard = getIssueArticle(page, "PAY-112");
	const sourceSession = sourceCard.getByRole("button", {
		name: /^Codex: /u,
	});
	await sourceSession.click();

	await expect(page.locator('[data-slot="popover-content"][aria-label="Agent assignment"]')).toBeVisible();
	await expect(page.locator("[data-rovo-chat-placement='floating']")).toHaveCount(0);
	await expect(sourceSession).toBeVisible();
	await expect(sourceCard.getByTestId("agent-session-row-PAY-112:review-agent")).toHaveCount(0);
});
