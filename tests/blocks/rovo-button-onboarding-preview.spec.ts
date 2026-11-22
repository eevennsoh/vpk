import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });

test("the onboarding example fits its preview when opened", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/rovo-button#agent-onboarding"));
	const example = page.locator("#agent-onboarding");
	await example.getByRole("button", { name: "Open onboarding demo" }).click();
	const panel = example.getByTestId("floating-rovo-button-onboarding");
	await expect(panel).toBeVisible();
	await expect.poll(() => panel.evaluate((element) => {
		const preview = element.closest('[class*="relative h-"]');
		if (!preview) return false;
		const bounds = preview.getBoundingClientRect();
		const card = element.getBoundingClientRect();
		return card.top >= bounds.top && card.bottom <= bounds.bottom;
	})).toBe(true);
});
