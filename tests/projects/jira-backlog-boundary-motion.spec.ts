import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

async function dragBoundary(page: Page, targetId: string, cancel = false) {
	const handle = page.getByRole("button", { name: "Move work items between sprint and backlog" });
	const target = page.locator(`[data-backlog-item-id="${targetId}"]`);
	const start = await handle.boundingBox();
	const end = await target.boundingBox();
	if (!start || !end) throw new Error("Expected the separator and target row to be visible");
	const x = start.x + start.width / 2;
	await page.mouse.move(x, start.y + start.height / 2);
	await page.mouse.down();
	await page.mouse.move(x, end.y + end.height / 2, { steps: 10 });
	if (cancel) await page.keyboard.press("Escape");
	await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1050 });
	await page.addInitScript(() => {
		const original = Element.prototype.animate;
		const moves: string[] = [];
		const samples: { id: string; y: number }[] = [];
		Object.assign(window, { backlogMotionMoves: moves, backlogMotionSamples: samples });
		Element.prototype.animate = function (keyframes, options) {
			const opacity = !Array.isArray(keyframes) ? keyframes?.opacity : undefined;
			if (this.tagName === "TD" && Array.isArray(opacity) && opacity[0] === 0.65) {
				const id = this.closest("[data-backlog-item-id]")?.getAttribute("data-backlog-item-id");
				if (id) {
					moves.push(id);
					requestAnimationFrame(() => requestAnimationFrame(() => {
						samples.push({ id, y: new DOMMatrixReadOnly(getComputedStyle(this).transform).m42 });
					}));
				}
			}
			return original.call(this, keyframes, options);
		};
	});
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("tab", { name: "Backlog", exact: true }).click();
});

test("separator moves animate all transferred rows in both directions, but not on cancel", async ({ page }) => {
	const sprint = page.getByRole("table", { name: "Payments SDK sprint work items" });
	const backlog = page.getByRole("table", { name: "Backlog work items" });
	await dragBoundary(page, "PAY-999", true);
	await expect(backlog.locator('[data-backlog-item-id="PAY-118"]')).toBeVisible();
	expect(await page.evaluate(() => (window as unknown as { backlogMotionMoves: string[] }).backlogMotionMoves)).toEqual([]);
	await dragBoundary(page, "PAY-999");
	await expect(sprint.locator('[data-backlog-item-id="PAY-999"]')).toBeVisible();
	await expect.poll(() => page.evaluate(() => (window as unknown as { backlogMotionMoves: string[] }).backlogMotionMoves)).toEqual(expect.arrayContaining(["PAY-118", "PAY-999"]));
	await expect.poll(() => page.evaluate(() => (window as unknown as { backlogMotionSamples: { id: string; y: number }[] }).backlogMotionSamples.some(({ id, y }) => id === "PAY-118" && y > 0))).toBe(true);
	await page.evaluate(() => {
		(window as unknown as { backlogMotionMoves: string[] }).backlogMotionMoves.length = 0;
		(window as unknown as { backlogMotionSamples: unknown[] }).backlogMotionSamples.length = 0;
	});
	await dragBoundary(page, "PAY-118");
	await expect(backlog.locator('[data-backlog-item-id="PAY-999"]')).toBeVisible();
	await expect.poll(() => page.evaluate(() => (window as unknown as { backlogMotionMoves: string[] }).backlogMotionMoves)).toEqual(expect.arrayContaining(["PAY-118", "PAY-999"]));
	await expect.poll(() => page.evaluate(() => (window as unknown as { backlogMotionSamples: { id: string; y: number }[] }).backlogMotionSamples.some(({ id, y }) => id === "PAY-118" && y < 0))).toBe(true);
});

test("reduced motion moves rows without an arrival animation", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await dragBoundary(page, "PAY-118");
	await expect(page.getByRole("table", { name: "Payments SDK sprint work items" }).locator('[data-backlog-item-id="PAY-118"]')).toBeVisible();
	const animations = await page.evaluate(() => (window as unknown as { backlogMotionMoves: string[] }).backlogMotionMoves);
	expect(animations).toEqual([]);
});
