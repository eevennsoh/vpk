import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ actionTimeout: 7000, ignoreHTTPSErrors: true });

test("selecting a gallery item animates its highlight", { tag: "@smoke" }, async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	const button = page.getByRole("button", { name: "Select Work item" });
	await expect(button).toBeVisible();
	const sizes = await button.evaluate(async (element) => {
		const samples: number[] = [];
		const start = performance.now();
		(element as HTMLButtonElement).click();
		await new Promise<void>((resolve) => {
			const sample = () => {
				const surface = element.querySelector<HTMLElement>("[style*='mask-image']");
				if (surface) samples.push(Number.parseFloat(getComputedStyle(surface).maskSize));
				if (performance.now() - start < 1000) requestAnimationFrame(sample);
				else resolve();
			};
			requestAnimationFrame(sample);
		});
		return samples;
	});
	expect(new Set(sizes).size).toBeGreaterThan(2);
});

test("the standalone board hides an open sidebar chat and restores its draft", { tag: "@smoke" }, async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	await page.getByRole("button", { name: "Ask Rovo", exact: true }).click();
	const composer = page.getByRole("textbox", { name: "Chat message input", exact: true });
	await composer.fill("Keep this draft");
	await page.getByRole("button", { name: "Select Board" }).click();
	await expect(composer).toBeHidden();
	await expect(page.getByRole("region", { name: "Payments SDK v2 Kanban board" })).toBeVisible();
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	await expect(composer).toBeVisible();
	await expect(composer).toContainText("Keep this draft");
});

test("the standalone board is centered and remains scrollable on narrow screens", { tag: "@smoke" }, async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board" }).click();
	const board = page.getByRole("region", { name: "Payments SDK v2 Kanban board" });
	const first = board.locator('[data-jira-kanban-column="To do"]');
	const last = board.locator('[data-jira-kanban-column="Done"]');
	await expect(first).toBeVisible();
	// The board lays out after the gallery selection settles; wait for the columns to centre.
	await expect.poll(async () => {
		const [viewport, firstBounds, lastBounds] = await Promise.all([board.boundingBox(), first.boundingBox(), last.boundingBox()]);
		if (!viewport || !firstBounds || !lastBounds) return Infinity;
		return Math.abs((firstBounds.x - viewport.x) - (viewport.x + viewport.width - lastBounds.x - lastBounds.width));
	}, { message: "board columns centred in the viewport" }).toBeLessThan(2);
	await page.setViewportSize({ width: 700, height: 900 });
	await expect.poll(() => board.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
	const start = await first.boundingBox();
	const narrowViewport = await board.boundingBox();
	if (!start || !narrowViewport) throw new Error("Narrow board has no bounds");
	expect(start.x).toBeGreaterThanOrEqual(narrowViewport.x);
	await board.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
	await expect.poll(async () => {
		const end = await last.boundingBox();
		const visible = await board.boundingBox();
		return end && visible ? end.x + end.width - (visible.x + visible.width) : Infinity;
	}).toBeLessThanOrEqual(1);
});
