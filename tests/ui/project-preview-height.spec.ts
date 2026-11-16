import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

for (const route of ["/", "/projects"]) {
	test(`project preview fills its frame on ${route}`, async ({ page }) => {
		await page.goto(appUrl(route));
		const preview = page.locator('iframe[src^="/preview/projects/"]');
		await expect(preview).toHaveCount(1);

		for (const viewport of [{ width: 1280, height: 720 }, { width: 1440, height: 1100 }]) {
			await page.setViewportSize(viewport);
			await expect.poll(() => preview.evaluate((iframe) => {
				const frame = iframe.parentElement;
				if (!frame) throw new Error("Project preview frame is missing");
				return Math.abs(iframe.getBoundingClientRect().height - frame.clientHeight);
			})).toBeLessThan(1);
			await expect.poll(() => preview.evaluate((iframe) => iframe.clientHeight)).toBeGreaterThan(400);
		}
	});
}
