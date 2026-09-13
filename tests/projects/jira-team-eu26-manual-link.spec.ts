import { expect, test, type Page } from "@playwright/test";

const JIRA_TEAM_EU26_URL = (
	process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"
) + "/jira-team-eu26";

async function openManualLinkBoard(page: Page): Promise<void> {
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.goto(JIRA_TEAM_EU26_URL);
	const options = page.getByRole("button", { name: "Unlink sessions column options" });
	await options.click();
	await expect(page.getByRole("menuitem", { name: "Expand", exact: true })).toBeVisible();
	const pin = page.getByRole("menuitem", { name: "Pin", exact: true });
	if (await pin.isVisible()) {
		await pin.click();
		await options.click();
	}
	await page.getByRole("menuitem", { name: "Expand", exact: true }).click();
	await expect(page.getByRole("button", { name: "Unpin Unlink sessions column" })).toBeVisible();
	await expect(page.locator("[data-agent-session-column-expansion]"))
		.toHaveAttribute("data-agent-session-column-expansion", "expanded");
}

for (const submitWith of ["Enter", "button"] as const) {
	test(`manual creation accepts keystrokes and submits with ${submitWith}`, async ({ page }) => {
		await openManualLinkBoard(page);
		const session = page.getByTestId("agent-session-row-lw-scope-thread");
		const more = session.getByRole("button", { name: /^More actions for/u });
		await more.focus();
		await more.press("Enter");
		await page.getByRole("menuitem", { name: /^Link work item/u }).click();
		await page.getByRole("tab", { name: "Create new" }).click();
		const input = page.getByRole("textbox", { name: "Name this work item" });
		await input.click();
		await input.pressSequentially("Manual creation regression");
		await expect(input).toHaveValue("Manual creation regression");
		for (const type of ["Bug", "Story", "Task"]) {
			await page.getByRole("menuitem", { name: /^Work item type:/u }).click();
			await page.getByRole("menuitemradio").filter({ hasText: new RegExp(`^${type}$`) }).click();
			await expect(input).toHaveValue("Manual creation regression");
		}
		await expect(input).toHaveAttribute("autocomplete", "off");
		await input.press("End");
		await input.pressSequentially(" done");
		if (submitWith === "Enter") await input.press("Enter");
		else await page.getByRole("button", { name: "Create work item", exact: true }).click();
		const card = page.locator('[data-board-column-title="To do"][data-issue-key]')
			.filter({ hasText: "Manual creation regression done" });
		await expect(card).toBeVisible();
		await expect(card.getByRole("button", { name: /^Open Claude in Rovo chat:/u })).toBeVisible();
		await expect(session).toHaveCount(0);
		await page.screenshot({ path: `output/agent-browser/manual-created-${submitWith}.png` });
	});
}

test("manual linking searches with keystrokes and uses the Jira linking glow", async ({ page }) => {
	await openManualLinkBoard(page);
	const session = page.getByTestId("agent-session-row-lw-scope-thread");
	const more = session.getByRole("button", { name: /^More actions for/u });
	await more.focus();
	await more.press("Enter");
	await page.getByRole("menuitem", { name: /^Link work item/u }).click();
	const search = page.getByRole("textbox", { name: "Search work items" });
	await search.click();
	await search.pressSequentially("PAY-118");
	await expect(search).toHaveValue("PAY-118");
	await page.getByRole("button", { name: /PAY-118 Carry card-artwork/u }).click();
	await expect(page.locator("[data-jira-linking-glow-halo]")).toBeVisible();
	await page.screenshot({ path: "output/agent-browser/manual-link-glow.png" });
	await expect(session).toHaveCount(0);
	await expect(page.locator('article', { has: page.getByText("PAY-118", { exact: true }) }).first().getByRole("button", { name: /^Open Claude in Rovo chat:/u })).toBeVisible();
});

