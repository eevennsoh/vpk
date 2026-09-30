import { expect, test } from "@playwright/test";

import { resolveAppOrigin } from "@/tests/helpers/origin";

const baseURL = resolveAppOrigin();
test.use({ viewport: { width: 1440, height: 1000 }, ignoreHTTPSErrors: true });
test.setTimeout(60_000);

test("Cone safezone catalog exposes placement and controlled examples with keyboard dismissal", async ({ page }) => {
	await page.goto(`${baseURL}/components/utility/cone-safezone`, { waitUntil: "domcontentloaded" });
	await expect(page.getByRole("heading", { name: "Cone safezone", exact: true })).toBeVisible();
	await expect(page.getByRole("heading", { name: "ConeSafezone", exact: true })).toBeVisible();
	await expect(page.getByText("@/components/utils/cone-safezone", { exact: true }).first()).toBeVisible();
	await expect(page.getByRole("heading", { name: "Placement", exact: true })).toBeVisible();
	for (const name of ["Left", "Hover or focus for details"]) {
		const trigger = page.getByRole("button", { name, exact: true });
		await trigger.scrollIntoViewIfNeeded();
		await expect(trigger).toHaveAttribute("data-popup-open", "");
		const box = (await trigger.boundingBox())!;
		await expect.poll(() => page.locator("[data-cone-safezone-debug] polygon").evaluateAll((polygons, center) => polygons.some((polygon) => {
			const [x, y] = (polygon.getAttribute("points") ?? "").split(" ")[0].split(",").map(Number);
			return Math.abs(x - center.x) < 1 && Math.abs(y - center.y) < 1;
		}), { x: box.x + box.width / 2, y: box.y + box.height / 2 })).toBe(true);
	}
	await expect(page.getByText("Preview open", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Close preview", exact: true }).click();
	await expect(page.getByText("Preview closed", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Toggle preview", exact: true }).click();
	await expect(page.getByText("Preview open", { exact: true })).toBeVisible();
	await expect(page.locator("[data-cone-safezone-debug]").last()).toBeVisible();
	await page.getByRole("button", { name: "Close preview", exact: true }).click();
	await page.getByRole("button", { name: "Toggle preview", exact: true }).focus();
	await page.keyboard.press("Tab");
	await expect(page.getByRole("button", { name: "Hover or focus for details", exact: true })).toBeFocused();
	await expect(page.getByRole("heading", { name: "A little more time" })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByText("Preview closed", { exact: true })).toBeVisible();
});

test("logical placements draw cones in both reading directions", async ({ page }) => {
	await page.goto(`${baseURL}/components/utility/cone-safezone`, { waitUntil: "domcontentloaded" });
	for (const rtl of [false, true]) {
		const toggle = page.getByRole("switch", { name: "Right-to-left" });
		if (rtl) await toggle.click();
		for (const name of ["Inline-start", "Inline-end"]) {
			const trigger = page.getByRole("button", { name, exact: true });
			await trigger.hover();
			await expect(trigger).toHaveAttribute("data-popup-open", "");
			const box = (await trigger.boundingBox())!;
			await expect.poll(() => page.locator("[data-cone-safezone-debug] polygon").evaluateAll((polygons, center) => polygons.some((polygon) => {
				const [x, y] = (polygon.getAttribute("points") ?? "").split(" ")[0].split(",").map(Number);
				return Math.abs(x - center.x) < 1 && Math.abs(y - center.y) < 1;
			}), { x: box.x + box.width / 2, y: box.y + box.height / 2 })).toBe(true);
			await page.keyboard.press("Escape");
		}
	}
});

test("nested demo shows the live cone and keeps both cards open through diagonal travel", async ({ page }) => {
	await page.goto(`${baseURL}/preview/utility/cone-safezone`, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: "Hover session" }).hover();
	const parent = page.locator('[data-slot="hover-card-content"]').filter({ has: page.getByRole("heading", { name: "Retry policy review is ready" }) });
	const link = parent.getByRole("link");
	await link.hover();
	const child = page.locator('[data-slot="hover-card-content"]').filter({ has: page.locator('[id^="smart-link-card-"]') });
	await expect(child).toBeVisible();
	await page.waitForTimeout(150);
	const trigger = (await link.boundingBox())!;
	const popup = (await child.boundingBox())!;
	const start = { x: trigger.x + trigger.width / 2, y: trigger.y + trigger.height / 2 };
	await page.mouse.move(start.x + (popup.x - start.x) * 0.65, start.y + (popup.y + popup.height * 0.6 - start.y) * 0.65, { steps: 5 });
	await page.waitForTimeout(180);
	expect(await child.count()).toBe(1);
	await expect(parent).toHaveAttribute("data-open", "");
	await expect(page.locator("[data-cone-safezone-debug]").first()).toBeVisible();
	await page.screenshot({ path: "output/agent-browser/cone-safezone-demo.png" });
	await page.mouse.move(popup.x + 16, popup.y + popup.height * 0.6, { steps: 5 });
	await page.waitForTimeout(350);
	await expect(child).toHaveAttribute("data-open", "");
	await page.keyboard.press("Escape");
	await expect(child).toBeHidden();
});

test("Escape restores focus to the parent trigger after nested keyboard previews close", async ({ page }) => {
	for (const url of ["https://fonts.googleapis.com/**", "https://fonts.gstatic.com/**", "https://unpkg.com/**"]) {
		await page.route(url, (route) => route.abort());
	}
	for (const reducedMotion of ["no-preference", "reduce"] as const) {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${baseURL}/preview/utility/cone-safezone`, { waitUntil: "domcontentloaded" });
		const trigger = page.getByRole("button", { name: "Hover session" });
		await trigger.focus();
		await expect(page.getByRole("heading", { name: "Retry policy review is ready" })).toBeVisible();
		await page.keyboard.press("Tab");
		const link = page.getByRole("link", { name: "#1847: Add guest checkout to the storefront Open", exact: true });
		await expect(link).toBeFocused();
		await expect(page.locator('[data-slot="hover-card-content"]').filter({ has: page.locator('[id^="smart-link-card-"]') })).toBeVisible();

		await page.keyboard.press("Escape");
		await expect(link).toBeFocused();
		await page.keyboard.press("Escape");
		await expect(page.getByRole("heading", { name: "Retry policy review is ready" })).toBeHidden();
		await expect(trigger).toBeFocused();
	}
});

test("debug cone persists over the trigger and card and follows pointer movement", async ({ page }) => {
	await page.goto(`${baseURL}/preview/utility/cone-safezone`, { waitUntil: "domcontentloaded" });
	const trigger = page.getByRole("button", { name: "Hover session" });
	await trigger.hover();
	const cone = page.locator("[data-cone-safezone-debug] polygon");
	await expect(cone).toBeVisible();
	// Keep the pointer still well beyond the hover grace period.
	await page.waitForTimeout(700);
	await expect(cone).toBeVisible();
	const initialPoints = await cone.getAttribute("points");
	const triggerBox = (await trigger.boundingBox())!;
	await page.mouse.move(triggerBox.x + 10, triggerBox.y + 10);
	await expect(cone).not.toHaveAttribute("points", initialPoints!);
	const popup = page.locator('[data-slot="hover-card-content"]');
	const popupBox = (await popup.boundingBox())!;
	await page.mouse.move(popupBox.x + 30, popupBox.y + 30, { steps: 8 });
	await page.waitForTimeout(700);
	await expect(cone).toBeVisible();
	const landedPoints = await cone.getAttribute("points");
	await page.mouse.move(popupBox.x + 70, popupBox.y + 45);
	await expect(cone).not.toHaveAttribute("points", landedPoints!);
	await page.screenshot({ path: "output/agent-browser/cone-safezone-persistent.png" });
	await page.keyboard.press("Escape");
	await expect(cone).toHaveCount(0);
});

test("nested demo fits a narrow viewport", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(`${baseURL}/preview/utility/cone-safezone`, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: "Hover session" }).hover();
	await page.locator('[data-slot="hover-card-content"]').getByRole("link").hover();
	const child = page.locator('[data-slot="hover-card-content"]').filter({ has: page.locator('[id^="smart-link-card-"]') });
	await expect(child).toBeVisible();
	const box = (await child.boundingBox())!;
	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.x + box.width).toBeLessThanOrEqual(390);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
	await page.screenshot({ path: "output/agent-browser/cone-safezone-mobile.png" });
});
