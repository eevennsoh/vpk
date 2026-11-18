import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("PR examples show the author photo and match spacious title styling to the flyout", async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/pull-request"));
	const avatar = page.locator('img[alt="Shilpa Airi"]');
	await expect(avatar).toBeVisible();
	await expect.poll(() => avatar.evaluate((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0)).toBe(true);
	await page.getByRole("button", { name: "Dropdown spacious", exact: true }).click();
	const spacious = page.locator('[data-pull-request="1847"] .whitespace-normal').first();
	const styling = (element: Element) => {
		const style = getComputedStyle(element);
		return { fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight, color: style.color };
	};
	const spaciousStyle = await spacious.evaluate(styling);
	await page.getByRole("button", { name: "Flyout", exact: true }).click();
	const flyout = page.locator('[data-pull-request="1306"] .whitespace-normal').first();
	await expect(flyout).toBeVisible();
	expect(spaciousStyle).toEqual(await flyout.evaluate(styling));
});

test("hovered author avatars are not clipped in the PR flyout", async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/pull-request"));
	await page.getByRole("button", { name: "Flyout", exact: true }).click();
	const card = page.getByRole("group", { name: "Pull request #1306: Add guest checkout to the storefront" });
	const avatars = card.getByRole("group", { name: "Cursor, used by Venn" }).locator('[data-slot="avatar"]');
	await expect(avatars).toHaveCount(2);
	for (const avatar of await avatars.all()) {
		await avatar.hover();
		await expect.poll(() => avatar.evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThan(17);
		const clipped = await avatar.evaluate((node) => {
			const bounds = node.getBoundingClientRect();
			for (let parent = node.parentElement; parent; parent = parent.parentElement) {
				const style = getComputedStyle(parent);
				const rect = parent.getBoundingClientRect();
				if (style.overflowX !== "visible" && (bounds.left < rect.left || bounds.right > rect.right)) return true;
				if (style.overflowY !== "visible" && (bounds.top < rect.top || bounds.bottom > rect.bottom)) return true;
			}
			return false;
		});
		expect(clipped).toBe(false);
	}
});

test("the failed PR flyout offers Fix PR beside Review", { tag: "@smoke" }, async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/pull-request"));
	await page.getByRole("button", { name: "Flyout", exact: true }).click();
	await page.getByRole("button", { name: "Failed", exact: true }).click();
	const card = page.getByRole("group", { name: "Pull request #1306: Add guest checkout to the storefront" });
	const review = card.getByRole("link", { name: "Review" });
	const fix = card.getByRole("button", { name: "Fix PR" });
	await expect(review).toBeVisible();
	await expect(fix).toBeEnabled();
	const [reviewBox, fixBox] = await Promise.all([review.boundingBox(), fix.boundingBox()]);
	if (!reviewBox || !fixBox) throw new Error("The PR actions did not render");
	expect(Math.abs(reviewBox.y - fixBox.y)).toBeLessThan(1);
	expect(fixBox.x).toBeGreaterThan(reviewBox.x);
	await fix.click();
	await expect(card.getByRole("button", { name: "Fix PR" })).toHaveCount(0);
	await expect(card.getByRole("button", { name: /checks running/ })).toBeVisible();
});
