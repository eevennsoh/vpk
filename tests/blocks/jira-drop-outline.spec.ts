import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 2200, height: 1300 }, ignoreHTTPSErrors: true });

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	for (const count of [1, 4]) {
		test(`destination outline clears after moving ${count} issues (${reducedMotion})`, async ({ page }) => {
			await page.emulateMedia({ reducedMotion });
			await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://26b9.localhost"}/components/blocks/jira-dragging`);
			await page.waitForLoadState("networkidle");
			const board = page.locator("[data-jira-kanban-scrollport]");
			const issue = (code: string) => board.locator(`[data-issue-key="${code}"] [draggable="true"]`).first();
			if (count > 1) {
				await issue("PAY-105").click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
				await issue("PAY-130").click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
			}
			await issue("PAY-105").scrollIntoViewIfNeeded();
			const source = (await issue("PAY-105").boundingBox())!;
			const destination = board.locator('[data-jira-kanban-column="In review"]');
			const target = (await destination.boundingBox())!;
			const ring = destination.locator("[data-jira-kanban-column-drop-ring]");
			await page.mouse.move(source.x + 70, source.y + 30);
			await page.mouse.down();
			await page.mouse.move(source.x + 95, source.y + 35, { steps: 5 });
			await expect(issue("PAY-105")).toHaveAttribute("data-dragging", "true");
			await page.mouse.move(target.x + 90, target.y + 100, { steps: 5 });
			await page.mouse.move(target.x + 91, target.y + 100);
			await expect(ring).not.toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
			// Arm the outer hit area, then release inside the issue handler that stops bubbling.
			const body = (await destination.locator("[data-jira-kanban-column-content] > div").nth(1).boundingBox())!;
			await page.mouse.move(body.x + 90, body.y + body.height / 2);
			await page.mouse.move(body.x + 91, body.y + body.height / 2);
			await page.mouse.up();
			await expect(destination.locator("[data-issue-key]")).toHaveCount(count);
			await expect(ring).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
			await expect(destination).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
			await expect(page.locator("[data-issue-drop-flight]")).toHaveCount(0);
			await expect(destination.locator("[data-jira-creating-arrival=true]")).toHaveCount(0);
			await page.screenshot({ path: `output/agent-browser/jira-drop-outline/settled-${count}-${reducedMotion}.png` });
		});
	}
}
