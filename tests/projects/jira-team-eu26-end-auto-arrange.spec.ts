import { expect, test } from "@playwright/test";

const origin = process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost";
test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`keynote auto arrange sends all work items to Done (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${origin}/jira-team-eu26-end`);
		await page.getByRole("button", { name: "Create in Context", exact: true }).click();
		const name = page.getByRole("textbox", { name: "Name this work item", exact: true });
		await name.fill("New keynote item");
		await name.press("Enter");
		await expect(page.locator('[data-jira-kanban-scrollport] [data-issue-key]')).toHaveCount(14);
		await page.locator('[data-issue-key="TEU-1"] [draggable]').first().click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		// Opposite outer corners span all columns before the scoped toolbar expansion.
		await page.locator('[data-issue-key="TEU-13"] [draggable]').first().click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await page.getByRole("button", { name: "Select all", exact: true }).click();
		const arrange = page.getByRole("button", { name: "Auto arrange", exact: true });
		await expect(arrange).toBeEnabled();
		await expect(page.locator('[data-jira-kanban-column="Done"] [data-auto-arrange-count]')).toHaveAttribute("data-auto-arrange-count", "14");
		await arrange.click();
		const done = page.locator('[data-jira-kanban-column="Done"]');
		await expect(done.locator("[data-issue-key]")).toHaveCount(14);
		for (const title of ["Context", "Collaboration", "Confidence"]) {
			await expect(page.locator(`[data-jira-kanban-column="${title}"] [data-issue-key]`)).toHaveCount(0);
		}
		await expect(done.getByText("New keynote item", { exact: true })).toBeVisible();
		await expect(page.locator("[data-issue-drop-flight]")).toHaveCount(0);
		await expect(arrange).toHaveCount(0);
		await page.screenshot({ path: `output/agent-browser/keynote-auto-arrange/done-${reducedMotion}.png` });
	});
}
