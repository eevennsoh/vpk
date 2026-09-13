import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1800, height: 1100 } });

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`manual assignment keeps card content inside its shell (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
		await page.locator('[data-board-agent-session-drop-zone="issue"][data-issue-key="PAY-118"]').hover();
		await page.getByRole("button", { name: "More actions for PAY-118", exact: true }).click();
		await page.getByRole("menuitem", { name: "Assign agents Open submenu", exact: true }).click();
		const agent = page.getByRole("option").filter({ hasText: "Readiness Checker" });
		await expect(agent).toBeVisible();

		// Arm before the click so the first painted frame after assignment is covered.
		const samples = page.evaluate(async () => {
			const offsets: number[] = [];
			const started = performance.now();
			let movedAt: number | undefined;
			while (performance.now() - started < 5_000) {
				await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
				const moved = document.querySelector('[data-issue-key="PAY-118"][data-board-column-title="In progress"]');
				if (!moved) continue;
				movedAt ??= performance.now();
				const existing = document.querySelector('[data-issue-key="PAY-105"][data-board-column-title="In progress"]')!;
				const shell = existing.querySelector('[data-slot="jira-issue-agent-shell"]')!;
				const content = existing.querySelector('[data-slot="jira-issue-card"]')!;
				offsets.push(Math.abs(content.getBoundingClientRect().top - shell.getBoundingClientRect().top));
				if (performance.now() - movedAt > 800) break;
			}
			return offsets;
		});
		await agent.click();
		const offsets = await samples;
		expect(offsets.length).toBeGreaterThan(2);
		expect(Math.max(...offsets)).toBeLessThan(1);
		await expect(page.locator('[data-issue-key="PAY-118"][data-board-column-title="In progress"]')).toHaveCount(1);
		await page.screenshot({ path: `output/agent-browser/assignment-${reducedMotion}.png` });
	});
}
