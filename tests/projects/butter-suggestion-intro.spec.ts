import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("the grid and app stack animate in after the border trace", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter"));
	await page.evaluate(() => {
		const openObserver = new MutationObserver(() => {
			const trigger = document.querySelector<HTMLElement>('[data-suggestion-trigger][aria-expanded="true"]');
			const icons = document.querySelectorAll<HTMLElement>("[data-suggestion-sources] > div > div");
			if (!trigger || icons.length === 0) return;
			document.documentElement.dataset.suggestionOpenIconOpacity = String(Math.min(...Array.from(icons, (icon) => Number(getComputedStyle(icon).opacity))));
			openObserver.disconnect();
		});
		openObserver.observe(document.body, { attributes: true, childList: true, subtree: true, attributeFilter: ["aria-expanded"] });
		const observer = new MutationObserver(() => {
			const grid = document.querySelector<HTMLElement>("[data-suggestion-grid]");
			const icon = document.querySelector<HTMLElement>("[data-suggestion-sources] > div > div");
			if (!grid || !icon) return;
			const gridElement: HTMLElement = grid;
			const iconElement: HTMLElement = icon;
			observer.disconnect();
			const started = performance.now();
			let gridMin = 1;
			let iconMin = 1;
			function sample(now: number) {
				gridMin = Math.min(gridMin, Number(getComputedStyle(gridElement).opacity));
				iconMin = Math.min(iconMin, Number(getComputedStyle(iconElement).opacity));
				if (now - started < 1500) requestAnimationFrame(sample);
				else document.documentElement.dataset.suggestionIntro = JSON.stringify({ gridMin, iconMin, gridEnd: Number(getComputedStyle(gridElement).opacity), iconEnd: Number(getComputedStyle(iconElement).opacity) });
			}
			requestAnimationFrame(sample);
		});
		observer.observe(document.body, { childList: true, subtree: true });
	});
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	await expect(page.getByRole("button", { name: "Finding suggestions" })).toBeVisible();
	const summary = page.getByRole("textbox", { name: "Work item summary" });
	await summary.focus();
	await expect(page.getByRole("dialog", { name: "Work item suggestions", exact: true })).toHaveCount(0);
	await expect(page.locator("[data-suggestion-grid]")).toHaveCount(0);
	await expect.poll(() => page.locator("html").getAttribute("data-suggestion-intro"), { timeout: 12000 }).not.toBeNull();
	const result = JSON.parse((await page.locator("html").getAttribute("data-suggestion-intro")) ?? "{}");
	expect(result.gridMin).toBeLessThan(0.5);
	expect(result.iconMin).toBeLessThan(0.5);
	expect(result.gridEnd).toBeGreaterThan(0.95);
	expect(result.iconEnd).toBeGreaterThan(0.95);
	expect(Number(await page.locator("html").getAttribute("data-suggestion-open-icon-opacity"))).toBeGreaterThan(0.95);
	const suggestions = page.getByRole("dialog", { name: "Work item suggestions", exact: true });
	await expect(suggestions).toBeVisible();
	await expect(summary).toBeFocused();
	await suggestions.getByRole("button", { name: "Close suggestions" }).click();
	await expect(suggestions).toBeHidden();
	await page.getByRole("button", { name: "5 suggestions" }).click();
	await expect(suggestions).toBeVisible();
});

test("reduced motion shows the same banner without the entrance animation", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	await expect(page.getByRole("button", { name: /5 suggestions/ })).toBeVisible();
	await expect(page.locator("[data-suggestion-grid]")).toHaveCSS("opacity", "1");
	await expect(page.locator("[data-suggestion-sources] [data-slot='tile'][aria-label='Confluence']")).toBeVisible();
	await expect(page.getByRole("dialog", { name: "Work item suggestions", exact: true })).toBeVisible();
});

test("closing the suggestions during loading does not reopen them", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	await page.getByRole("button", { name: "Finding suggestions" }).click();
	const suggestions = page.getByRole("dialog", { name: "Work item suggestions", exact: true });
	await expect(suggestions).toBeVisible();
	await suggestions.getByRole("button", { name: "Close suggestions" }).click();
	await expect(page.getByRole("button", { name: "5 suggestions" })).toBeVisible({ timeout: 10_000 });
	await expect(page.locator("[data-suggestion-grid]")).toHaveCSS("opacity", "1", { timeout: 10_000 });
	await expect(suggestions).toBeHidden();
});
