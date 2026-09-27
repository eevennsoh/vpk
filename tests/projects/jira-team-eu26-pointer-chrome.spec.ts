import { expect, test } from "@playwright/test";

const origin = process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost";
test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

for (const [route, code] of [["jira-team-eu26", "PAY-118"], ["jira-team-eu26-end", "TEU-1"]]) {
	test(`${route} prevents accidental board focus rings and card text selection`, async ({ page }) => {
		await page.goto(`${origin}/${route}`);
		const board = page.locator("[data-jira-kanban-scrollport]");
		const issue = page.locator(`[data-issue-key="${code}"]`);
		const card = issue.locator("[draggable]").first();
		await expect(card).toBeVisible();
		await expect(board).toHaveAttribute("tabindex", "-1");
		// Pointer pickup focuses the board after keyboard input; it is a shortcut
		// receiver, rather than a second visible control surrounding all the cards.
		await page.keyboard.press("Tab");
		await board.evaluate((node: HTMLElement) => node.focus({ preventScroll: true }));
		await expect(board).toBeFocused();
		await expect(board).toHaveCSS("outline-style", "none");
		await expect(board).toHaveCSS("box-shadow", "none");
		await expect(card).toHaveCSS("user-select", "none");
		const text = route.endsWith("-end")
			? issue.locator('[data-slot="jira-issue-cover-heading"]').first()
			: issue.getByText("Carry card-artwork metadata into the next wallet epic", { exact: true });
		await text.dblclick();
		expect(await page.evaluate(() => window.getSelection()?.toString() ?? "")).toBe("");
		// Shift selection still works, and the actual activation control remains
		// focusable through keyboard navigation.
		await card.click({ position: { x: 100, y: 28 }, modifiers: ["Shift"] });
		const control = issue.locator("[data-jira-issue-activation-control]");
		await expect(control).toHaveAttribute("aria-pressed", "true");
		await page.keyboard.press("Tab");
		await control.focus();
		await expect(control).toBeFocused();
		await expect.poll(() => control.evaluate((node) => node.matches(":focus-visible"))).toBe(true);
		await expect(issue.locator('[data-slot="jira-issue-surface"]')).toHaveCSS("outline-width", "3px");
		await page.screenshot({ path: `output/agent-browser/pointer-chrome/${route}.png` });
	});
}
