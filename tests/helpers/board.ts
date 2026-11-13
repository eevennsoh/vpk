/**
 * Shared Jira board setup for browser specs. Each helper waits on an observable
 * condition (a heading, a row, an attribute), never on a fixed delay.
 */
import { expect, type Locator, type Page } from "@playwright/test";

export const BOARD_HEADING = "Jira Design";

export type OpenBoardOptions = Readonly<{
	/** How long the board heading may take to render on a cold dev server. */
	timeout?: number;
	waitUntil?: "domcontentloaded" | "load" | "networkidle";
}>;

/** Opens a Jira board page and waits for its heading. */
export async function openJiraBoard(page: Page, url: string, { timeout = 15_000, waitUntil = "domcontentloaded" }: OpenBoardOptions = {}): Promise<void> {
	await page.goto(url, { waitUntil });
	await expect(page.getByRole("heading", { name: BOARD_HEADING })).toBeVisible({ timeout });
}

/** Hovers the collapsed column's hit area until the column reveals itself. */
export async function revealCollapsedAgentSessionColumn(page: Page): Promise<void> {
	const hitArea = page.locator("[data-agent-session-column-hit-area]");
	const hitAreaBox = await hitArea.boundingBox();
	expect(hitAreaBox).not.toBeNull();
	if (!hitAreaBox) return;

	await page.mouse.move(
		hitAreaBox.x + hitAreaBox.width / 2,
		hitAreaBox.y + hitAreaBox.height / 2,
	);
	await expect(hitArea).toHaveCount(0);
}

export function unlinkSessionRow(page: Page, testId = "agent-session-row-lw-scope-thread"): Locator {
	return page.locator("[data-agent-session-column]").getByTestId(testId);
}

/**
 * Expands the Unlink sessions column from whichever state the board opened in:
 * already expanded, collapsed with a direct Expand button, or collapsed behind the
 * options menu (pinning first when the menu offers it).
 */
export async function expandUnlinkSessionsColumn(page: Page): Promise<void> {
	const session = unlinkSessionRow(page);
	if (await session.isVisible()) return;
	const directExpand = page.getByRole("button", { name: "Expand Unlink sessions column" });
	if (await directExpand.isVisible()) {
		await directExpand.click();
		await expect(session).toBeVisible();
		return;
	}
	if (await page.locator("[data-agent-session-column-hit-area]").count() > 0) {
		await revealCollapsedAgentSessionColumn(page);
	}
	const options = page.getByRole("button", { name: "Unlink sessions column options" });
	await options.click();
	const pin = page.getByRole("menuitem", { name: "Pin", exact: true });
	if (await pin.isVisible()) {
		await pin.click();
		await expect(page.locator("[data-agent-session-column-expansion]"))
			.toHaveAttribute("data-agent-session-column-expansion", "pinned");
		await expect(page.locator("[data-agent-session-column-hit-area]")).toHaveCount(0);
		await options.click();
	}
	await page.getByRole("menuitem", { name: "Expand" }).click();
	await expect(session).toBeVisible();
}

/** Opens a board and expands the Unlink sessions column so its rows are visible. */
export async function openBoardWithSessions(page: Page, url: string, options?: OpenBoardOptions): Promise<void> {
	await openJiraBoard(page, url, options);
	await expandUnlinkSessionsColumn(page);
}

/**
 * The create-dropzone setup: a 1440x1100 board with the Unlink sessions column
 * expanded at its 280px width and no hover card open. Returns the first session row.
 */
export async function openCreateDropzoneBoard(page: Page, url: string): Promise<Locator> {
	await page.setViewportSize({ width: 1440, height: 1100 });
	await page.goto(url);
	await expect(page.getByRole("heading", { name: BOARD_HEADING, exact: true })).toBeVisible();
	await expect(page.locator("[data-agent-session-column-expansion]")).toBeVisible();
	const expand = page.getByRole("button", { name: "Expand Unlink sessions column" });
	if (await expand.isVisible()) {
		await expand.click();
	} else if (!await page.getByRole("button", { name: "Collapse Unlink sessions column" }).isVisible()) {
		const options = page.getByRole("button", { name: "Unlink sessions column options" });
		await options.click();
		const pin = page.getByRole("menuitem", { name: "Pin", exact: true });
		if (await pin.isVisible()) {
			await pin.click();
			await options.click();
		}
		await page.getByRole("menuitem", { name: "Expand", exact: true }).click();
	}
	await expect(page.locator("[data-agent-session-column-expansion]"))
		.toHaveAttribute("data-agent-session-column-expansion", "expanded");
	await expect(page.locator("[data-agent-session-column]")).toHaveCSS("width", "280px");
	await page.getByRole("heading", { name: BOARD_HEADING, exact: true }).hover();
	await expect(page.locator('[data-slot="hover-card-content"]')).toHaveCount(0);
	const source = unlinkSessionRow(page);
	await expect(source).toBeVisible();
	return source;
}
