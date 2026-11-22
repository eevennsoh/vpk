import { expect, test, type Locator, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ ignoreHTTPSErrors: true });

async function checkTabHover(page: Page, list: Locator, firstName: string, secondName: string) {
	const first = list.getByRole("tab", { name: firstName, exact: true });
	const second = list.getByRole("tab", { name: secondName, exact: true });
	const background = (tab: Locator) => tab.evaluate((element) => getComputedStyle(element).backgroundColor);
	const settle = (tab: Locator) => tab.evaluate(async (element) => {
		getComputedStyle(element).getPropertyValue("background-color");
		await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
		await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => {})));
	});
	await page.mouse.move(0, 0);
	await expect(first).toHaveAttribute("aria-selected", "true");
	const selectedColor = await background(first);
	const idleColor = await background(second);
	await first.hover();
	await settle(first);
	await expect.poll(() => background(first)).toBe(selectedColor);
	await second.hover();
	await settle(second);
	await expect.poll(() => background(second)).not.toBe(idleColor);
	await second.click();
	await expect(second).toHaveAttribute("aria-selected", "true");
	await settle(second);
	await expect.poll(() => background(second)).toBe(selectedColor);
	await page.mouse.move(0, 0);
	await expect.poll(() => background(second)).toBe(selectedColor);
	await second.hover();
	await settle(second);
	await expect.poll(() => background(second)).toBe(selectedColor);
}

test("selected tabs keep their surface on hover in the shared Tabs demo", async ({ page }) => {
	await page.goto(appUrl("/components/ui/tabs"));
	await checkTabHover(page, page.locator("#preview").getByRole("tablist").first(), "Account", "Settings");
});

test("activity view tabs keep their selected surface on hover", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	await checkTabHover(page, page.getByRole("tablist", { name: "Activity view" }), "Timeline", "Agent sessions");
});
