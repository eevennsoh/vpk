import { expect, test, type Page } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const JIRA_GOLDEN_JOURNEYS_V4_URL = appUrl("/jira-golden-journeys-v4");

async function revealCollapsedAgentSessionColumn(page: Page): Promise<void> {
	const hitArea = page.locator("[data-agent-session-column-hit-area]");
	const hitAreaBox = await hitArea.boundingBox();
	expect(hitAreaBox).not.toBeNull();
	if (!hitAreaBox) return;

	await page.mouse.move(
		hitAreaBox.x + hitAreaBox.width / 2,
		hitAreaBox.y + hitAreaBox.height / 2,
	);
	await expect(hitArea).toHaveCount(0);
}

async function openBoard(page: Page): Promise<void> {
	await page.goto(JIRA_GOLDEN_JOURNEYS_V4_URL, { waitUntil: "domcontentloaded" });
	await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible({
		timeout: 15_000,
	});
	const options = page.getByRole("button", { name: "Unlink sessions column options" });
	if (await options.isVisible()) {
		await revealCollapsedAgentSessionColumn(page);
		await options.click();
		await page.getByRole("menuitem", { name: "Pin" }).click();
		await page.getByRole("button", { name: "Unlink sessions column options" }).click();
		await page.getByRole("menuitem", { name: "Expand" }).click();
	}
	await expect(
		page.locator("[data-agent-session-column]").getByTestId("agent-session-row-lw-scope-thread"),
	).toBeVisible();
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
