import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`Accept all applies suggestions without the cards flying away (${reducedMotion})`, async ({ page }) => {
		test.setTimeout(45_000);
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/butter"));
		await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
		const item = page.getByRole("dialog", { name: "Project butter" });
		await item.getByRole("button", { name: /suggestions$/ }).click();
		const card = page.locator("[data-top-card]");
		await expect(card).toBeVisible();
		await page.mouse.move(0, 0);
		await page.waitForTimeout(700);
		await card.evaluate((element) => {
			const initial = element.getBoundingClientRect().x;
			const started = performance.now();
			let furthest = 0;
			function sample(now: number) {
				if (element.isConnected) furthest = Math.max(furthest, Math.abs(element.getBoundingClientRect().x - initial));
				if (now - started < 600) requestAnimationFrame(sample);
				else document.documentElement.dataset.acceptAllCardTravel = String(furthest);
			}
			requestAnimationFrame(sample);
		});
		await page.getByRole("button", { name: "Accept all" }).click();
		await expect.poll(() => page.locator("html").getAttribute("data-accept-all-card-travel")).not.toBeNull();
		const travel = Number(await page.locator("html").getAttribute("data-accept-all-card-travel"));
		expect(travel).toBeLessThan(20);
		await expect(item.getByRole("textbox", { name: "Work item description" })).toContainText("guided quickstart", { timeout: 12_000 });
		await expect(item.getByRole("button", { name: "Change due date" })).toContainText("Dec 15, 2026", { timeout: 12_000 });
		await expect(item.getByRole("button", { name: /Venn updated description/ })).toBeVisible();
		await page.getByRole("button", { name: "Undo accepting 5 suggestions" }).click();
		await expect(item.getByRole("textbox", { name: "Work item description" })).not.toContainText("guided quickstart");
	});
}
