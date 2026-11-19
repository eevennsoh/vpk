import { expect, test } from "@playwright/test";

import { openJiraBoard } from "@/tests/helpers/board";
import { withDesignVariants } from "@/tests/helpers/design-variants";
import { appUrl } from "@/tests/helpers/origin";
import { collectPageErrors } from "@/tests/helpers/page-errors";
import { readShimmerWave } from "@/tests/helpers/shimmer-wave";

// BoardAutoArrangeAction (components/blocks/jira-kanban/experimental/components/board-auto-arrange.tsx)
// labels the toolbar's Auto arrange button with <ShimmerWave as="span"> once the selection's
// arrangement is ready (about 1 s after selecting, useBoardAutoArrange) and motion is allowed.
// The label stays until the arrangement runs, so it can be asserted without racing it.
const ROUTE = withDesignVariants("/jira-team-eu26", { autoArrange: true });
const LABEL = "Auto arrange";
const CARD = "PAY-118";

test.use({ viewport: { width: 1600, height: 1000 } });

test("the Auto arrange label is a span wave while ready, and the board arranges without a page error", { tag: "@smoke" }, async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	const errors = collectPageErrors(page);
	await openJiraBoard(page, appUrl(ROUTE));

	const toDoCard = page.locator(`[data-jira-kanban-column="To do"] [data-issue-key="${CARD}"]`);
	await expect(toDoCard, `${CARD} starts in To do`).toHaveCount(1);
	await toDoCard.locator("[draggable]").first().click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });

	const action = page.getByRole("button", { name: LABEL, exact: true });
	await expect(action, "Auto arrange becomes ready after preparing").toBeEnabled({ timeout: 10_000 });
	const wave = action.locator("[data-auto-arrange-shimmer] > *");
	await expect(wave).toHaveCount(1);
	expect(await readShimmerWave(wave)).toEqual({ tagName: "span", letters: LABEL.length, text: LABEL });

	await action.click();
	await expect(toDoCard, `${CARD} leaves To do`).toHaveCount(0);
	const arranged = page.locator(`[data-board-agent-session-drop-zone="issue"][data-issue-key="${CARD}"]`);
	await expect(arranged, `${CARD} lands in one column`).toHaveCount(1);
	await expect(arranged).not.toHaveAttribute("data-board-column-title", "To do");

	expect(errors.pageErrors, "no uncaught page error").toEqual([]);
});
