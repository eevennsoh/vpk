import { expect, test, type Page } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });

const issue = (page: Page, code: string) => page.locator(`[data-issue-key="${code}"] [draggable]`).first();
const selected = (page: Page) => page.locator('[data-board-agent-session-drop-zone="issue"]').evaluateAll((nodes) =>
	nodes.filter((node) => node.querySelector('[data-jira-issue-activation-control][aria-pressed="true"]')).map((node) => node.getAttribute("data-issue-key")));

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	for (const release of ["original position", "outside the board"] as const) {
		test(`releasing a drag at ${release} preserves selection and its anchor (${reducedMotion})`, async ({ page }) => {
			await page.emulateMedia({ reducedMotion });
			await page.goto(appUrl("/preview/blocks/jira-dragging"));
			await issue(page, "PAY-105").click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
			await issue(page, "PAY-107").click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
			const source = (await issue(page, "PAY-105").boundingBox())!;
			await page.mouse.move(source.x + 70, source.y + 30);
			await page.mouse.down();
			await page.mouse.move(source.x + 95, source.y + 35, { steps: 5 });
			await expect(issue(page, "PAY-105")).toHaveAttribute("data-dragging", "true");
			if (release === "outside the board") {
				await page.mouse.move(1500, 900, { steps: 5 });
				await page.mouse.move(1501, 900);
			}
			await page.mouse.up();
			await expect(issue(page, "PAY-105")).not.toHaveAttribute("data-dragging", "true");
			await expect.poll(() => page.locator('[data-jira-kanban-column="To do"] [data-board-agent-session-drop-zone="issue"]')
				.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-issue-key"))))
				.toEqual(["PAY-105", "PAY-107", "PAY-123", "PAY-130"]);
			await expect.poll(() => selected(page)).toEqual(["PAY-105", "PAY-107"]);
			await expect(page.getByRole("region", { name: "2 cards selected. Bulk actions available." })).toBeVisible();
			await page.screenshot({ path: `output/agent-browser/side-cancel-selection/${release.replaceAll(" ", "-")}-${reducedMotion}.png` });
			// Extending past the old endpoint proves the cancelled drag kept its anchor.
			await issue(page, "PAY-123").click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
			await expect.poll(() => selected(page)).toEqual(["PAY-105", "PAY-107", "PAY-123"]);
			await issue(page, "PAY-105").click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
			await expect.poll(() => selected(page)).toEqual(["PAY-105", "PAY-107", "PAY-123"]);
		});
	}

	test(`outside-column clicks clear the selection and its anchor (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/preview/blocks/jira-dragging"));
		await page.waitForLoadState("networkidle");
		await issue(page, "PAY-105").click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await issue(page, "PAY-107").click({ position: { x: 70, y: 30 } });
		await expect.poll(() => selected(page)).toEqual(["PAY-105"]);
		await page.locator('[data-jira-kanban-column="To do"]').click({ position: { x: 70, y: 14 } });
		await expect.poll(() => selected(page)).toEqual(["PAY-105"]);
		await page.locator('[data-jira-kanban-column="Done"]').click({ position: { x: 70, y: 14 } });
		await expect.poll(() => selected(page)).toEqual([]);
		await expect(page.locator('[data-slot="jira-toolbar"]')).toHaveCount(0);
		await issue(page, "PAY-123").click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await expect.poll(() => selected(page)).toEqual(["PAY-123"]);
		await page.mouse.click(980, 880);
		await expect.poll(() => selected(page)).toEqual([]);
		await page.screenshot({ path: `output/agent-browser/side-selection-dismiss/cleared-${reducedMotion}.png` });
	});

	test(`selected columns, modified clicks and toolbar portals preserve selection (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/preview/blocks/jira-dragging"));
		await page.waitForLoadState("networkidle");
		// Move a card into the second column through the existing native drag.
		const source = (await issue(page, "PAY-130").boundingBox())!;
		const done = (await page.locator('[data-jira-kanban-column="Done"]').boundingBox())!;
		await page.mouse.move(source.x + 70, source.y + 30);
		await page.mouse.down();
		await page.mouse.move(source.x + 95, source.y + 35, { steps: 5 });
		await page.mouse.move(done.x + 90, done.y + 100, { steps: 5 });
		await page.mouse.move(done.x + 91, done.y + 100);
		await page.mouse.up();
		await expect(page.locator('[data-jira-kanban-column="Done"] [data-issue-key="PAY-130"]')).toHaveCount(1);
		await issue(page, "PAY-105").click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await issue(page, "PAY-130").click({ position: { x: 70, y: 30 }, modifiers: ["ControlOrMeta"] });
		await expect.poll(() => selected(page)).toEqual(["PAY-105", "PAY-130"]);
		for (const title of ["To do", "Done"]) {
			await page.locator(`[data-jira-kanban-column="${title}"]`).click({ position: { x: 70, y: 14 } });
			await expect.poll(() => selected(page)).toEqual(["PAY-105", "PAY-130"]);
		}
		await page.getByRole("button", { name: "Select all", exact: true }).click();
		await expect.poll(() => selected(page)).toEqual(["PAY-105", "PAY-107", "PAY-123", "PAY-130"]);
		await page.getByRole("button", { name: /^(Add agent|Assign agents)$/ }).click();
		const search = page.getByRole("menu").locator("input").first();
		await search.click();
		await search.fill("Codex");
		await expect.poll(() => selected(page)).toEqual(["PAY-105", "PAY-107", "PAY-123", "PAY-130"]);
		await page.keyboard.press("Escape");
		await expect(page.getByRole("menu")).toHaveCount(0);
		await page.getByRole("button", { name: "More actions", exact: true }).click();
		await page.getByRole("menuitem", { name: "Change status", exact: true }).hover();
		await page.getByRole("menuitem", { name: "Done", exact: true }).click();
		await expect.poll(() => selected(page)).toEqual(["PAY-105", "PAY-107", "PAY-123", "PAY-130"]);
		await page.locator('[data-jira-kanban-column="Done"]').click({ position: { x: 70, y: 14 } });
		await expect.poll(() => selected(page)).toEqual(["PAY-105", "PAY-107", "PAY-123", "PAY-130"]);
		await page.locator('[data-jira-kanban-column="To do"]').click({ position: { x: 70, y: 14 } });
		await expect.poll(() => selected(page)).toEqual([]);
	});
}
