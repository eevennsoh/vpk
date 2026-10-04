import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

for (const width of [1440, 1024]) {
	test(`the session resize handle follows the column height at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.clock.install();
		await page.goto(appUrl("/jira-team-eu26"), { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible();
		const expand = page.getByRole("button", { name: "Expand Unlink sessions column" });
		if (await expand.isVisible()) await expand.click();
		await expect(page.getByRole("separator", { name: "Resize Unlink sessions column" })).toBeVisible();
		await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1_000));
		const column = page.locator("[data-agent-session-column]");
		const handle = page.getByRole("separator", { name: "Resize Unlink sessions column" });
		const notch = handle.locator(":scope > div");
		const expectCentered = async () => {
			await expect.poll(async () => {
				const [columnBox, handleBox, notchBox] = await Promise.all([
					column.boundingBox(), handle.boundingBox(), notch.boundingBox(),
				]);
				if (!columnBox || !handleBox || !notchBox) return Infinity;
				const center = columnBox.y + columnBox.height / 2;
				return Math.max(
					Math.abs(handleBox.y - columnBox.y),
					Math.abs(handleBox.height - columnBox.height),
					Math.abs(notchBox.y + notchBox.height / 2 - center),
				);
			}).toBeLessThanOrEqual(1);
		};

		const ownerFilter = page.getByRole("button", { name: "Filter board by Diego Santos", exact: true });
		await ownerFilter.click();
		await expect(ownerFilter).toHaveAttribute("aria-pressed", "true");
		await expect.poll(async () => (await column.boundingBox())!.height).toBeLessThan(300);
		const shortHeight = (await column.boundingBox())!.height;
		await expectCentered();
		await handle.hover();
		await page.screenshot({ path: `output/agent-browser/session-resize-short-${width}.png` });
		// Clearing the filter restores an overflowing session list.
		await ownerFilter.click();
		await expect.poll(async () => (await column.boundingBox())!.height).toBeGreaterThan(shortHeight);
		await expectCentered();
		await page.setViewportSize({ width, height: 600 });
		await expectCentered();
		await handle.focus();
		await page.keyboard.press("ArrowRight");
		await expect(handle).toHaveAttribute("aria-valuenow", "290");
		await expectCentered();
		const handleBox = (await handle.boundingBox())!;
		const handleX = handleBox.x + handleBox.width / 2;
		const handleY = handleBox.y + handleBox.height / 2;
		await page.mouse.move(handleX, handleY);
		await page.mouse.down();
		await page.mouse.move(handleX + 96, handleY, { steps: 8 });
		await page.mouse.up();
		await expect(handle).toHaveAttribute("aria-valuenow", "386");
		await expectCentered();
		await page.screenshot({ path: `output/agent-browser/session-resize-centered-${width}.png` });
		await page.getByRole("button", { name: "Collapse Unlink sessions column" }).click();
		await expect(handle).toHaveCount(0);
		await expect(column).toHaveCSS("width", "32px");
		await page.getByRole("button", { name: "Expand Unlink sessions column" }).click();
		await expectCentered();
	});
}
