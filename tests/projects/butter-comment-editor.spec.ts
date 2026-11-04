import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

const card = (page: Page, key: string) => page.locator(`[data-issue-key="${key}"][data-board-column-title]`);

test("the comment bar has matching left and bottom insets", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-118").locator('[data-slot="jira-issue-card"]').click();
	const dialog = page.getByRole("dialog", { name: "Project butter" });
	const scrollport = dialog.locator("[data-project-butter-work-item] > div").first();
	const bar = dialog.locator("[data-project-butter-comment-bar]");
	await scrollport.evaluate((element) => {
		const activity = element.querySelector<HTMLElement>("[data-project-butter-activity]");
		if (activity) element.scrollTop += activity.getBoundingClientRect().top - element.getBoundingClientRect().top;
	});
	await expect(bar.getByRole("button", { name: "Add a comment" })).toBeVisible();
	const insets = () => bar.evaluate((element) => {
		const viewport = element.closest("[data-project-butter-work-item]")!.firstElementChild!.getBoundingClientRect();
		const bounds = element.getBoundingClientRect();
		return Math.abs((bounds.left - viewport.left) - (viewport.bottom - bounds.bottom));
	});
	await expect.poll(insets).toBeLessThan(1);
	await bar.getByRole("button", { name: "Add a comment" }).click();
	await expect.poll(insets).toBeLessThan(1);
	await scrollport.evaluate((element) => { element.scrollTop = element.scrollHeight; });
	await expect.poll(insets).toBeLessThan(1);
});

test("comment dictation does not scale controls with reduced motion", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-118").locator('[data-slot="jira-issue-card"]').click();
	await expect(page.getByRole("dialog", { name: "Project butter" })).toBeVisible();
	await page.keyboard.press("m");
	await page.getByRole("button", { name: "Start dictation" }).click();
	const scaled = await page.locator("[data-project-butter-comment-editor]").evaluate(async (editor) => {
		for (let frame = 0; frame < 12; frame += 1) {
			await new Promise(requestAnimationFrame);
			for (const element of editor.querySelectorAll("*")) {
				const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
				if (Math.abs(matrix.a - 1) > 0.001 || Math.abs(matrix.d - 1) > 0.001) return true;
			}
		}
		return false;
	});
	expect(scaled).toBe(false);
});

