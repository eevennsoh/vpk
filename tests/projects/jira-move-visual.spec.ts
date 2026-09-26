import { expect, test, type Page } from "@playwright/test";

const origin = process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost";
test.use({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });

async function setMoveVisual(page: Page, enabled: boolean) {
	await page.getByRole("button", { name: "Settings", exact: true }).click();
	const option = page.getByRole("menuitemcheckbox", { name: "Move visual", exact: true });
	await expect(option).toHaveAttribute("aria-checked", String(!enabled));
	await option.focus();
	await page.keyboard.press("Enter");
	await page.keyboard.press("Escape");
}

async function startDrag(page: Page, code: string) {
	const card = page.locator(`[data-issue-key="${code}"] [draggable="true"]`).first();
	await card.scrollIntoViewIfNeeded();
	const box = (await card.boundingBox())!;
	await page.mouse.move(box.x + 70, box.y + 30);
	await page.mouse.down();
	await page.mouse.move(box.x + 100, box.y + 40, { steps: 5 });
	await expect(card).toHaveAttribute("data-dragging", "true");
}

for (const { route, code, targetTitle } of [
	{ route: "jira-team-eu26", code: "PAY-112", targetTitle: "In progress" },
	{ route: "jira-team-eu26-end", code: "TEU-1", targetTitle: "Done" },
]) {
	for (const reducedMotion of ["no-preference", "reduce"] as const) {
		test(`${route} switches move visuals and preserves card movement (${reducedMotion})`, async ({ page }) => {
			await page.emulateMedia({ reducedMotion });
			await page.goto(`${origin}/preview/projects/${route}`);
			await page.getByRole("button", { name: "Settings", exact: true }).click();
			await expect(page.getByRole("menuitemcheckbox", { name: "Move visual", exact: true })).toHaveAttribute("aria-checked", "true");
			await page.keyboard.press("Escape");
			await startDrag(page, code);
			const choices = page.getByRole("group", { name: "Choose a status in In progress" });
			await expect(page.locator("[data-board-column-header-copy-motion]").first()).toBeVisible();
			if (targetTitle === "In progress") {
				await expect(choices).toBeVisible();
				await expect(choices.locator("[data-jira-dropzone-ants-stroke]")).toHaveCount(reducedMotion === "reduce" ? 0 : 2);
			}
			await page.screenshot({ path: `output/agent-browser/move-visual/${route}-experimental-${reducedMotion}.png` });
			await page.keyboard.press("Escape");
			await page.mouse.up();

			await setMoveVisual(page, false);
			await page.reload();
			await page.getByRole("button", { name: "Settings", exact: true }).click();
			await expect(page.getByRole("menuitemcheckbox", { name: "Move visual", exact: true })).toHaveAttribute("aria-checked", "false");
			await page.keyboard.press("Escape");
			await startDrag(page, code);
			if (targetTitle === "In progress") {
				await expect(choices).toBeVisible();
				await expect(choices).toHaveCSS("border-top-width", "2px");
				await expect(choices.locator("[data-jira-dropzone-ants-stroke]")).toHaveCount(0);
			}
			await expect(page.locator("[data-issue-source-ghost-frame]")).toHaveCount(0);
			await page.screenshot({ path: `output/agent-browser/move-visual/${route}-default-${reducedMotion}.png` });
			const target = (await page.locator(targetTitle === "In progress" ? '[data-issue-status-zone="Paused"]' : '[data-jira-kanban-column="Done"]').boundingBox())!;
			await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 5 });
			await page.mouse.up();
			await expect(page.locator(`[data-jira-kanban-column="${targetTitle}"] [data-issue-key="${code}"]`)).toBeVisible();
			await expect(page.locator("[data-issue-drop-flight]")).toHaveCount(0);
			await setMoveVisual(page, true);
			await expect(page.locator(`[data-jira-kanban-column="${targetTitle}"] [data-issue-key="${code}"]`)).toBeVisible();
			await expect(page.locator("[data-board-column-header-copy-motion]").first()).toBeVisible();
		});
	}
}

test("dragging playground exposes both variants without resetting moved cards", async ({ page }) => {
	await page.goto(`${origin}/preview/blocks/jira-dragging`);
	await expect(page.getByRole("button", { name: "Experimental", exact: true })).toHaveAttribute("aria-pressed", "true");
	await page.getByRole("button", { name: "Default", exact: true }).click();
	await expect(page.locator("[data-jira-dragging]")).toHaveAttribute("data-variant", "default");
	await startDrag(page, "PAY-105");
	const done = (await page.locator('[data-jira-kanban-column="Done"]').boundingBox())!;
	await page.mouse.move(done.x + 80, done.y + 60, { steps: 5 });
	await page.mouse.up();
	await expect(page.locator('[data-jira-kanban-column="Done"] [data-issue-key="PAY-105"]')).toBeVisible();
	await startDrag(page, "PAY-107");
	const moved = (await page.locator('[data-jira-kanban-column="Done"] [data-issue-key="PAY-105"]').boundingBox())!;
	await page.mouse.move(moved.x + 80, moved.y + 10, { steps: 5 });
	const marker = page.locator('[data-issue-drop-before="PAY-105"] [data-insertion-line] > span');
	await expect(marker).toBeVisible();
	await expect(marker).toHaveCSS("width", "8px");
	await page.screenshot({ path: "output/agent-browser/move-visual/playground-default-circle.png" });
	await page.keyboard.press("Escape");
	await page.mouse.up();
	await page.getByRole("button", { name: "Experimental", exact: true }).click();
	await expect(page.locator("[data-jira-dragging]")).toHaveAttribute("data-variant", "experimental");
	await expect(page.locator('[data-jira-kanban-column="Done"] [data-issue-key="PAY-105"]')).toBeVisible();
});
