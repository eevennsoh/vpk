import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "../helpers/origin";

test.use({ ignoreHTTPSErrors: true });

async function toggleWacContent(page: Page, expandSessions = true) {
	await page.getByRole("button", { name: "Settings", exact: true }).click();
	const option = page.getByRole("menuitemcheckbox", { name: "WAC Content", exact: true });
	await option.focus();
	await page.keyboard.press("Enter");
	await expect(page.getByRole("menu")).toHaveCount(0);
	const expand = page.getByRole("button", { name: "Expand Unlink sessions column", exact: true });
	if (expandSessions && await expand.count() > 0) await expand.click();
}

test("enabling WAC starts sessions collapsed and lets the viewer expand them", async ({ page }) => {
	await page.setViewportSize({ width: 1720, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/jira-team-eu26"));
	await expect(page.getByRole("button", { name: "Collapse Unlink sessions column", exact: true })).toBeVisible();
	await toggleWacContent(page, false);
	const expand = page.getByRole("button", { name: "Expand Unlink sessions column", exact: true });
	await expect(expand).toBeVisible();
	await expect(page.getByRole("button", { name: "Collapse Unlink sessions column", exact: true })).toHaveCount(0);
	await expand.click();
	await page.getByRole("tab", { name: "List", exact: true }).click();
	await expect(page.getByRole("button", { name: "Collapse Unlink sessions column", exact: true })).toBeVisible();
	await toggleWacContent(page, false);
	await expect(page.getByRole("button", { name: "Collapse Unlink sessions column", exact: true })).toBeVisible();
	await toggleWacContent(page, false);
	await expect(expand).toBeVisible();
	await page.screenshot({ path: "output/agent-browser/wac-content/wac-sessions-collapsed.png" });
});

test("WAC keeps archived sessions and list drafts separate from the original preset", async ({ page }) => {
	await page.setViewportSize({ width: 1720, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/jira-team-eu26"));
	const originalSession = page.getByTestId("agent-session-row-lw-scope-thread");
	await expect(originalSession).toHaveCount(1);
	await toggleWacContent(page);
	const wacSession = page.getByTestId("agent-session-row-wac:lw-scope-thread");
	await expect(wacSession).toHaveCount(1);
	await wacSession.getByRole("button", { name: /More actions/ }).focus();
	await page.keyboard.press("Enter");
	await page.getByRole("menuitem", { name: "Dismiss", exact: true }).click();
	await expect(wacSession).toHaveCount(0);
	await toggleWacContent(page);
	await expect(originalSession).toHaveCount(1);
	await toggleWacContent(page);
	await expect(wacSession).toHaveCount(0);
	await page.getByRole("tab", { name: "List", exact: true }).click();
	await page.getByTestId("jira-list-footer-controls").getByRole("button", { name: "Create", exact: true }).click();
	const draft = page.getByPlaceholder("What needs to be done?", { exact: true });
	await draft.fill("Draft for WAC only");
	await toggleWacContent(page);
	await expect(draft).toHaveCount(0);
	await toggleWacContent(page);
	await expect(draft).toHaveValue("Draft for WAC only");
});

for (const scenario of [
	{ width: 1720, reducedMotion: "no-preference" },
	{ width: 1024, reducedMotion: "no-preference" },
	{ width: 1720, reducedMotion: "reduce" },
] as const) {
	test(`WAC content switches the board and list together (${scenario.width}, ${scenario.reducedMotion})`, async ({ page }) => {
		await page.setViewportSize({ width: scenario.width, height: 1100 });
		await page.emulateMedia({ reducedMotion: scenario.reducedMotion });
		await page.goto(appUrl("/jira-team-eu26"));
		await expect(page.getByRole("heading", { name: "Jira Design", exact: true })).toBeVisible();
		await toggleWacContent(page);
		await expect(page.getByRole("heading", { name: "Checkout roadmap", exact: true })).toBeVisible();
		const surface = page.locator('[data-jira-team-eu26-content="wac"]');
		await expect(surface).toBeVisible();
		await expect(page.locator('[data-current-user-id="diego-santos"]')).toBeVisible();
		await expect(page.locator('img[src*="/avatar-user/venn/"]')).toHaveCount(0);
		for (const [column, codes] of Object.entries({
			"To do": ["PAY-118", "PAY-124", "PAY-125"],
			"In progress": ["PAY-105", "PAY-107", "PAY-123"],
			"In review": ["PAY-112", "PAY-115", "PAY-119"],
			Done: ["PAY-101", "PAY-113"],
		})) {
			const cards = page.getByRole("region", { name: `${column} work items`, exact: true }).locator("[data-issue-key]");
			await expect.poll(() => cards.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-issue-key"))))
				.toEqual(codes);
		}
		for (const agent of ["Claude", "Cursor", "Codex", "GitHub Copilot", "Figma"]) {
			await expect(page.getByRole("button", { name: `Preview ${agent}`, exact: true })).toBeVisible();
		}
		const boardAssignees = page.getByRole("group", { name: "Board assignees", exact: true });
		for (const person of ["Diego Santos", "Jordan Okafor", "Maya Ferreira", "Priya Raman"]) {
			await expect(boardAssignees.getByRole("button", { name: `Filter board by ${person}`, exact: true })).toBeVisible();
		}
		await expect(boardAssignees.getByRole("button", { name: "Filter board by Venn", exact: true })).toHaveCount(0);
		await expect(boardAssignees).toHaveCSS("width", "186px");
		const todo = page.getByRole("region", { name: "To do work items", exact: true });
		for (const code of ["PAY-118", "PAY-124"]) {
			await expect(todo.locator(`[data-issue-key="${code}"] [data-slot="jira-issue-agent-row"]`)).toHaveCount(0);
		}
		await expect(todo.getByRole("button", { name: "Figma: Working", exact: true })).toBeVisible();
		await expect(page.getByRole("button", { name: "Claude: Finished", exact: true })).toBeVisible();
		const completedValidation = page.getByRole("region", { name: "Done work items", exact: true }).locator('[data-issue-key="PAY-113"]');
		await expect(completedValidation.getByRole("button", { name: "Codex: Finished", exact: true })).toBeVisible();
		await expect(completedValidation.getByRole("button", { name: "Codex: Working", exact: true })).toHaveCount(0);
		await expect(page.getByRole("button", { name: /PAY-(102|126):/ })).toHaveCount(0);
		await expect(page.getByRole("region", { name: "In progress work items", exact: true }).locator('[data-issue-key="PAY-105"] [data-slot="jira-issue-agent-row"]')).toHaveCount(0);
		await expect(page.getByRole("region", { name: "In review work items", exact: true }).getByRole("button", { name: "GitHub Copilot: Needs input", exact: true })).toBeVisible();
		const sessionColumn = page.getByRole("region", { name: /^Unlink sessions,/ });
		await expect(sessionColumn).toBeVisible();
		const sessionCount = Number((await sessionColumn.getAttribute("aria-label"))?.match(/\d+/)?.[0]);
		expect(sessionCount).toBeGreaterThanOrEqual(16);
		expect(sessionCount).toBeLessThanOrEqual(48);
		await page.getByRole("button", { name: "Settings", exact: true }).click();
		await expect(page.getByRole("menuitemcheckbox", { name: "WAC Content", exact: true })).toHaveAttribute("aria-checked", "true");
		await page.keyboard.press("Escape");
		await page.getByRole("tab", { name: "List", exact: true }).click();
		const listAssignees = page.getByRole("group", { name: "List assignees", exact: true });
		await expect(listAssignees.getByRole("button", { name: "Filter list by Venn", exact: true })).toHaveCount(0);
		for (const person of ["Diego Santos", "Jordan Okafor", "Maya Ferreira", "Priya Raman"]) {
			await expect(listAssignees.getByRole("button", { name: `Filter list by ${person}`, exact: true })).toBeVisible();
		}
		await expect(page.getByRole("button", { name: "Implement Google Pay option for Android checkout", exact: true })).toBeVisible();
		await expect(page.getByRole("button", { name: "Build real-time payment success and decline rate dashboard", exact: true })).toBeVisible();
		await expect(page.locator('img[src*="/avatar-user/venn/"]')).toHaveCount(0);
		for (const summary of ["Design subscription renewal receipt email template", "Optimize transaction history database query latency"]) {
			await expect(page.getByRole("button", { name: summary, exact: true })).toBeVisible();
		}
		await toggleWacContent(page);
		await expect(page.getByRole("heading", { name: "Jira Design", exact: true })).toBeVisible();
		await expect(page.locator('[data-jira-team-eu26-content="default"]')).toBeVisible();
		await page.getByRole("tab", { name: "Board", exact: true }).click();
		await expect(page.getByRole("button", { name: "PAY-118: Carry card-artwork metadata into the next wallet epic", exact: true })).toBeVisible();
		await toggleWacContent(page);
		await expect(page.getByRole("heading", { name: "Checkout roadmap", exact: true })).toBeVisible();
		await page.screenshot({ path: `output/agent-browser/wac-content/wac-${scenario.width}-${scenario.reducedMotion}.png` });
		if (scenario.width === 1720 && scenario.reducedMotion === "no-preference") {
			const themeControl = page.getByRole("button", { name: /^(Light|Dark|System) theme$/ });
			const originalTheme = await themeControl.getAttribute("aria-label");
			while (await themeControl.getAttribute("aria-label") !== "Light theme") await themeControl.click();
			await themeControl.click();
			await expect(themeControl).toHaveAttribute("aria-label", "Dark theme");
			expect(await themeControl.evaluate((element) => {
				const owner = element.closest("[data-color-mode]")!;
				const styles = getComputedStyle(owner);
				return {
					mode: owner.getAttribute("data-color-mode"),
					surface: styles.getPropertyValue("--ds-surface").trim(),
					text: styles.getPropertyValue("--ds-text").trim(),
				};
			})).toEqual({ mode: "dark", surface: expect.any(String), text: expect.any(String) });
			await page.screenshot({ path: "output/agent-browser/wac-content/wac-dark.png" });
			while (await themeControl.getAttribute("aria-label") !== originalTheme) await themeControl.click();
			await page.getByRole("button", { name: "Create in In review", exact: true }).click();
			const form = page.getByRole("dialog", { name: "Create in In review", exact: true });
			await form.getByRole("textbox", { name: "Name this work item" }).fill("WAC content follow-up");
			await form.getByRole("button", { name: "Create work item", exact: true }).click();
			const created = page.getByRole("region", { name: "In review work items", exact: true }).locator("[data-issue-key]").filter({ hasText: "WAC content follow-up" });
			await expect(created).toHaveCount(1);
			await expect(page.locator('img[src*="/avatar-user/venn/"]')).toHaveCount(0);
			await toggleWacContent(page);
			await expect(created).toHaveCount(0);
			await toggleWacContent(page);
			await expect(created).toHaveCount(1);
		}
	});
}
