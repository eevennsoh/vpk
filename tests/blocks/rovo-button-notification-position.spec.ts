import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("the review notification stays on the icon's top-right corner", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	const review = page.getByRole("button", { name: "Review suggestions", exact: true });
	const dot = review.locator("[data-notification-dot]");
	const icon = review.locator("svg");
	await expect(dot).toBeVisible();
	await expect(icon).toBeVisible();
	await expect.poll(async () => (await review.boundingBox())?.height).toBeCloseTo(48, 0);
	const cornerOffset = async () => {
		const [dotBounds, iconBounds] = await Promise.all([dot.boundingBox(), icon.boundingBox()]);
		if (!dotBounds || !iconBounds) throw new Error("Review icon geometry is unavailable");
		return {
			x: dotBounds.x + dotBounds.width / 2 - (iconBounds.x + iconBounds.width),
			y: dotBounds.y + dotBounds.height / 2 - iconBounds.y,
		};
	};
	await expect.poll(async () => {
		const { x, y } = await cornerOffset();
		return Math.max(Math.abs(x), Math.abs(y));
	}).toBeLessThan(0.5);
	await review.hover();
	await expect.poll(async () => (await review.boundingBox())?.height).toBeGreaterThan(50);
	await expect.poll(async () => {
		const { x, y } = await cornerOffset();
		return Math.max(Math.abs(x), Math.abs(y));
	}).toBeLessThan(0.5);
});
