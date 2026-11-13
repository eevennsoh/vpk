import { expect, test, type Page } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";
import { openBoardWithSessions } from "@/tests/helpers/board";

const JIRA_TEAM_EU26_URL = appUrl("/jira-team-eu26");

async function openBoard(page: Page): Promise<void> {
	await openBoardWithSessions(page, JIRA_TEAM_EU26_URL);
}

test("session timestamps stay beside their labels and remain visible while resizing", async ({ page }) => {
	await openBoard(page);
	const column = page.getByLabel(/^Unlink sessions,/u);
	const handle = page.getByRole("separator", { name: "Resize Unlink sessions column" });
	const shortLabel = column.locator('a[title^="#"]').first();
	await expect(shortLabel).toBeAttached();
	// A short PR title must not acquire the spare width reserved for longer titles.
	await shortLabel.evaluate((element) => { element.textContent = "#1876: Runbook"; });
	for (const key of ["End", "Home", "End"]) {
		await handle.press(key);
		await expect(handle).toHaveAttribute("aria-valuenow", key === "Home" ? "280" : "560");
		await expect.poll(() => column.locator('a[title^="#"]').evaluateAll((links) => links.every((link) => {
			const row = link.parentElement!;
			const time = row.querySelector('[title="Last update"]')!;
			const range = document.createRange();
			range.selectNodeContents(link);
			const label = link.getBoundingClientRect();
			const text = range.getBoundingClientRect();
			const timestamp = time.getBoundingClientRect();
			return label.width <= text.width + 1
				&& timestamp.right <= row.getBoundingClientRect().right + 1
				&& timestamp.left >= label.right
				&& timestamp.height <= 17;
		}))).toBe(true);
	}
});

test("end-state digits do not animate their position during panel resizing", async ({ page }) => {
	await openBoard(page);
	const column = page.getByLabel(/^Unlink sessions,/u);
	await column.locator(".overflow-y-auto").evaluate((element) => { element.scrollTop = element.scrollHeight; });
	const count = column.locator('p > span[aria-hidden="true"] > span[aria-label]');
	await expect(count).toBeVisible();
	await expect.poll(() => count.evaluate((element) => [...element.children].every((digit) => getComputedStyle(digit).transform === "none"))).toBe(true);
	const handle = page.getByRole("separator", { name: "Resize Unlink sessions column" });
	const box = (await handle.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + 80);
	await page.mouse.down();
	for (const delta of [60, 120, 180, 240, 100, 0]) {
		await page.mouse.move(box.x + box.width / 2 + delta, box.y + 80);
		const offsets = await count.evaluate(async (element) => {
			await new Promise(requestAnimationFrame);
			return [...element.children].map((digit) => new DOMMatrixReadOnly(getComputedStyle(digit).transform).m41);
		});
		for (const offset of offsets) expect(Math.abs(offset)).toBeLessThan(1);
	}
	await page.mouse.up();
});
