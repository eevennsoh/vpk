import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("switching Global and Inline starts each suggestion demo fresh", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Review suggestions", exact: true }).click();
	await page.getByRole("dialog").last().getByRole("button", { name: "Accept description" }).click();
	await expect(page.getByRole("textbox", { name: "Work item description" })).toContainText("Help merchants adopt");

	await page.getByRole("button", { name: "Inline", exact: true }).click();
	await expect(page.getByRole("textbox", { name: "Work item description" })).not.toContainText("Help merchants adopt");
	await expect(page.getByRole("button", { name: "Accept description" })).toBeVisible();
	await page.getByRole("button", { name: "Accept description" }).click();
	await expect(page.getByRole("button", { name: "Accept assignee" })).toBeVisible();

	await page.getByRole("button", { name: "Global", exact: true }).click();
	await expect(page.getByRole("textbox", { name: "Work item description" })).not.toContainText("Help merchants adopt");
	await page.getByRole("button", { name: "Review suggestions", exact: true }).click();
	const panel = page.getByRole("dialog").last();
	await expect(panel.getByRole("button", { name: "Accept description" })).toBeVisible();
	await expect(panel.locator("footer")).toContainText("0 of 5 reviewed");

	await page.getByRole("button", { name: "Inline", exact: true }).click();
	await expect(page.getByRole("button", { name: "Accept description" })).toBeVisible();
	await expect(page.getByRole("textbox", { name: "Work item description" })).not.toContainText("Help merchants adopt");
});

test("inline decisions let the remaining count roll before advancing", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions" }).click();
	await page.getByRole("button", { name: "Inline", exact: true }).click();
	const first = page.locator('[aria-label^="AI suggestion for description"]');
	await first.getByRole("button", { name: "Discard description" }).click();
	await expect(first).toContainText("4 suggestions left to review");
	await expect(first.getByRole("button", { name: "Discard description" })).toBeDisabled();
	await expect(page.getByRole("button", { name: "Discard assignee" })).toBeVisible();
});

test("reduced motion advances inline decisions immediately", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions" }).click();
	await page.getByRole("button", { name: "Inline", exact: true }).click();
	await page.getByRole("button", { name: "Discard description" }).click();
	await expect(page.getByRole("button", { name: "Discard assignee" })).toBeVisible();
});

test("accepting the first suggestion keeps the toolbar on its path to the next field", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Inline", exact: true }).click();
	const toolbar = page.locator('[aria-label^="AI suggestion for description"]');
	await expect(toolbar).toBeVisible();
	const result = await toolbar.evaluate(async (element) => {
		const destination = document.querySelector<HTMLElement>('[data-field-id="assignee"] [data-project-butter-detail-value-row]');
		const accept = element.querySelector<HTMLButtonElement>('[aria-label="Accept description"]');
		if (!destination || !accept) throw new Error("The suggestion controls are missing");
		const start = element.getBoundingClientRect();
		const target = destination.getBoundingClientRect();
		const end = { x: target.right - start.width, y: target.bottom + 4 };
		const positions: { x: number; y: number }[] = [];
		let missing = 0;
		const began = performance.now();
		accept.click();
		await new Promise<void>((resolve) => {
			const sample = () => {
				const bar = document.querySelector<HTMLElement>('[aria-label^="AI suggestion for "]');
				if (bar) { const rect = bar.getBoundingClientRect(); positions.push({ x: rect.x, y: rect.y }); }
				else missing += 1;
				if (performance.now() - began < 1100) requestAnimationFrame(sample);
				else resolve();
			};
			requestAnimationFrame(sample);
		});
		return { start: { x: start.x, y: start.y }, end, positions, missing };
	});
	expect(result.missing).toBe(0);
	for (const point of result.positions) {
		expect(point.x).toBeGreaterThanOrEqual(Math.min(result.start.x, result.end.x) - 32);
		expect(point.x).toBeLessThanOrEqual(Math.max(result.start.x, result.end.x) + 32);
		expect(point.y).toBeGreaterThanOrEqual(Math.min(result.start.y, result.end.y) - 32);
		expect(point.y).toBeLessThanOrEqual(Math.max(result.start.y, result.end.y) + 32);
	}
	await expect(page.getByRole("button", { name: "Accept assignee" })).toBeVisible();
});
