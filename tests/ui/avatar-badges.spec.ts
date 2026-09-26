import { expect, test } from "@playwright/test";

const URL = `${process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost"}/components/ui/avatar#status`;
const BADGE_SLOTS = ["avatar-presence", "avatar-status", "avatar-badge", "avatar-company-badge", "avatar-project-badge"];

for (const width of [1440, 390]) {
	test(`all avatar badge types have a 2px white outside ring in both themes at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 1000 });
		await page.goto(URL);
		for (const theme of ["light", "dark"] as const) {
			const current = page.getByRole("button", { name: theme === "dark" ? "Light theme" : "System theme", exact: true });
			if (await current.count()) await current.click();
			for (const slot of BADGE_SLOTS) {
				const badges = page.locator(`[data-slot="${slot}"]`);
				await expect(badges.first()).toBeAttached();
				for (const badge of await badges.all()) {
					await badge.scrollIntoViewIfNeeded();
					// Every overlay must remain outside the clipped hexagon artwork.
					expect(await badge.evaluate(el => Boolean(el.closest('[data-slot="avatar-hexagon-artwork"]')))).toBe(false);
					await expect(badge).toHaveCSS("box-shadow", /rgb\(255, 255, 255\) 0px 0px 0px 2px/);
				}
			}
			const project = page.locator('[data-slot="avatar-project-badge"]').first();
			await project.scrollIntoViewIfNeeded();
			const box = (await project.boundingBox())!;
			await page.screenshot({ path: `output/agent-browser/human-agent-avatar/project-badge-${theme}-${width}.png`, clip: { x: box.x - 3, y: box.y - 3, width: box.width + 6, height: box.height + 6 } });
		}
	});
}

test("agent-card cover badges retain the shared 2px white separator", async ({ page }) => {
	await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost"}/components/blocks/agent-card#experimental-template`);
	const badges = page.locator('[data-slot="avatar-company-badge"], [data-slot="avatar-project-badge"]');
	await expect(badges.first()).toBeAttached();
	for (const badge of await badges.all()) {
		await expect(badge).toHaveCSS("box-shadow", /rgb\(255, 255, 255\) 0px 0px 0px 2px/);
	}
});
