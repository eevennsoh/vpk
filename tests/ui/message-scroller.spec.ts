import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test.use({ ignoreHTTPSErrors: true });

test("chat scroller returns to the latest message and anchors a new turn", async ({ page }) => {
	await page.goto(appUrl("/components/ui/message-scroller"));
	const demo = page.locator("#preview");
	const viewport = demo.getByRole("group", { name: "Chat messages" });
	const scrollButton = demo.locator('[data-slot="message-scroller-button"]');
	await expect(viewport.getByText("What about message spacing", { exact: false })).toBeVisible();
	const viewportBox = await viewport.boundingBox();
	const scrollerBottom = viewportBox!.y + viewportBox!.height;
	const footerTop = (await demo.locator('[data-slot="card-footer"]').boundingBox())!.y;
	expect(Math.abs(footerTop - scrollerBottom)).toBeLessThan(1);
	await viewport.hover();
	await page.mouse.wheel(0, -2000);
	await expect(scrollButton).toHaveAttribute("data-active", "true");
	await expect(scrollButton).toBeVisible();
	await expect.poll(async () => {
		const buttonBox = await scrollButton.boundingBox();
		return buttonBox ? buttonBox.y + buttonBox.height - scrollerBottom : Infinity;
	}).toBeLessThanOrEqual(0);
	await expect(scrollButton).toHaveAccessibleName("Scroll to bottom");
	const icon = scrollButton.locator("svg");
	await expect(icon).toHaveCSS("width", "12px");
	await expect(icon).toHaveCSS("height", "12px");
	await expect(scrollButton).toHaveCSS("transition-property", "translate, scale, opacity");
	await expect(scrollButton).toHaveCSS("transition-timing-function", "cubic-bezier(0.23, 1, 0.32, 1)");
	await scrollButton.click();
	await expect(scrollButton).toHaveAttribute("data-active", "false");
	await expect(scrollButton).toHaveCSS("transition-timing-function", "cubic-bezier(0.7, 0, 0.84, 0)");
	await demo.getByRole("button", { name: "Send", exact: true }).click();
	await expect(viewport.getByText("Thanks, that helps.")).toBeVisible();
	await expect.poll(() => viewport.evaluate((element) => {
		const message = element.querySelector('[data-message-id="user-4"]');
		return message ? Math.abs(message.getBoundingClientRect().top - element.getBoundingClientRect().top - 24) : Infinity;
	})).toBeLessThan(2);
	await expect(viewport.getByText("Happy to help.", { exact: false })).toBeVisible();
});
