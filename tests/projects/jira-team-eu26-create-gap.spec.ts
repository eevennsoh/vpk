import { expect, test } from "@playwright/test";

const origin = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

for (const width of [1720, 1440]) {
	test(`create button matches all four column gaps at ${width}px`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.setViewportSize({ width, height: 1100 });
		await page.goto(`${origin}/jira-team-eu26`);
		await expect(page.getByRole("heading", { name: "Jira Design", exact: true })).toBeVisible();
		await page.getByRole("heading", { name: "Jira Design", exact: true }).hover();

		for (const title of ["To do", "Done"]) {
			const button = page.locator(`[data-jira-kanban-column="${title}"]`)
				.getByRole("button", { name: `Create in ${title}` });
			await expect(button).toBeVisible();
			await expect.poll(() => button.evaluate((node) => {
				const buttonRect = node.getBoundingClientRect();
				const column = node.closest("[data-kanban-column-chrome]")!;
				const columnRect = column.getBoundingClientRect();
				const cards = column.querySelectorAll("[data-issue-key]");
				const lastCardRect = cards[cards.length - 1].getBoundingClientRect();
				const top = buttonRect.top - lastCardRect.bottom;
				return Math.max(
					Math.abs(top - (buttonRect.left - columnRect.left)),
					Math.abs(top - (columnRect.right - buttonRect.right)),
					Math.abs(top - (columnRect.bottom - buttonRect.bottom)),
				);
			})).toBeLessThanOrEqual(0.5);
		}

		await page.screenshot({ path: `output/agent-browser/side-gap/board-${width}.png` });
	});
}
