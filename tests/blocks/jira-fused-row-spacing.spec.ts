import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test.use({ ignoreHTTPSErrors: true });

for (const width of [1440, 2048]) {
	for (const reducedMotion of ["no-preference", "reduce"] as const) {
		test(`fused agent rows have equal upper and lower gutters (${width}, ${reducedMotion})`, async ({ page }) => {
			await page.setViewportSize({ width, height: 1152 });
			await page.emulateMedia({ reducedMotion });
			await page.goto(appUrl("/components/blocks/jira-dragging"));
			await page.waitForLoadState("networkidle");
			const board = page.locator('[data-jira-dragging]');
			for (const code of ["PAY-105", "PAY-107", "PAY-123"]) {
				await board.locator(`[data-issue-key="${code}"] [draggable="true"]`).first().click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
			}
			await page.mouse.move(900, 30);
			await expect.poll(() => board.evaluate((root) => {
				const rect = (code: string, selector: string) => root.querySelector(`[data-issue-key="${code}"] ${selector}`)!.getBoundingClientRect();
				return [["PAY-105", "PAY-107"], ["PAY-107", "PAY-123"]].map(([code, next]) => {
					const face = rect(code, '[data-slot="jira-issue-surface"]');
					const row = rect(code, '[data-slot="jira-issue-agent-row"] button');
					const following = rect(next, '[data-slot="jira-issue-surface"]');
					return { above: row.top - face.bottom, below: following.top - row.bottom };
				});
			})).toEqual([{ above: 8, below: 8 }, { above: 8, below: 8 }]);
			await board.screenshot({ path: `output/agent-browser/fused-row-balance/balanced-${width}-${reducedMotion}.png` });
		});
	}
}
