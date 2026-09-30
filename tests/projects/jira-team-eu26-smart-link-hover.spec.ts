import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1600, height: 1100 }, ignoreHTTPSErrors: true });

test("nested Smart Link tolerates a diagonal pause and keeps its session flyout alive", async ({ page }) => {
	await page.goto(appUrl("/jira-team-eu26"), { waitUntil: "domcontentloaded" });
	const notch = page.locator('[data-session-id="lw-sync-webhook-gap"]');
	await expect(notch).toBeVisible({ timeout: 15_000 });
	const railHitArea = page.locator("[data-agent-session-column-hit-area]");
	if (await railHitArea.isVisible()) {
		await railHitArea.hover();
		await expect(railHitArea).toHaveCount(0);
		await page.getByRole("button", { name: "Unlink sessions column options" }).click();
		await page.getByRole("menuitem", { name: "Pin", exact: true }).click();
		await expect(page.locator("[data-agent-session-column-expansion]")).toHaveAttribute("data-agent-session-column-expansion", "pinned");
	}
	await notch.hover();
	const parent = page.locator('[data-slot="hover-card-content"]').filter({
		has: page.getByRole("heading", { name: "Challenge webhook gap notes just landed from a local Cursor session" }),
	});
	const chip = parent.getByRole("link");
	await chip.hover();
	const child = page.locator('[data-slot="hover-card-content"]').filter({
		has: page.getByRole("button", { name: "Copy link" }),
	});
	await expect(child).toBeVisible();
	// Allow the existing entrance transform to settle before measuring the cone.
	await page.waitForTimeout(150);
	const trigger = (await chip.boundingBox())!;
	const popup = (await child.boundingBox())!;
	const start = { x: trigger.x + trigger.width / 2, y: trigger.y + trigger.height / 2 };
	const destination = { x: popup.x + 12, y: popup.y + popup.height * 0.6 };
	const crossing = { x: start.x + (popup.x - start.x) * 0.65, y: start.y + (destination.y - start.y) * 0.65 };
	await page.mouse.move(crossing.x, crossing.y, { steps: 5 });
	// Longer than Base UI's 40ms polygon timeout + Smart Link's 80ms close delay.
	await page.waitForTimeout(200);
	expect(await child.count()).toBe(1);
	expect(await parent.getAttribute("data-open")).not.toBeNull();
	await page.mouse.move(destination.x, destination.y, { steps: 5 });
	await page.waitForTimeout(350);
	await expect(child).toHaveAttribute("data-open", "");
	await expect(parent).toHaveAttribute("data-open", "");
	await page.screenshot({ path: "output/agent-browser/smart-link-diagonal-cone.png" });
	// Return to the chip, then leave the cone deliberately: no sticky parent.
	await page.mouse.move(start.x, start.y, { steps: 8 });
	await expect(parent).toHaveAttribute("data-open", "");
	await expect(child).toBeVisible();
	await page.mouse.move(crossing.x, crossing.y, { steps: 5 });
	await page.waitForTimeout(150);
	await page.mouse.move(1500, 100);
	await expect(child).toBeHidden();
	await expect(parent).toBeHidden();
	await notch.hover();
	await chip.hover();
	await expect(child).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(child).toBeHidden();
	await page.mouse.move(1500, 100);
	await expect(parent).toBeHidden();
});
