import { expect, test } from "@playwright/test";

import { resolveAppOrigin } from "@/tests/helpers/origin";

const baseUrl = resolveAppOrigin();

for (const width of [1440, 1024]) {
	test(`Board and List keep a 16px session gutter at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.goto(`${baseUrl}/jira-team-eu26`, { waitUntil: "networkidle" });
		await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible();
		for (const tab of ["Board", "List"]) {
			await page.getByRole("tab", { name: tab, exact: true }).click();
			await expect.poll(() => page.evaluate((view) => {
				const sessions = document.querySelector("[data-agent-session-column-surface]");
				const content = view === "Board"
					? document.querySelector('[data-jira-kanban-column="To do"] > div')
					: document.querySelector("table")?.closest("section");
				return sessions && content
					? content.getBoundingClientRect().left - sessions.getBoundingClientRect().right
					: null;
			}, tab)).toBe(16);
		}
	});
}
