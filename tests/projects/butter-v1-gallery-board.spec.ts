import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ actionTimeout: 7000, ignoreHTTPSErrors: true });

test("selecting a gallery item animates its highlight", { tag: "@smoke" }, async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	const button = page.getByRole("button", { name: "Select Work item" });
	await expect(button).toBeVisible();
	await button.click();
	const surface = button.locator("[style*='mask-image']").first();
	await expect(surface).toBeAttached();
	// The highlight grows on a Web Animation. Read that animation, not how many frames the runner paints;
	// with fill "forwards" it stays readable even if it has already finished.
	const reveal = await surface.evaluate(async (element) => {
		const animation = element.getAnimations().find((candidate) => (candidate.effect as KeyframeEffect | null)?.getKeyframes().some((frame) => "transform" in frame));
		if (!animation) return null;
		const keyframes = (animation.effect as KeyframeEffect).getKeyframes();
		const scale = (frame: ComputedKeyframe) => new DOMMatrixReadOnly(String(frame.transform)).a;
		const timing = { duration: Number(animation.effect!.getTiming().duration), from: scale(keyframes[0]), to: scale(keyframes[keyframes.length - 1]) };
		await animation.finished;
		return timing;
	});
	expect(reveal, "selecting starts a transform animation on the highlight").not.toBeNull();
	expect(reveal!.duration).toBeGreaterThan(0);
	expect(reveal!.from).toBeLessThan(1);
	expect(reveal!.to).toBe(1);
	// Once it finishes, the highlight covers the whole selected item.
	const [item, painted] = await Promise.all([button.boundingBox(), surface.boundingBox()]);
	if (!item || !painted) throw new Error("Expected the selected item and its highlight to have boxes");
	expect(painted.x).toBeLessThanOrEqual(item.x + 1);
	expect(painted.y).toBeLessThanOrEqual(item.y + 1);
	expect(painted.x + painted.width).toBeGreaterThanOrEqual(item.x + item.width - 1);
	expect(painted.y + painted.height).toBeGreaterThanOrEqual(item.y + item.height - 1);
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
