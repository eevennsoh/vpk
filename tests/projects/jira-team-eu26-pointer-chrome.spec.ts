import { expect, test } from "@playwright/test";

import { resolveAppOrigin } from "@/tests/helpers/origin";

const origin = resolveAppOrigin();
test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`EU26 column Add agent follows hover and keyboard focus, not pointer selection (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${origin}/jira-team-eu26`);
		const issue = page.locator('[data-board-agent-session-drop-zone="issue"][data-issue-key="PAY-112"]');
		const control = issue.locator("[data-jira-issue-activation-control]");
		const addAgent = page.getByRole("button", { name: "Add agent to In review", exact: true });
		await issue.locator("[draggable]").first().click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await expect(control).toBeFocused();
		await expect(control).toHaveAttribute("aria-pressed", "true");
		await page.mouse.move(80, 120);
		await expect(addAgent).toHaveCSS("opacity", "0");
		await expect(addAgent).toHaveCSS("pointer-events", "none");
		await page.screenshot({ path: `output/agent-browser/add-agent-reveal/pointer-selection-${reducedMotion}.png` });

		await page.locator('[data-jira-kanban-column="In review"] [data-slot="board-column-header"]').hover();
		await expect(addAgent).toHaveCSS("opacity", "1");
		await addAgent.click();
		await page.mouse.move(80, 120);
		await expect(addAgent).toHaveAttribute("data-open", "true");
		await expect(addAgent).toHaveCSS("opacity", "1");
		await expect(page.getByRole("menu").last()).toBeVisible();
		await page.keyboard.press("Escape");

		// Reach the action through Tab with the pointer outside the board.
		await addAgent.focus();
		await page.keyboard.press("Shift+Tab");
		await expect(addAgent).not.toBeFocused();
		await page.keyboard.press("Tab");
		await expect(addAgent).toBeFocused();
		expect(await addAgent.evaluate((node) => node.matches(":focus-visible"))).toBe(true);
		await expect(addAgent).toHaveCSS("opacity", "1");
		await expect(addAgent).toHaveCSS("pointer-events", "auto");
	});
}

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
			? issue.getByText("Rovo Desktop", { exact: true }).last()
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
