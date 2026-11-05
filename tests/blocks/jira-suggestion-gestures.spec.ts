import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 } });

async function openSuggestions(page: Page) {
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"] [data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await item.getByRole("button", { name: "5 suggestions" }).click();
	const value = page.locator("[data-top-card] [data-suggestion-value-scroll]");
	await expect(value).toBeVisible();
	return { item, value };
}

for (const direction of ["accept", "dismiss"] as const) {
	test(`swiping ${direction} from the scrollable description makes the decision`, async ({ page }) => {
		const { item, value } = await openSuggestions(page);
		const bounds = await value.boundingBox();
		if (!bounds) throw new Error("Suggestion value has no bounds");
		const x = bounds.x + bounds.width / 2;
		const y = bounds.y + 40;
		await page.mouse.move(x, y);
		await page.mouse.down();
		await page.mouse.move(x + (direction === "accept" ? 150 : -150), y, { steps: 12 });
		await expect(page.locator("[data-top-card]")).toHaveClass(/cursor-grabbing/);
		if (direction === "accept") {
			const card = page.locator("[data-top-card]");
			const hint = card.locator('span[aria-hidden="true"]').filter({ hasText: "Accept" });
			await expect.poll(() => hint.evaluate((element) => Number(getComputedStyle(element).opacity))).toBeGreaterThan(0.8);
			const greenBorder = await card.evaluate((element) => {
				const probe = document.createElement("span");
				probe.style.color = "var(--ds-border-success)";
				element.append(probe);
				const successColor = getComputedStyle(probe).color;
				probe.remove();
				return [element, ...element.querySelectorAll("*")].some((child) => {
					const style = getComputedStyle(child);
					return Number(style.opacity) > 0 && (style.boxShadow.includes(successColor) || style.borderColor === successColor);
				});
			});
			expect(greenBorder).toBe(false);
		}
		await page.mouse.up();
		await expect(item.getByRole("button", { name: "4 suggestions" })).toBeVisible();
		const description = item.getByRole("textbox", { name: "Work item description" });
		if (direction === "accept") await expect(description).toContainText("guided quickstart");
		else await expect(description).not.toContainText("guided quickstart");
	});
}

test("vertical touch scroll and cancelled swipes leave the suggestion undecided", async ({ page }) => {
	const { item, value } = await openSuggestions(page);
	await expect(value).toHaveCSS("touch-action", "pan-y pinch-zoom");
	const bounds = await value.boundingBox();
	if (!bounds) throw new Error("Suggestion value has no bounds");
	const x = Math.round(bounds.x + bounds.width / 2);
	const y = Math.round(bounds.y + bounds.height * 0.75);
	const cdp = await page.context().newCDPSession(page);
	await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
	await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - 100 }] });
	await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
	await expect.poll(() => value.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
	await expect(item.getByRole("button", { name: "5 suggestions" })).toBeVisible();
	await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
	await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + 120, y }] });
	await expect(page.locator("[data-top-card]")).toHaveClass(/cursor-grabbing/);
	await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
	await expect(item.getByRole("button", { name: "5 suggestions" })).toBeVisible();
	await expect(page.locator("[data-top-card]")).not.toHaveClass(/cursor-grabbing/);
	await expect(item.getByRole("textbox", { name: "Work item description" })).not.toContainText("guided quickstart");
	await cdp.detach();
});

for (const direction of ["accept", "dismiss"] as const) {
	test(`touch swipe ${direction} on the scrollable description makes the decision`, async ({ page }) => {
		const { item, value } = await openSuggestions(page);
		const bounds = await value.boundingBox();
		if (!bounds) throw new Error("Suggestion value has no bounds");
		const x = Math.round(bounds.x + bounds.width / 2);
		const y = Math.round(bounds.y + 40);
		const cdp = await page.context().newCDPSession(page);
		await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
		await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + (direction === "accept" ? 120 : -120), y }] });
		await expect(page.locator("[data-top-card]")).toHaveClass(/cursor-grabbing/);
		await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
		await expect(item.getByRole("button", { name: "4 suggestions" })).toBeVisible();
		const description = item.getByRole("textbox", { name: "Work item description" });
		if (direction === "accept") await expect(description).toContainText("guided quickstart");
		else await expect(description).not.toContainText("guided quickstart");
		await cdp.detach();
	});
}
