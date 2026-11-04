import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("suggestion sources remain readable without clipping", async ({ page }) => {
	await page.setViewportSize({ width: 1235, height: 1100 });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	await page.getByRole("button", { name: /\d+ suggestions$/ }).click();
	await page.getByRole("button", { name: "Show as list" }).click();
	await page.getByRole("button", { name: "Why parent was suggested" }).click();
	const explanation = page.getByRole("dialog", { name: "Four sibling onboarding items already sit under this epic." });
	const source = explanation.getByText("PAY-961, PAY-972, PAY-988, PAY-990", { exact: true });
	await expect(source).toBeVisible();
	const lineBounds = () => source.evaluate((element) => {
		const text = document.createRange();
		text.selectNodeContents(element);
		const row = element.parentElement!.getBoundingClientRect();
		return [...text.getClientRects()].map((rect) => ({ left: rect.left - row.left, right: rect.right - row.right, top: Math.round(rect.top) }));
	});
	const bounds = await lineBounds();
	expect(bounds.length).toBeGreaterThan(0);
	for (const line of bounds) {
		expect(line.left).toBeGreaterThanOrEqual(-1);
		expect(line.right).toBeLessThanOrEqual(1);
	}
	await explanation.evaluate((element) => { element.style.width = "180px"; });
	await expect.poll(async () => new Set((await lineBounds()).map((line) => line.top)).size).toBeGreaterThan(1);
	for (const line of await lineBounds()) expect(line.right).toBeLessThanOrEqual(1);
	for (const key of ["PAY-961", "PAY-972", "PAY-988", "PAY-990"]) {
		const lines = await source.getByText(key, { exact: true }).evaluate((element) => {
			const text = document.createRange();
			text.selectNodeContents(element);
			return new Set([...text.getClientRects()].map((rect) => Math.round(rect.top))).size;
		});
		expect(lines).toBe(1);
	}
});
