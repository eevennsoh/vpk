import { expect, test, type Page } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";
import { readShimmerWave, sampleShimmerWaveMotion } from "@/tests/helpers/shimmer-wave";

// ShimmerWave renders its `as` element itself (default "p"). No example on the docs page
// passes a non-default `as`; tests/projects/jira-auto-arrange-shimmer-label.spec.ts covers `as="span"`.
const ROUTE = "/components/ui-custom/shimmer-wave";
const TEXT = "Wave shimmer";

// The "Basic" example (ExampleItem id "basic"); its first wave reads "Wave shimmer".
function basicExample(page: Page) {
	return page.locator("#basic");
}

test("ShimmerWave animates per-letter spans inside its element when motion is allowed", { tag: "@smoke" }, async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl(ROUTE));
	const example = basicExample(page);
	await example.scrollIntoViewIfNeeded();
	// Only a wave holds aria-hidden highlight copies; the example's description <p> holds none.
	const wave = example.locator("p").filter({ has: page.locator('span[aria-hidden="true"]') }).first();
	await expect(wave).toBeVisible();

	expect(await readShimmerWave(wave)).toEqual({ tagName: "p", letters: TEXT.length, text: TEXT });

	const before = await sampleShimmerWaveMotion(wave);
	expect(before, "at least one animated letter").not.toBe("");
	// One wave cycle is 1 s plus a 0.6 s repeat delay, and it repeats forever.
	await expect.poll(() => sampleShimmerWaveMotion(wave), {
		message: "a letter's transform or highlight opacity changes while the wave runs",
		timeout: 5_000,
	}).not.toBe(before);
});

test("ShimmerWave renders its plain element with the full text under reduced motion", { tag: "@smoke" }, async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl(ROUTE));
	const example = basicExample(page);
	await example.scrollIntoViewIfNeeded();
	const plain = example.getByText(TEXT, { exact: true });
	await expect(plain).toBeVisible();

	expect(await readShimmerWave(plain)).toEqual({ tagName: "p", letters: 0, text: TEXT });
	await expect(plain.locator("span"), "no per-letter spans").toHaveCount(0);
});
