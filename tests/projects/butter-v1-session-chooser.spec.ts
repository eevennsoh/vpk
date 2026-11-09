import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("session chooser keeps compact padding and fits its session cards", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
	const picker = page.getByRole("region", { name: "Duplicative sessions agent selector" });
	await picker.getByRole("option", { name: /^Claude/ }).click();
	const chooser = page.getByRole("dialog", { name: "Claude sessions" });
	await expect(chooser).toHaveCSS("width", "280px");
	await expect(chooser).toHaveCSS("padding", "4px");
	const sessions = chooser.locator('article[data-variant="uncaptured-work"]');
	await expect(sessions).toHaveCount(5);
	await expect(sessions.first()).toContainText("Review the onboarding quickstart");
	await expect(sessions.first()).toContainText("Claude");
	const popup = await chooser.boundingBox();
	const first = await sessions.first().boundingBox();
	if (!popup || !first) throw new Error("Session chooser geometry is unavailable");
	expect(first.x - popup.x).toBe(4);
	expect(popup.x + popup.width - first.x - first.width).toBe(4);
	await chooser.getByRole("button", { name: "Review the onboarding quickstart" }).click();
	await expect(picker.getByRole("status")).toHaveText("Selected session: Review the onboarding quickstart");
});

test("session chooser cards stay within a narrow viewport", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await page.getByRole("region", { name: "Duplicative sessions agent selector" }).getByRole("option", { name: /^Claude/ }).click();
	const chooser = page.getByRole("dialog", { name: "Claude sessions" });
	await expect(chooser).toBeVisible();
	const bounds = await chooser.boundingBox();
	if (!bounds) throw new Error("Session chooser is not visible");
	expect(bounds.x).toBeGreaterThanOrEqual(0);
	expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
	const overflow = await chooser.locator('article[data-variant="uncaptured-work"]').evaluateAll((cards) => cards.map((card) => card.scrollWidth - card.clientWidth));
	expect(overflow.every((width) => width <= 1)).toBe(true);
});
