import { expect, test, type Locator, type Page } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const JIRA_GOLDEN_JOURNEYS_V4_URL = appUrl("/preview/projects/jira-golden-journeys-v4?embedded=1");

function getIssueDropZone(page: Page, issueKey: string): Locator {
	return page.locator(
		`[data-board-agent-session-drop-zone="issue"][data-issue-key="${issueKey}"]`,
	);
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`board gap does not flicker over occupied session rows (${reducedMotion})`, async ({ page }) => {
		await page.setViewportSize({ width: reducedMotion === "reduce" ? 1100 : 1440, height: 900 });
		await page.emulateMedia({ reducedMotion });
		await page.goto(JIRA_GOLDEN_JOURNEYS_V4_URL);
		await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible();
		await page.locator("[data-agent-session-column-hit-area]").hover();
		await page.getByRole("button", { name: "Unlink sessions column options", exact: true }).click();
		await page.getByRole("menuitem", { name: "Pin" }).click();
		await page.getByRole("button", { name: "Unlink sessions column options", exact: true }).click();
		await page.getByRole("menuitem", { name: "Expand" }).click();
		const source = page.getByTestId("agent-session-row-lw-scope-thread");
		await source.scrollIntoViewIfNeeded();
		const card = getIssueDropZone(page, "PAY-105");
		const nextCard = getIssueDropZone(page, "PAY-107");
		const sourceBox = await source.boundingBox();
		const cardBox = await card.boundingBox();
		const emptyCard = getIssueDropZone(page, "PAY-118");
		const emptyBox = await emptyCard.boundingBox();
		expect(sourceBox).not.toBeNull();
		expect(cardBox).not.toBeNull();
		if (!sourceBox || !cardBox || !emptyBox) throw new Error("Missing visible drag source or board card");
		const x = cardBox.x + cardBox.width / 2;
		const bottom = cardBox.y + cardBox.height;
		const line = page.locator("[data-insertion-line]");
		await page.mouse.move(sourceBox.x + 100, sourceBox.y + 30);
		await page.mouse.down();
		await page.mouse.move(sourceBox.x + 115, sourceBox.y + 30);
		// A card without sessions really does grow: its full preview area must
		// be excluded so closing that area cannot move the original seam.
		const emptyX = emptyBox.x + emptyBox.width / 2;
		const emptyBottom = emptyBox.y + emptyBox.height;
		await page.mouse.move(emptyX, emptyBox.y + 60, { steps: 8 });
		await expect(emptyCard.locator("[data-session-attach-growth]")).toBeVisible();
		for (let step = 0; step < 4; step += 1) {
			await page.mouse.move(emptyX + step % 2, emptyBottom + 4);
			await expect(getIssueDropZone(page, "PAY-124").locator("[data-insertion-line]")).toBeVisible();
		}
		await page.mouse.move(x, cardBox.y + 60, { steps: 8 });
		await expect(card).toHaveAttribute("data-board-agent-session-target", "attach");
		// The attach placeholder replaces an existing 24px row. It must not
		// shift the invisible gap band while the visible card stays the same size.
		for (let step = 0; step < 8; step += 1) {
			await page.mouse.move(x + step % 2, bottom - 28);
			await expect(card).toHaveAttribute("data-board-agent-session-target", "attach");
			await expect(line).toHaveCount(0);
		}
		await page.mouse.move(x, bottom + 4);
		await expect(nextCard.locator("[data-insertion-line]")).toBeVisible();
		for (const offset of [-11, -13, -12, -14, -11, -13]) {
			await page.mouse.move(x, bottom + offset);
			await expect(line).toHaveCount(1);
			await expect(card).not.toHaveAttribute("data-board-agent-session-target", "attach");
			await expect(nextCard).not.toHaveAttribute("data-board-agent-session-target", "attach");
		}
		await page.screenshot({ path: `output/agent-browser/flash/gap-stable-${reducedMotion}.png` });
		await page.mouse.up();
		await expect(line).toHaveCount(0);
		const cards = page.locator('[data-board-column-title="In progress"][data-board-agent-session-drop-zone="issue"]');
		await expect(cards).toHaveCount(5);
		await expect(cards.nth(0)).toHaveAttribute("data-issue-key", "PAY-105");
		await expect(source).toHaveCount(0);
		await expect(cards.nth(2)).toHaveAttribute("data-issue-key", "PAY-107");
	});
}
