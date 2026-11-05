import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`the journey PR icon appears with ${reducedMotion} motion`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/butter"));
		const steps = page.getByRole("group", { name: "Merchant onboarding journey steps" });
		await steps.getByRole("button", { name: "In progress", exact: true }).click();
		await expect(page.locator('[data-issue-key="PAY-999"][data-board-column-title="In progress"]')).toBeVisible();
		await page.evaluate(() => {
			const samples: { opacity: number; scale: number; width: number; height: number }[] = [];
			Object.assign(window, { prRevealSamples: samples });
			const end = performance.now() + 5000;
			function sample(now: number) {
				const button = document.querySelector<HTMLElement>('[aria-label="Pull request #284: Add merchant onboarding quickstart"]');
				const icon = button?.firstElementChild;
				if (button && icon) {
					const style = getComputedStyle(icon);
					const bounds = button.getBoundingClientRect();
					samples.push({ opacity: Number(style.opacity), scale: new DOMMatrixReadOnly(style.transform).a, width: bounds.width, height: bounds.height });
				}
				if (now < end) requestAnimationFrame(sample);
			}
			requestAnimationFrame(sample);
		});
		await steps.getByRole("button", { name: "Pull request", exact: true }).click();
		const button = page.getByRole("button", { name: "Pull request #284: Add merchant onboarding quickstart" });
		await expect(button).toBeVisible();
		await page.waitForTimeout(350);
		const samples = await page.evaluate(() => Reflect.get(window, "prRevealSamples") as { opacity: number; scale: number; width: number; height: number }[]);
		expect(samples.length).toBeGreaterThan(0);
		expect(new Set(samples.map(({ width, height }) => `${width}:${height}`)).size).toBe(1);
		if (reducedMotion === "reduce") {
			expect(samples.every(({ opacity, scale }) => opacity === 1 && scale === 1)).toBe(true);
		} else {
			expect(samples.some(({ opacity, scale }) => opacity > 0.1 && opacity < 0.9 && scale < 0.85)).toBe(true);
		}
		await button.click();
		await expect(page.getByRole("dialog", { name: "Pull request #284 details" })).toBeVisible();
	});
}
