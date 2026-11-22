import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`the Live chat surface respects ${reducedMotion} hover motion`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/components/blocks/rovo-button#persistent-toolbar"));
		const example = page.locator("#persistent-toolbar");
		const button = example.getByRole("button", { name: "Talk to Rovo" });
		await button.evaluate((element) => element.scrollIntoView({ block: "center" }));
		await expect.poll(() => button.evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(48);
		const restingColor = await button.evaluate((element) => getComputedStyle(element).backgroundColor);
		await button.hover();
		await expect.poll(() => button.evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(reducedMotion === "reduce" ? 48 : 53);
		await expect.poll(() => button.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(restingColor);
		await expect(page.locator('[data-slot="tooltip-content"]').filter({ hasText: "Live chat" })).toBeVisible();
	});
}
